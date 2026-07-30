"""Le porte del dominio: cosa il dominio pretende dal mondo, non come.

Ogni Protocol qui dentro ha almeno due implementazioni: una vera in
`adapters/`, una finta in `tests/fakes.py`. È questa simmetria che rende i test
del dominio istantanei e senza AWS.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Protocol, runtime_checkable

from pydantic import Field

from domain.models import (
    Capo,
    EsecuzionePlayground,
    ModelloDisponibile,
    ModelloTela,
    Outfit,
    Profilo,
    UploadFirmato,
    UsoToken,
)


class ImmagineLlm(ModelloTela):
    media_type: str
    base64: str


class RichiestaLlm(ModelloTela):
    """Una chiamata a un modello, nella forma minima che ci serve.

    Deliberatamente povera: nessun concetto di conversazione, nessun tool
    calling. I due job di Tela sono one-shot, e ogni feature in più qui è una
    feature da reimplementare per ogni provider nuovo.
    """

    modello: str
    prompt: str
    system: str | None = None
    immagini: list[ImmagineLlm] = Field(default_factory=list)
    temperatura: float = 0.4
    max_token: int = 1200
    forza_json: bool = True
    schema_atteso: dict[str, object] | None = Field(
        default=None,
        description="JSON Schema per gli structured output, quando il provider li supporta",
    )


class RispostaLlm(ModelloTela):
    testo: str
    modello: str
    uso: UsoToken = UsoToken()
    latenza_ms: int = 0


@runtime_checkable
class ProviderLlm(Protocol):
    """Un provider di modelli. Aggiungerne uno = un file in adapters/llm/."""

    nome: str

    def modelli(self) -> list[ModelloDisponibile]: ...

    def completa(self, richiesta: RichiestaLlm) -> RispostaLlm: ...


@runtime_checkable
class ArchivioFoto(Protocol):
    """S3, in produzione. MinIO in locale. Un dict nei test."""

    def url_upload(
        self, chiave: str, content_type: str, scade_in_s: int = 900
    ) -> UploadFirmato: ...

    def url_lettura(self, chiave: str, scade_in_s: int = 3600) -> str: ...

    def leggi(self, chiave: str) -> tuple[bytes, str]:
        """Restituisce (contenuto, media_type)."""
        ...

    def salva(self, chiave: str, contenuto: bytes, media_type: str) -> None:
        """Scrive un contenuto derivato (es. la foto scontornata), non caricato dall'app."""
        ...


@runtime_checkable
class ServizioScontorno(Protocol):
    """Isola il capo dallo sfondo. Un provider esterno, quasi sempre.

    Vedi docs/adr/0004: è il passo che precede la lettura del modello di
    visione, non un servizio a parte — un capo già ritagliato è anche una foto
    più facile da leggere.
    """

    def scontorna(self, contenuto: bytes, media_type: str) -> bytes:
        """Restituisce un PNG con lo sfondo trasparente."""
        ...


@runtime_checkable
class RepositoryArmadio(Protocol):
    def elenca_capi(self, utente_id: str) -> list[Capo]: ...

    def leggi_capo(self, utente_id: str, capo_id: str) -> Capo | None: ...

    def salva_capo(self, utente_id: str, capo: Capo) -> Capo: ...

    def elimina_capo(self, utente_id: str, capo_id: str) -> None: ...

    def elenca_outfit(self, utente_id: str) -> list[Outfit]: ...

    def salva_outfit(self, utente_id: str, outfit: Outfit) -> Outfit: ...

    def leggi_profilo(self, utente_id: str) -> Profilo | None: ...

    def salva_profilo(self, profilo: Profilo) -> Profilo: ...

    def registra_uso(self, utente_id: str, capo_ids: list[str], giorno: date) -> None: ...

    def storico_playground(self, limite: int = 20) -> list[EsecuzionePlayground]: ...

    def salva_esecuzione_playground(self, esecuzione: EsecuzionePlayground) -> None: ...


@runtime_checkable
class Orologio(Protocol):
    """Il tempo come dipendenza: «fermo da sei mesi» va testato senza attendere."""

    def adesso(self) -> datetime: ...

    def oggi(self) -> date: ...


@runtime_checkable
class GeneratoreId(Protocol):
    def nuovo(self) -> str: ...
