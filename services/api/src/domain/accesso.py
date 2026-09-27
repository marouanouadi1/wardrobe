"""Chi chiama: il token di Supabase, verificato qui (ADR 0010).

Il login non lo fa più il backend. Lo fa Supabase Auth, che firma i token con una
chiave asimmetrica (ES256); il backend ne conosce solo la parte pubblica, e con
quella verifica. La verifica è calcolo puro — `pyjwt` non fa I/O — e sta nel
dominio; scaricare le chiavi pubbliche (il JWKS) è I/O, e sta in
`adapters/supabase.py`, che qui arriva come una funzione `chiave_per`.

Tutto quello che il token non dimostra, qui non passa:

- **l'algoritmo è ES256 e basta**, qualunque cosa dica l'intestazione del token:
  un token HS256 o `none` è la forma classica di chi prova a firmarselo da sé;
- **`aud` è `authenticated`** e **`iss` è il nostro progetto**: un token di un
  altro progetto Supabase, firmato bene, non è un nostro utente;
- **`role` è `authenticated`**: un token `anon` o `service_role` non è una persona;
- **non è un accesso anonimo** (`is_anonymous`): Supabase gli dà `role` e `aud`
  `authenticated` come a tutti, ma non è nessuno degli invitati, e ogni chiamata
  qui costa una chiamata al modello.

`iat` non si controlla: con la firma e `exp` verificati non dimostra niente, e
fra l'orologio del VPS e quello di Supabase basta un secondo di differenza
perché un token appena rinnovato risulti «emesso nel futuro» e venga rifiutato.
`exp` invece resta rigido, senza margine.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import jwt

ALGORITMO = "ES256"
PUBBLICO = "authenticated"

#: Quanto deve valere ancora il token perché parta un lavoro lungo, come
#: l'analisi di una foto: un token che scade a metà lascerebbe l'esito
#: impossibile da scrivere. Con meno, 401: `supabase-js` rinnova e riprova.
MARGINE_LAVORO_LUNGO = timedelta(minutes=5)

#: Stessa regola di `privato.percorso_di` nella migrazione: il primo segmento è
#: l'utente, e nessun segmento `.` o `..` né una doppia barra.
_SEGMENTO_PUNTI = re.compile(r"(^|/)\.\.?(/|$)")


@dataclass(frozen=True)
class Sessione:
    """Chi chiama, e con quale token il backend agisce per lui.

    Il token viaggia con la richiesta e con nient'altro: nessuna cache lo tiene
    (`handlers/_container.py`), altrimenti il prossimo a chiedere agirebbe come
    il precedente. Fuori dalla rappresentazione, perché un token in un log vale
    quanto la sessione; e una dataclass, non una tupla, perché una tupla si
    spacchetta e si serializza, token compreso, senza che nessuno lo chieda."""

    utente_id: str
    token: str = field(repr=False)
    scade_il: datetime


def emittente_di(url_progetto: str) -> str:
    """L'`iss` dei token di un progetto: `https://<ref>.supabase.co/auth/v1`."""
    return f"{url_progetto.rstrip('/')}/auth/v1"


def verifica_token(
    token: str, chiave_per: Callable[[str], object | None], emittente: str
) -> Sessione | None:
    """La sessione che il token dimostra, o `None` se non ne dimostra nessuna.

    `chiave_per(kid)` restituisce la chiave pubblica con quell'id, o `None` se
    non la conosce. Un token senza `kid`, o con un `kid` sconosciuto, non vale.
    """
    try:
        intestazione = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        return None
    kid = intestazione.get("kid")
    if not isinstance(kid, str) or intestazione.get("alg") != ALGORITMO:
        return None
    chiave = chiave_per(kid)
    if chiave is None:
        return None

    try:
        payload = jwt.decode(
            token,
            chiave,  # type: ignore[arg-type]
            algorithms=[ALGORITMO],
            audience=PUBBLICO,
            issuer=emittente,
            options={"require": ["exp", "sub", "aud", "iss"], "verify_iat": False},
        )
    except jwt.PyJWTError:
        return None

    sub, scadenza, ruolo = payload.get("sub"), payload.get("exp"), payload.get("role")
    if not isinstance(sub, str) or not sub or ruolo != PUBBLICO or not isinstance(scadenza, int):
        return None
    # Assente vale «no» (i token vecchi non lo portano); qualunque valore che non
    # sia esattamente `false` vale «sì».
    if payload.get("is_anonymous", False) is not False:
        return None
    return Sessione(sub, token, datetime.fromtimestamp(scadenza, UTC))


def basta_per_un_lavoro_lungo(sessione: Sessione, adesso: datetime) -> bool:
    return sessione.scade_il - adesso >= MARGINE_LAVORO_LUNGO


def percorso_dell_utente(utente_id: str, percorso: str) -> bool:
    """Il percorso sta davvero nella cartella dell'utente?

    Lo controllano già i CHECK sulle tabelle e le policy dello Storage; qui lo si
    controlla prima di chiedere qualunque cosa, così una chiave sbagliata è un
    422 con un messaggio, non un 403 dallo Storage a metà di un'analisi. Dopo
    l'utente serve almeno un nome: la cartella stessa non è un file."""
    cartella, _, resto = percorso.partition("/")
    return (
        cartella == utente_id
        and resto != ""
        and _SEGMENTO_PUNTI.search(percorso) is None
        and "//" not in percorso
    )
