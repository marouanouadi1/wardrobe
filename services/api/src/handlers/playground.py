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

from domain.errors import AccessoNegato, RichiestaNonValida
from domain.models import (
    PresetPrompt,
    RichiestaPlayground,
    RichiestaRatingImmagine,
    RispostaValutazioni,
    RispostaValutazioniImmagini,
    ValutazioneImmagine,
)
from domain.playground import PRESETS, esegui, preset_effettivo, traccia
from domain.ports import ImmagineLlm
from domain.stylist import costruisci_contesto
from domain.valutazione import aggrega
from handlers._container import (
    archivio_foto,
    generatore_id,
    in_sviluppo,
    orologio,
    repository,
)
from handlers._http import Evento, Risposta, corpo, endpoint, ok, query, utente_id


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


@endpoint
def valutazioni(evento: Evento) -> Risposta:
    """GET /dev/valutazioni?run= — la tabella del banco (`scripts/valuta_modelli.py`).

    Senza `run` prende l'ultimo: è quello che si vuole guardare nella
    stragrande maggioranza dei casi, e evita a chi apre la schermata di dover
    prima cercare l'id in uno storico.
    """
    _controlla_accesso()
    run_id = query(evento).get("run") or repository().ultimo_run_valutazione()
    if run_id is None:
        return ok(RispostaValutazioni())

    trovate = repository().elenca_valutazioni(run_id)
    return ok(RispostaValutazioni(run_id=run_id, righe=aggrega(trovate), valutazioni=trovate))


def _con_url_immagine(valutazione: ValutazioneImmagine) -> ValutazioneImmagine:
    """La foto viaggia come URL firmato, mai come chiave nuda — stesso motivo
    di `handlers._foto_capo.con_url`: la chiave da sola non basta all'app per
    mostrare niente."""
    if valutazione.chiave_immagine is None:
        return valutazione
    return valutazione.model_copy(
        update={"url": archivio_foto().url_lettura(valutazione.chiave_immagine)}
    )


@endpoint
def immagini(evento: Evento) -> Risposta:
    """GET /dev/immagini?run= — il banco immagini (`scripts/genera_immagini.py`).

    Senza aggregazione (vedi `RispostaValutazioniImmagini`): niente verità
    nota da confrontare, solo la lista da mostrare come contact sheet.
    """
    _controlla_accesso()
    run_id = query(evento).get("run") or repository().ultimo_run_valutazione_immagine()
    if run_id is None:
        return ok(RispostaValutazioniImmagini())

    trovate = [_con_url_immagine(v) for v in repository().elenca_valutazioni_immagini(run_id)]
    return ok(RispostaValutazioniImmagini(run_id=run_id, valutazioni=trovate))


@endpoint
def vota_immagine(evento: Evento) -> Risposta:
    """POST /dev/immagini — assegna un rating umano a un'immagine già generata.

    Aggiorna la riga che `scripts/genera_immagini.py` ha già scritto: non ne
    crea una nuova, e non può votare un'immagine che non esiste nel run.
    """
    _controlla_accesso()
    richiesta = corpo(evento, RichiestaRatingImmagine)

    esistenti = repository().elenca_valutazioni_immagini(richiesta.run_id)
    trovata = next(
        (
            v
            for v in esistenti
            if v.servizio == richiesta.servizio
            and v.modello == richiesta.modello
            and v.campione_id == richiesta.campione_id
        ),
        None,
    )
    if trovata is None:
        raise RichiestaNonValida(
            f"nessuna immagine per {richiesta.servizio}/{richiesta.modello} su "
            f"{richiesta.campione_id} nel run «{richiesta.run_id}»"
        )

    aggiornata = trovata.model_copy(update={"rating": richiesta.rating})
    repository().salva_valutazione_immagine(aggiornata)
    return ok(_con_url_immagine(aggiornata))
