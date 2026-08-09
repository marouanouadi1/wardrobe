"""Login autofirmato: hash delle password e JWT, senza servizi terzi.

Per una beta a pochi utenti un fornitore di identità esterno non vale la
manutenzione in più. `bcrypt` e `pyjwt` non sono nella lista `banned-api` di
`pyproject.toml` (che vieta solo `psycopg`/`httpx` fuori da `adapters/`): non
sono un confine di I/O, sono calcolo puro, e possono vivere qui come il resto
del dominio.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import bcrypt
import jwt

ALGORITMO = "HS256"
DURATA_TOKEN_GIORNI = 30


def genera_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verifica_password(password: str, hash_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hash_password.encode("utf-8"))


def emetti_token(
    utente_id: str, segreto: str, adesso: datetime, durata_giorni: int = DURATA_TOKEN_GIORNI
) -> str:
    """Scade lontano apposta: pochi tester fidati, riaprire l'app spesso non
    deve chiedere ogni volta email e password."""
    scadenza = adesso + timedelta(days=durata_giorni)
    payload = {"sub": utente_id, "iat": int(adesso.timestamp()), "exp": int(scadenza.timestamp())}
    return jwt.encode(payload, segreto, algorithm=ALGORITMO)


def verifica_token(token: str, segreto: str) -> str | None:
    """`None` se il token è scaduto, malformato o firmato con un altro segreto."""
    try:
        payload = jwt.decode(
            token, segreto, algorithms=[ALGORITMO], options={"require": ["sub", "exp"]}
        )
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None
