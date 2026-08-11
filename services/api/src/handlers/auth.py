"""POST /auth/accedi e POST /auth/registrati — login e registrazione, autofirmati.

La registrazione è pubblica ma non aperta: `EMAIL_AMMESSE` (una lista di email
separate da virgole, nella variabile d'ambiente) è l'allowlist degli inviti.
Vuota o assente, la registrazione è chiusa — fail-closed, non fail-open: senza
questo, dimenticare la variabile in produzione apre l'iscrizione a chiunque
trovi l'indirizzo dell'API. Vedi `domain/autenticazione.py` per hash e JWT.
"""

from __future__ import annotations

import os

from domain.autenticazione import (
    email_ammessa,
    email_valida,
    emetti_token,
    genera_hash,
    normalizza_email,
    verifica_password,
)
from domain.errors import CredenzialiNonValide, RegistrazioneNonAmmessa, RichiestaNonValida
from domain.models import Credenziali, Registrazione, TokenAccesso
from handlers._container import orologio, repository_utenti
from handlers._http import Evento, Risposta, corpo, endpoint, ok


def _email_ammesse() -> frozenset[str]:
    grezzo = os.environ.get("EMAIL_AMMESSE", "")
    return frozenset(normalizza_email(voce) for voce in grezzo.split(",") if voce.strip())


@endpoint
def accedi(evento: Evento) -> Risposta:
    richiesta = corpo(evento, Credenziali)

    trovato = repository_utenti().trova_per_email(normalizza_email(richiesta.email))
    if trovato is None:
        raise CredenzialiNonValide("email o password errate")

    utente_id, hash_password = trovato
    if not verifica_password(richiesta.password, hash_password):
        raise CredenzialiNonValide("email o password errate")

    token = emetti_token(utente_id, os.environ["JWT_SECRET"], orologio().adesso())
    return ok(TokenAccesso(token=token))


@endpoint
def registra(evento: Evento) -> Risposta:
    """Chi si registra entra subito: un token, non un secondo giro dal login —
    un attrito in più senza motivo, per un utente che ha appena provato le sue
    credenziali una volta."""
    richiesta = corpo(evento, Registrazione)
    email = normalizza_email(richiesta.email)

    if not email_valida(email):
        raise RichiestaNonValida("email non valida")
    if not email_ammessa(email, _email_ammesse()):
        raise RegistrazioneNonAmmessa(f"«{email}» non è nella lista degli inviti")

    utente_id = repository_utenti().crea(email, genera_hash(richiesta.password))
    token = emetti_token(utente_id, os.environ["JWT_SECRET"], orologio().adesso())
    return ok(TokenAccesso(token=token), 201)
