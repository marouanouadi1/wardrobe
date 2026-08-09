"""Composition root: qui e solo qui si sceglie quale adapter usare.

Sta in handlers/ e non in domain/ di proposito — è il posto dove il mondo entra.
Le istanze sono pigre e riusate fra chiamate: un processo a lungo termine
tiene aperta la stessa connessione invece di riaprirla ogni volta.
"""

from __future__ import annotations

import functools
import os
import uuid
from datetime import UTC, date, datetime

from domain.ports import (
    ArchivioFoto,
    GeneratoreId,
    Orologio,
    RepositoryArmadio,
    RepositoryUtenti,
    ServizioScontorno,
)


class OrologioDiSistema:
    def adesso(self) -> datetime:
        return datetime.now(UTC)

    def oggi(self) -> date:
        return datetime.now(UTC).date()


class IdCasuali:
    def nuovo(self) -> str:
        return uuid.uuid4().hex


def in_sviluppo() -> bool:
    return os.environ.get("DEV_MODE") == "1"


@functools.cache
def orologio() -> Orologio:
    return OrologioDiSistema()


@functools.cache
def generatore_id() -> GeneratoreId:
    return IdCasuali()


@functools.cache
def repository() -> RepositoryArmadio:
    """Postgres se c'è `DATABASE_URL`, altrimenti memoria.

    La versione in memoria è seminata con l'armadio del design: `npm run
    api:local` dà all'app un backend vero senza toccare Postgres. `DATABASE_URL`
    (Postgres via docker-compose, vedi `db:up`) è lo switch per i capi veri
    che devono sopravvivere a un riavvio. Il bypass di autenticazione è un
    flag a parte (`AUTH_APERTA`, vedi `_http.py`), indipendente da questa
    scelta.
    """
    if os.environ.get("DATABASE_URL"):
        from adapters.postgres import RepositoryPostgres

        return RepositoryPostgres(dsn=os.environ["DATABASE_URL"])

    from adapters.memory import RepositoryInMemoria

    return RepositoryInMemoria.con_semi()


@functools.cache
def repository_utenti() -> RepositoryUtenti:
    """Stessa scelta di `repository()`, ma per le credenziali di login: una
    porta separata, un'istanza separata di `RepositoryPostgres` (che
    implementa entrambi i Protocol) o di `RepositoryInMemoria`."""
    if os.environ.get("DATABASE_URL"):
        from adapters.postgres import RepositoryPostgres

        return RepositoryPostgres(dsn=os.environ["DATABASE_URL"])

    from adapters.memory import RepositoryInMemoria

    return RepositoryInMemoria()


@functools.cache
def archivio_foto() -> ArchivioFoto:
    """Su disco se c'è `CARTELLA_FOTO` (persistente, per usare l'app per
    davvero, in locale o su un VPS), in memoria altrimenti (si azzera ad ogni
    riavvio, comodo solo per provare)."""
    if os.environ.get("CARTELLA_FOTO"):
        from adapters.filesystem import ArchivioFileSystem

        return ArchivioFileSystem(os.environ["CARTELLA_FOTO"])

    from adapters.memory import ArchivioInMemoria

    return ArchivioInMemoria()


@functools.cache
def servizio_scontorno() -> ServizioScontorno | None:
    """`None` se non c'è una chiave: lo scontorno resta un passo facoltativo.

    Senza `FAL_KEY` la pipeline di analisi prosegue sulla foto originale
    invece di fallire — provare l'app non deve dipendere dall'aver già
    configurato un secondo provider oltre a quello di visione.
    """
    if not os.environ.get("FAL_KEY"):
        return None

    from adapters.scontorno.fal_provider import ServizioScontornoFal

    return ServizioScontornoFal()
