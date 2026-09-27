"""Composition root: qui e solo qui si sceglie quale adapter usare.

Sta in handlers/ e non in domain/ di proposito — è il posto dove il mondo entra.

**Cosa sta in cache e cosa no** (ADR 0010). In cache, per tutta la vita del
processo, solo ciò che non conosce nessun utente: le chiavi pubbliche dell'Auth,
l'orologio, il generatore di id, i servizi esterni — e il pool HTTP, che vive
nell'adapter (`adapters/supabase.trasporto_condiviso`). Il
repository e l'archivio **no**: nascono per una sessione, con il suo token, e
servono solo quella richiesta. Un `@functools.cache` su di loro darebbe al
prossimo chiamante il token del precedente — ogni test verde, e i dati di una
persona a un'altra.
"""

from __future__ import annotations

import functools
import os
import uuid
from datetime import UTC, date, datetime

from domain.accesso import Sessione
from domain.ports import (
    Archivio,
    ChiaviAuth,
    GeneratoreId,
    Orologio,
    RepositoryArmadio,
    ServizioScontorno,
)

#: I due bucket di supabase/migrations/: le foto dei capi, e gli zip di «Scarica
#: i tuoi dati».
BUCKET_FOTO = "foto"
BUCKET_ESPORTAZIONI = "esportazioni"


class OrologioDiSistema:
    def adesso(self) -> datetime:
        return datetime.now(UTC)

    def oggi(self) -> date:
        return datetime.now(UTC).date()


class IdCasuali:
    """Uuid nella forma con i trattini: è quella che il database restituisce, e
    un id confrontato con sé stesso in due grafie non sarebbe uguale."""

    def nuovo(self) -> str:
        return str(uuid.uuid4())


def url_progetto() -> str:
    return os.environ["SUPABASE_URL"]


def chiave_pubblica() -> str:
    """La chiave publishable: pubblica per costruzione, sta anche nell'APK.
    Identifica il progetto; chi è l'utente lo dice il suo token."""
    return os.environ["SUPABASE_CHIAVE_PUBBLICA"]


@functools.cache
def orologio() -> Orologio:
    return OrologioDiSistema()


@functools.cache
def generatore_id() -> GeneratoreId:
    return IdCasuali()


@functools.cache
def chiavi_auth() -> ChiaviAuth:
    from adapters.supabase import ChiaviAuthSupabase

    return ChiaviAuthSupabase(url_progetto())


def repository(sessione: Sessione) -> RepositoryArmadio:
    """L'armadio di chi chiama, con il suo token. Non in cache: vedi sopra."""
    from adapters.supabase import RepositorySupabase

    return RepositorySupabase(sessione, url_progetto(), chiave_pubblica())


def archivio(sessione: Sessione, bucket: str) -> Archivio:
    """Un bucket dello Storage, con il token di chi chiama. Non in cache."""
    from adapters.supabase import ArchivioSupabase

    return ArchivioSupabase(sessione, bucket, url_progetto(), chiave_pubblica())


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
