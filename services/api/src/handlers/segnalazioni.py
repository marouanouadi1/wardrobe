"""Le segnalazioni: la copia che l'app tiene di quanto il modulo di feedback
di Sentry (`apps/mobile/src/dati/segnalazioni.ts`) ha già inviato.

GET risponde le segnalazioni di chi chiama — a meno che chi chiama sia
nell'allowlist `EMAIL_AMMINISTRATORI`, nel qual caso risponde tutte: è la sola
persona con accesso al progetto Sentry, e senza vedere anche quelle di un
altro non avrebbe modo di sapere cosa lavorare. PATCH è riservato alla stessa
allowlist — senza, lo stato di una segnalazione non cambierebbe mai.

Stesso pattern di `EMAIL_AMMESSE` in `handlers/auth.py`: vuota o assente
significa nessun amministratore, fail-closed.
"""

from __future__ import annotations

import os

from domain.autenticazione import normalizza_email
from domain.errors import AccessoNegato, SegnalazioneNonTrovata
from domain.models import AggiornamentoSegnalazione, ElencoSegnalazioni, NuovaSegnalazione
from domain.segnalazioni import cambia_stato, crea_segnalazione
from handlers._container import generatore_id, orologio, repository, repository_utenti
from handlers._http import Evento, Risposta, corpo, endpoint, ok, parametro, utente_id


def _amministratori() -> frozenset[str]:
    grezzo = os.environ.get("EMAIL_AMMINISTRATORI", "")
    return frozenset(normalizza_email(voce) for voce in grezzo.split(",") if voce.strip())


def _e_amministratore(utente: str) -> bool:
    email = repository_utenti().trova_email(utente)
    return email is not None and email in _amministratori()


@endpoint
def crea(evento: Evento) -> Risposta:
    """POST /segnalazioni — una copia di quello che l'app ha già inviato a Sentry."""
    utente = utente_id(evento)
    nuova = corpo(evento, NuovaSegnalazione)
    segnalazione = crea_segnalazione(
        nuova.testo,
        segnalazione_id=generatore_id().nuovo(),
        utente_id=utente,
        adesso=orologio().adesso(),
    )
    return ok(repository().salva_segnalazione(segnalazione), 201)


@endpoint
def elenca(evento: Evento) -> Risposta:
    """GET /segnalazioni — le proprie, tutte per l'amministratore."""
    utente = utente_id(evento)
    amministratore = _e_amministratore(utente)
    segnalazioni = (
        repository().elenca_tutte_segnalazioni()
        if amministratore
        else repository().elenca_segnalazioni(utente)
    )
    return ok(ElencoSegnalazioni(segnalazioni=segnalazioni, amministratore=amministratore))


@endpoint
def aggiorna(evento: Evento) -> Risposta:
    """PATCH /segnalazioni/{segnalazioneId} — solo l'amministratore cambia lo
    stato; per chiunque altro la segnalazione resta in sola lettura."""
    utente = utente_id(evento)
    if not _e_amministratore(utente):
        raise AccessoNegato("solo un amministratore può cambiare lo stato di una segnalazione")

    segnalazione_id = parametro(evento, "segnalazioneId")
    modifica = corpo(evento, AggiornamentoSegnalazione)

    segnalazione = repository().leggi_segnalazione(segnalazione_id)
    if segnalazione is None:
        raise SegnalazioneNonTrovata(segnalazione_id)

    aggiornata = cambia_stato(segnalazione, modifica.stato, orologio().adesso())
    return ok(repository().salva_segnalazione(aggiornata))
