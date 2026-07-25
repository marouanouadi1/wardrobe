"""L'analisi di una foto: due task della state machine, due endpoint HTTP.

La divisione non è estetica. `analizza` chiama un provider su Internet e sta
FUORI dalla VPC; `salva` scrive su Postgres e sta DENTRO. Step Functions tiene
insieme i due pezzi, con retry sul primo. Vedi docs/adr/0001.
"""

from __future__ import annotations

import base64
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
    in_sviluppo,
    orologio,
    repository,
)
from handlers._http import Evento, Risposta, corpo, endpoint, ok, parametro, utente_id

PROVIDER_DEFAULT = os.environ.get("PROVIDER_VISIONE", "anthropic")
MODELLO_DEFAULT = os.environ.get("MODELLO_VISIONE", "")

# Gli esiti delle analisi eseguite in linea, in sviluppo. In cloud questo
# dizionario non viene mai usato: lo stato lo conosce Step Functions.
_ESITI_LOCALI: dict[str, EsitoAnalisi] = {}


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

    if in_sviluppo():
        # In locale non esiste una state machine: i due task girano in linea,
        # nello stesso ordine e con lo stesso codice. L'app non se ne accorge,
        # perché la risposta ha la forma di sempre.
        esecuzione = generatore_id().nuovo()
        try:
            salvato = salva(analizza(ingresso))
            _ESITI_LOCALI[esecuzione] = EsitoAnalisi(
                esecuzione_id=esecuzione,
                stato=StatoAnalisi.COMPLETATA,
                capo=Capo.model_validate(salvato["capo"]),
            )
        except ErroreDominio as exc:
            _ESITI_LOCALI[esecuzione] = EsitoAnalisi(
                esecuzione_id=esecuzione, stato=StatoAnalisi.FALLITA, errore=str(exc)
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

    if in_sviluppo():
        locale = _ESITI_LOCALI.get(esecuzione_id)
        if locale is not None:
            return ok(locale)

    from adapters.stepfunctions import Orchestratore

    descrizione = Orchestratore(os.environ["STATE_MACHINE_ARN"]).stato(esecuzione_id)

    if descrizione.stato is StatoAnalisi.COMPLETATA and descrizione.uscita:
        capo = Capo.model_validate(descrizione.uscita["capo"])
        return ok(EsitoAnalisi(esecuzione_id=esecuzione_id, stato=descrizione.stato, capo=capo))

    return ok(
        EsitoAnalisi(
            esecuzione_id=esecuzione_id, stato=descrizione.stato, errore=descrizione.errore
        )
    )


def analizza(evento: dict[str, Any], _contesto: Any = None) -> dict[str, Any]:
    """Task 1 — legge la foto e interroga il modello di visione.

    Nessuna VPC, nessun accesso al database: solo S3 (via VPC endpoint gateway)
    e HTTPS verso il provider. Se il provider è lento o rifiuta, ritenta Step
    Functions, non l'utente.
    """
    from adapters.llm.registry import provider_per_nome

    contenuto, media_type = archivio_foto().leggi(evento["chiave_foto"])
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
        provider=evento["provider"],
        modello=evento["modello"],
        adesso=orologio().adesso(),
    )
    salvato = repository().salva_capo(evento["utente_id"], capo)
    return {"capo": salvato.model_dump(mode="json")}
