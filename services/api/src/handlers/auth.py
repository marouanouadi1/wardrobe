"""POST /auth/accedi — login autofirmato.

Niente self-signup pubblico a questa scala: gli utenti si creano con
`scripts/crea_utente.py`. Vedi `domain/autenticazione.py` per hash e JWT.
"""

from __future__ import annotations

import os

from domain.autenticazione import emetti_token, verifica_password
from domain.errors import CredenzialiNonValide
from domain.models import Credenziali, TokenAccesso
from handlers._container import orologio, repository_utenti
from handlers._http import Evento, Risposta, corpo, endpoint, ok


@endpoint
def accedi(evento: Evento) -> Risposta:
    richiesta = corpo(evento, Credenziali)

    trovato = repository_utenti().trova_per_email(richiesta.email)
    if trovato is None:
        raise CredenzialiNonValide("email o password errate")

    utente_id, hash_password = trovato
    if not verifica_password(richiesta.password, hash_password):
        raise CredenzialiNonValide("email o password errate")

    token = emetti_token(utente_id, os.environ["JWT_SECRET"], orologio().adesso())
    return ok(TokenAccesso(token=token))
