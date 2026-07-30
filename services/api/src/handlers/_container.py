"""Composition root: qui e solo qui si sceglie quale adapter usare.

Sta in handlers/ e non in domain/ di proposito — è il posto dove il mondo entra.
Le istanze sono pigre e riusate fra invocazioni: su Lambda il container vive
quanto il container di esecuzione, ed è esattamente il comportamento che vogliamo
per le connessioni.
"""

from __future__ import annotations

import functools
import os
import uuid
from datetime import UTC, date, datetime

from domain.ports import ArchivioFoto, GeneratoreId, Orologio, RepositoryArmadio, ServizioScontorno


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
    """Postgres in cloud, Postgres locale se c'è `DATABASE_URL`, altrimenti memoria.

    La versione in memoria è seminata con l'armadio del design: `npm run
    api:local` dà all'app un backend vero senza toccare AWS. `DATABASE_URL`
    (Postgres via docker-compose, vedi `db:up`) è lo switch per i capi veri
    che devono sopravvivere a un riavvio — indipendente da `DEV_MODE`, che
    resta acceso per l'header `X-Utente` in locale (vedi `archivio_foto`,
    stesso schema di scelta indipendente dal `BUCKET_FOTO`).
    """
    if os.environ.get("DATABASE_URL"):
        from adapters.postgres import RepositoryPostgres

        return RepositoryPostgres(dsn=os.environ["DATABASE_URL"])

    if in_sviluppo():
        from adapters.memory import RepositoryInMemoria

        return RepositoryInMemoria.con_semi()

    from adapters.postgres import RepositoryPostgres

    return RepositoryPostgres(
        dsn_secret_arn=os.environ["DB_SECRET_ARN"],
        regione=os.environ.get("AWS_REGION", "eu-south-1"),
    )


@functools.cache
def archivio_foto() -> ArchivioFoto:
    """Su disco se c'è `CARTELLA_FOTO` (persistente, per usare l'app per
    davvero), in memoria altrimenti in sviluppo (si azzera ad ogni riavvio,
    comodo solo per provare), S3 in cloud."""
    if in_sviluppo() and os.environ.get("CARTELLA_FOTO"):
        from adapters.filesystem import ArchivioFileSystem

        return ArchivioFileSystem(os.environ["CARTELLA_FOTO"])

    if in_sviluppo() and not os.environ.get("BUCKET_FOTO"):
        from adapters.memory import ArchivioInMemoria

        return ArchivioInMemoria()

    from adapters.s3 import ArchivioS3

    return ArchivioS3(bucket=os.environ["BUCKET_FOTO"])


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
