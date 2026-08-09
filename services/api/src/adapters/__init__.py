"""Adapter: qui e solo qui vivono gli SDK.

psycopg, httpx e l'SDK Anthropic stanno tutti dentro questa cartella.
Il vincolo non è una convenzione scritta in un README: `pyproject.toml` vieta
quegli import fuori da qui, e il lint fallisce se qualcuno prova.
"""
