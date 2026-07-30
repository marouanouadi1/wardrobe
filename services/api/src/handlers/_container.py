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
    """Postgres in cloud, memoria in locale.

    La versione in memoria è seminata con l'armadio del design: `npm run
    api:local` dà all'app un backend vero senza toccare AWS.
    """
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
