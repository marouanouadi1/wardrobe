"""Il playground: /dev/* — solo interno.

Serve a rispondere a una domanda sola, e a rispondere con dei numeri: quale
modello legge meglio i tessuti, e quale stilista vale il suo costo. Per questo
esercita i due job veri e registra latenza, token, costo ed esito.

Le chiavi dei provider stanno su Secrets Manager, non nell'app: dal telefono
arriva solo la scelta del modello. In sviluppo si può passare una chiave usa e
getta con l'header X-Provider-Key, e solo con DEV_MODE=1.
"""

from __future__ import annotations

import base64
import os

from domain.errors import AccessoNegato
from domain.models import PresetPrompt, RichiestaPlayground
from domain.playground import PRESETS, esegui, preset_effettivo, traccia
from domain.ports import ImmagineLlm
from domain.stylist import costruisci_contesto
from handlers._container import (
    archivio_foto,
    generatore_id,
    in_sviluppo,
    orologio,
    repository,
)
from handlers._http import Evento, Risposta, corpo, endpoint, ok, utente_id


def _controlla_accesso() -> None:
    if os.environ.get("PLAYGROUND_ABILITATO") != "1" and not in_sviluppo():
        raise AccessoNegato("il playground è disponibile solo negli ambienti interni")


def _chiave_di_sviluppo(evento: Evento) -> str | None:
    if not in_sviluppo():
        return None
    intestazioni = {k.lower(): v for k, v in (evento.get("headers") or {}).items()}
    return intestazioni.get("x-provider-key")


@endpoint
def modelli(_evento: Evento) -> Risposta:
    """GET /dev/modelli — il catalogo, con la spia «configurato» accesa o spenta."""
    _controlla_accesso()
    from adapters.llm.registry import catalogo

    return ok([m.model_dump(mode="json") for m in catalogo()])


@endpoint
def preset(_evento: Evento) -> Risposta:
    """GET /dev/preset — i preset di fabbrica, o l'ultima versione salvata di ciascuno."""
    _controlla_accesso()
    effettivi = [preset_effettivo(p.id, repository().leggi_preset(p.id)) for p in PRESETS]
    return ok([p.model_dump(mode="json") for p in effettivi])


@endpoint
def salva_preset(evento: Evento) -> Risposta:
    """POST /dev/preset — salva il prompt (e la sua configurazione) come nuovo default.

    Da qui in poi non lo usa solo il playground: la chat vera dello stilista
    (`handlers.chat`) legge lo stesso preset a ogni messaggio. Modificarlo qui
    e confermarlo è l'unico modo per cambiarlo senza un deploy.
    """
    _controlla_accesso()
    nuovo = corpo(evento, PresetPrompt)
    return ok(repository().salva_preset(nuovo))


@endpoint
def contesto(evento: Evento) -> Risposta:
    """GET /dev/contesto — il payload esatto che riceverebbe lo stilista adesso."""
    _controlla_accesso()
    utente = utente_id(evento)
    profilo = repository().leggi_profilo(utente)
    return ok(
        costruisci_contesto(
            repository().elenca_capi(utente),
            oggi=orologio().oggi(),
            preferenze=profilo.preferenze if profilo else None,
        )
    )


@endpoint
def storico(_evento: Evento) -> Risposta:
    _controlla_accesso()
    return ok([e.model_dump(mode="json") for e in repository().storico_playground()])


@endpoint
def esegui_test(evento: Evento) -> Risposta:
    """POST /dev/playground — una prova, un risultato, una riga di storico."""
    _controlla_accesso()
    from adapters.llm.registry import provider_per_nome, scheda_modello

    richiesta = corpo(evento, RichiestaPlayground)
    utente = utente_id(evento)

    immagine = None
    if richiesta.chiave_foto:
        contenuto, media_type = archivio_foto().leggi(richiesta.chiave_foto)
        immagine = ImmagineLlm(
            media_type=media_type, base64=base64.b64encode(contenuto).decode("ascii")
        )

    capi = repository().elenca_capi(utente)
    scheda = scheda_modello(richiesta.provider, richiesta.modello)

    esito = esegui(
        richiesta,
        provider_per_nome(richiesta.provider, chiave_override=_chiave_di_sviluppo(evento)),
        immagine=immagine,
        capi=capi,
        costo_input_eur_mtok=scheda.costo_input_eur_mtok if scheda else None,
        costo_output_eur_mtok=scheda.costo_output_eur_mtok if scheda else None,
    )

    repository().salva_esecuzione_playground(
        traccia(
            richiesta,
            esito,
            esecuzione_id=generatore_id().nuovo(),
            adesso=orologio().adesso(),
        )
    )
    return ok(esito)
