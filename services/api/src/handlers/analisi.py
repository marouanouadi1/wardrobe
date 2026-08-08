"""L'analisi di una foto: due task della state machine, due endpoint HTTP.

La divisione non è estetica. `analizza` chiama un provider su Internet e sta
FUORI dalla VPC; `salva` scrive su Postgres e sta DENTRO. Step Functions tiene
insieme i due pezzi, con retry sul primo. Vedi docs/adr/0001.
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Any

from domain.errors import ErroreDominio
from domain.models import (
    AnalisiAvviata,
    Capo,
    EsitoAnalisi,
    RichiestaAnalisi,
    StatoAnalisi,
)
from domain.ports import ImmagineLlm
from domain.vision import crea_capo, interpreta_lettura, richiesta_analisi
from handlers._container import (
    archivio_foto,
    generatore_id,
    orologio,
    repository,
)
from handlers._foto_capo import con_url
from handlers._http import Evento, Risposta, corpo, endpoint, ok, parametro, utente_id

PROVIDER_DEFAULT = os.environ.get("PROVIDER_VISIONE", "anthropic")
MODELLO_DEFAULT = os.environ.get("MODELLO_VISIONE", "")


@endpoint
def avvia(evento: Evento) -> Risposta:
    """POST /capi/analisi — la foto è già su S3, qui parte la pipeline."""
    richiesta = corpo(evento, RichiestaAnalisi)
    ingresso = {
        "utente_id": utente_id(evento),
        "chiave_foto": richiesta.chiave_foto,
        "provider": richiesta.provider or PROVIDER_DEFAULT,
        "modello": richiesta.modello or MODELLO_DEFAULT,
    }

    if not os.environ.get("STATE_MACHINE_ARN"):
        # Senza una state machine (locale, o un VPS senza Step Functions) i
        # due task girano in linea, nello stesso ordine e con lo stesso
        # codice. L'app non se ne accorge, perché la risposta ha la forma di
        # sempre. L'esito va su Postgres, non in un dict di processo: un
        # riavvio del server (deploy su un VPS, non un evento raro) non deve
        # far perdere al polling un'esecuzione già conclusa.
        esecuzione = generatore_id().nuovo()
        try:
            salvato = salva(analizza(ingresso))
            repository().salva_esito_analisi(
                EsitoAnalisi(
                    esecuzione_id=esecuzione,
                    stato=StatoAnalisi.COMPLETATA,
                    capo=con_url(Capo.model_validate(salvato["capo"])),
                )
            )
        except ErroreDominio as exc:
            repository().salva_esito_analisi(
                EsitoAnalisi(esecuzione_id=esecuzione, stato=StatoAnalisi.FALLITA, errore=str(exc))
            )
        except Exception:
            # Qualunque altra eccezione (SDK del provider, rete, risposta non
            # parsabile) non deve uscire come un 500 anonimo: il dettaglio
            # resta nei log, non arriva al client.
            logging.getLogger("wardrobe").exception("analisi fallita per %s", richiesta.chiave_foto)
            repository().salva_esito_analisi(
                EsitoAnalisi(
                    esecuzione_id=esecuzione,
                    stato=StatoAnalisi.FALLITA,
                    errore="L'analisi non è riuscita: riprova con più luce.",
                )
            )
        return ok(AnalisiAvviata(esecuzione_id=esecuzione), 202)

    from adapters.stepfunctions import Orchestratore

    return ok(
        AnalisiAvviata(
            esecuzione_id=Orchestratore(os.environ["STATE_MACHINE_ARN"]).avvia(ingresso)
        ),
        202,
    )


@endpoint
def stato(evento: Evento) -> Risposta:
    """GET /capi/analisi/{esecuzioneId} — l'app fa polling mentre mostra i passi."""
    esecuzione_id = parametro(evento, "esecuzioneId")

    if not os.environ.get("STATE_MACHINE_ARN"):
        locale = repository().leggi_esito_analisi(esecuzione_id)
        if locale is not None:
            return ok(locale)

    from adapters.stepfunctions import Orchestratore

    descrizione = Orchestratore(os.environ["STATE_MACHINE_ARN"]).stato(esecuzione_id)

    if descrizione.stato is StatoAnalisi.COMPLETATA and descrizione.uscita:
        capo = con_url(Capo.model_validate(descrizione.uscita["capo"]))
        return ok(EsitoAnalisi(esecuzione_id=esecuzione_id, stato=descrizione.stato, capo=capo))

    return ok(
        EsitoAnalisi(
            esecuzione_id=esecuzione_id, stato=descrizione.stato, errore=descrizione.errore
        )
    )


def analizza(evento: dict[str, Any], _contesto: Any = None) -> dict[str, Any]:
    """Task 1 — scontorna (se configurato), legge la foto, interroga il modello.

    Nessuna VPC, nessun accesso al database: solo S3 (via VPC endpoint gateway)
    e HTTPS verso i provider. Se un provider è lento o rifiuta, ritenta Step
    Functions, non l'utente.
    """
    from adapters.llm.registry import provider_per_nome
    from handlers._container import servizio_scontorno

    contenuto, media_type = archivio_foto().leggi(evento["chiave_foto"])

    # Lo scontorno è un miglioramento, non un requisito: vedi docs/adr/0004,
    # è il passo naturale prima della lettura — un capo già isolato dallo
    # sfondo è anche una foto più facile da leggere per il modello. Ma
    # provare l'app non deve dipendere dall'avere già una seconda chiave
    # oltre a quella del provider di visione, quindi se non è configurato o
    # fallisce si prosegue sulla foto originale.
    chiave_scontornata: str | None = None
    scontorno = servizio_scontorno()
    if scontorno is not None:
        try:
            scontornata = scontorno.scontorna(contenuto, media_type)
            chiave_scontornata = f"{evento['chiave_foto']}-scontornata"
            archivio_foto().salva(chiave_scontornata, scontornata, "image/png")
            contenuto, media_type = scontornata, "image/png"
        except ErroreDominio as exc:
            logging.getLogger("wardrobe").warning("scontorno non riuscito: %s", exc)

    immagine = ImmagineLlm(
        media_type=media_type, base64=base64.b64encode(contenuto).decode("ascii")
    )

    provider = provider_per_nome(evento["provider"])
    modello = evento.get("modello") or provider.modelli()[0].id
    risposta = provider.completa(richiesta_analisi(immagine, modello))
    lettura = interpreta_lettura(risposta.testo)

    return {
        **evento,
        "modello": modello,
        "lettura": lettura.model_dump(mode="json"),
        "latenza_ms": risposta.latenza_ms,
        "chiave_scontornata": chiave_scontornata,
    }


def salva(evento: dict[str, Any], _contesto: Any = None) -> dict[str, Any]:
    """Task 2 — trasforma la lettura in capo e lo scrive.

    Dentro la VPC, con accesso al database e senza uscita su Internet.
    """
    from domain.models import LetturaCapo

    capo = crea_capo(
        LetturaCapo.model_validate(evento["lettura"]),
        capo_id=generatore_id().nuovo(),
        chiave_foto=evento["chiave_foto"],
        chiave_scontornata=evento.get("chiave_scontornata"),
        provider=evento["provider"],
        modello=evento["modello"],
        adesso=orologio().adesso(),
    )
    salvato = repository().salva_capo(evento["utente_id"], capo)
    return {"capo": salvato.model_dump(mode="json")}
