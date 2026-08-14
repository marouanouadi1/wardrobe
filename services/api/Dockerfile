# Immagine per il VPS: un processo Python always-on.
#
# Da python:3.12-slim (Docker Hub) e non dall'immagine ufficiale di uv
# (ghcr.io): un registro solo può essere bloccato da un firewall aziendale o
# da un VPS con l'egress ristretto, Docker Hub è il minimo comune denominatore.
FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
COPY src ./src
# scripts/applica_migrazioni.py serve dopo il primo deploy, quando il volume
# di Postgres non è più vuoto: docker-entrypoint-initdb.d (vedi
# docker-compose.yml) gira solo su un volume nuovo, non su un aggiornamento.
# Si lancia con `docker compose exec api python scripts/applica_migrazioni.py`.
COPY scripts ./scripts
COPY migrations ./migrations

RUN uv sync --no-dev

ENV PATH="/app/.venv/bin:$PATH"
# Senza, lo stdout bufferizzato a blocchi (non è un terminale) farebbe
# comparire `docker compose logs -f api` a scatti, con minuti di ritardo —
# stessa ragione già documentata in scripts/dev.sh per il caso locale.
ENV PYTHONUNBUFFERED=1

EXPOSE 8787

# Non "uv run": a runtime rifarebbe un sync includendo anche i pacchetti di
# sviluppo (mypy, ruff...) mai esclusi da un `--no-dev` sul comando `run`,
# scaricandoli a ogni avvio del container. Il venv è già completo dalla build:
# basta eseguirlo.
CMD ["python", "-m", "handlers.local_server"]
