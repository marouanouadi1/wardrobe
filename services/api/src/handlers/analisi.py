"""L'analisi di una foto: due fasi, due endpoint HTTP.

La divisione non è estetica. `analizza` chiama un provider su Internet;
`salva` scrive su Postgres. Girano in linea, nello stesso processo: la
risposta a `POST /capi/analisi` arriva solo dopo che entrambe sono finite, ma
mantiene comunque la forma di un avvio asincrono (202 + id, poi polling) per
permettere il caricamento in blocco di più foto senza tenere aperte
richieste HTTP per decine di secondi ciascuna.
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Any

from domain.errors import AnalisiNonTrovata, ErroreDominio
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
    """POST /capi/analisi — la foto è già caricata, qui parte la pipeline."""
    richiesta = corpo(evento, RichiestaAnalisi)
    ingresso = {
        "utente_id": utente_id(evento),
        "chiave_foto": richiesta.chiave_foto,
        "provider": richiesta.provider or PROVIDER_DEFAULT,
        "modello": richiesta.modello or MODELLO_DEFAULT,
    }

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
        # parsabile) non deve uscire come un 500 anonimo: il dettaglio resta
        # nei log, non arriva al client.
        logging.getLogger("wardrobe").exception("analisi fallita per %s", richiesta.chiave_foto)
        repository().salva_esito_analisi(
            EsitoAnalisi(
                esecuzione_id=esecuzione,
                stato=StatoAnalisi.FALLITA,
                errore="L'analisi non è riuscita: riprova con più luce.",
            )
        )
    return ok(AnalisiAvviata(esecuzione_id=esecuzione), 202)


@endpoint
def stato(evento: Evento) -> Risposta:
    """GET /capi/analisi/{esecuzioneId} — l'app fa polling mentre mostra i passi."""
    esecuzione_id = parametro(evento, "esecuzioneId")

    esito = repository().leggi_esito_analisi(esecuzione_id)
    if esito is None:
        raise AnalisiNonTrovata(esecuzione_id)
    return ok(esito)


def analizza(evento: dict[str, Any], _contesto: Any = None) -> dict[str, Any]:
    """Prima fase — scontorna (se configurato), legge la foto, interroga il modello."""
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
    """Seconda fase — trasforma la lettura in capo e lo scrive."""
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
