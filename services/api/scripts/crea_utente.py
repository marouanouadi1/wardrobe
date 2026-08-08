"""Crea un utente per il login (email + password), senza self-signup pubblico.

    uv run python scripts/crea_utente.py socio@esempio.it

La password si digita al prompt, non come argomento — altrimenti resterebbe
nella cronologia della shell. Pensato per una beta a pochi utenti fidati: chi
li provisiona è chi gestisce il server, non un modulo di registrazione
raggiungibile da chiunque trovi l'URL.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RADICE / "src"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(RADICE / ".env")

from adapters.postgres import RepositoryPostgres  # noqa: E402
from domain.autenticazione import genera_hash  # noqa: E402


def _repository() -> RepositoryPostgres:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit(
            "manca DATABASE_URL: avvia Postgres con `npm run db:up` (o puntalo al VPS) e riprova"
        )
    return RepositoryPostgres(dsn=dsn)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    argomenti = parser.parse_args()

    password = getpass.getpass("Password: ")
    conferma = getpass.getpass("Ripeti la password: ")
    if password != conferma:
        raise SystemExit("le due password non coincidono")
    if len(password) < 8:
        raise SystemExit("password troppo corta (minimo 8 caratteri)")

    repo = _repository()
    if repo.trova_per_email(argomenti.email) is not None:
        raise SystemExit(f"esiste già un utente con email «{argomenti.email}»")

    utente_id = repo.crea(argomenti.email, genera_hash(password))
    print(f"Utente creato: {argomenti.email} (id {utente_id})")


if __name__ == "__main__":
    main()
