"""Applica tutte le migrazioni in migrations/, in ordine, senza Docker né psql.

    uv run python scripts/applica_migrazioni.py

Ogni file è scritto con `create ... if not exists`, quindi rilanciarlo su un
database già aggiornato non fa danni: pensato per girare a ogni avvio (vedi
scripts/dev.sh), così una migrazione arrivata con l'ultimo `git pull` si
applica da sola — comodo soprattutto su Windows senza Docker, dove non c'è
`docker-entrypoint-initdb.d` a farlo per conto suo e `psql` non è quasi mai
sul PATH.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[1]

from dotenv import load_dotenv  # noqa: E402

load_dotenv(RADICE / ".env")

import psycopg  # noqa: E402


def main() -> None:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        # Modalità memoria (nessun DATABASE_URL in .env): niente da migrare.
        return

    file_sql = sorted((RADICE / "migrations").glob("*.sql"))
    if not file_sql:
        return

    try:
        with psycopg.connect(dsn, connect_timeout=5) as conn:
            for percorso in file_sql:
                conn.execute(percorso.read_text(encoding="utf-8"))
                print(f"  → {percorso.name}")
    except psycopg.OperationalError as exc:
        sys.exit(
            f"✗ non riesco a collegarmi a Postgres: {exc}\n"
            "  Controlla che il servizio sia avviato e che DATABASE_URL in .env sia corretto."
        )


if __name__ == "__main__":
    main()
