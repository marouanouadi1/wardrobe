"""Le porte del dominio: cosa il dominio pretende dal mondo, non come.

Ogni Protocol qui dentro ha almeno due implementazioni: una vera in
`adapters/`, una finta in `tests/fakes.py`. È questa simmetria che rende i test
del dominio istantanei e senza rete.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Protocol, runtime_checkable

from pydantic import Field

from domain.models import (
    Capo,
    ConversazioneChat,
    EsitoAnalisi,
    MessaggioChat,
    ModelloDisponibile,
    ModelloWardrobe,
    Outfit,
    Profilo,
    Segnalazione,
    UploadFirmato,
    UsoToken,
    VoceElencoConversazioni,
)


class ImmagineLlm(ModelloWardrobe):
    media_type: str
    base64: str


class MessaggioLlm(ModelloWardrobe):
    """Un turno già avvenuto di una conversazione, da rimandare al modello.

    Serve solo alla chat vera: l'analisi foto e i suggerimenti restano
    one-shot e non la valorizzano mai.
    """

    ruolo: Literal["utente", "assistente"]
    testo: str


class RichiestaLlm(ModelloWardrobe):
    """Una chiamata a un modello, nella forma minima che ci serve.

    Deliberatamente povera: nessun tool calling. I due job di Wardrobe sono
    one-shot, e ogni feature in più qui è una feature da reimplementare per
    ogni provider nuovo. `cronologia` è l'unica eccezione: la chat continua ha
    bisogno di memoria, e passarla come turni già formati costa meno, a ogni
    provider, che reinventare un concetto di conversazione per ciascuno.
    """

    modello: str
    prompt: str
    system: str | None = None
    cronologia: list[MessaggioLlm] = Field(default_factory=list)
    immagini: list[ImmagineLlm] = Field(default_factory=list)
    temperatura: float = 0.4
    max_token: int = 1200
    forza_json: bool = True
    schema_atteso: dict[str, object] | None = Field(
        default=None,
        description="JSON Schema per gli structured output, quando il provider li supporta",
    )


class RispostaLlm(ModelloWardrobe):
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
    """Su disco se c'è `CARTELLA_FOTO`, in memoria altrimenti. Un dict nei test."""

    def url_upload(
        self, chiave: str, content_type: str, scade_in_s: int = 900
    ) -> UploadFirmato: ...

    def url_lettura(self, chiave: str, scade_in_s: int = 604_800) -> str: ...

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

    def elenca_messaggi_chat(
        self, utente_id: str, conversazione_id: str, limite: int = 200
    ) -> list[MessaggioChat]:
        """I turni di una conversazione, in ordine cronologico."""
        ...

    def salva_messaggio_chat(
        self, utente_id: str, conversazione_id: str, messaggio: MessaggioChat
    ) -> MessaggioChat: ...

    def elenca_conversazioni_chat(self, utente_id: str) -> list[VoceElencoConversazioni]:
        """Le conversazioni di un utente, dalla più recente."""
        ...

    def leggi_conversazione_chat(
        self, utente_id: str, conversazione_id: str
    ) -> ConversazioneChat | None:
        """`None` se non esiste o non è di questo utente: le due cose non si
        distinguono al chiamante, per non rivelare l'id di una conversazione
        altrui."""
        ...

    def salva_conversazione_chat(
        self, utente_id: str, conversazione: ConversazioneChat
    ) -> ConversazioneChat:
        """Idempotente su `id`: crea la prima volta, aggiorna `ultimo_turno_il`
        le successive."""
        ...

    def elimina_conversazione_chat(self, utente_id: str, conversazione_id: str) -> None:
        """Porta via anche i suoi turni: nessuna riga di `messaggi_chat` resta
        orfana."""
        ...

    # ── esiti dell'analisi inline ──────────────────────────────────────────
    def salva_esito_analisi(self, esito: EsitoAnalisi) -> None:
        """Sopravvive a un riavvio del processo: a differenza di un dict in
        memoria, il polling del client trova l'esito anche dopo un deploy."""
        ...

    def leggi_esito_analisi(self, esecuzione_id: str) -> EsitoAnalisi | None: ...

    # ── segnalazioni ────────────────────────────────────────────────────────
    def salva_segnalazione(self, segnalazione: Segnalazione) -> Segnalazione:
        """Idempotente su `id`: la stessa riga che nasce con POST /segnalazioni
        viene aggiornata da PATCH /segnalazioni/{id}, non duplicata."""
        ...

    def leggi_segnalazione(self, segnalazione_id: str) -> Segnalazione | None: ...

    def elenca_segnalazioni(self, utente_id: str) -> list[Segnalazione]:
        """Le segnalazioni di un solo utente, più recenti prima."""
        ...

    def elenca_tutte_segnalazioni(self) -> list[Segnalazione]:
        """Ogni segnalazione, di ogni utente: solo l'amministratore la chiama
        (vedi `handlers/segnalazioni.py`)."""
        ...


@runtime_checkable
class RepositoryUtenti(Protocol):
    """Le credenziali di login: un'identità, non un armadio — porta separata
    da `RepositoryArmadio` di proposito."""

    def trova_per_email(self, email: str) -> tuple[str, str] | None:
        """`(utente_id, hash_password)`, o `None` se l'email non esiste."""
        ...

    def crea(self, email: str, hash_password: str) -> str:
        """Crea l'utente e restituisce il suo id."""
        ...

    def trova_email(self, utente_id: str) -> str | None:
        """L'inverso di `crea`: serve solo a riconoscere l'amministratore
        (vedi `handlers/segnalazioni.py`) contro `EMAIL_AMMINISTRATORI`, la
        sola cosa per cui l'id da solo non basta."""
        ...


@runtime_checkable
class Orologio(Protocol):
    """Il tempo come dipendenza: «fermo da sei mesi» va testato senza attendere."""

    def adesso(self) -> datetime: ...

    def oggi(self) -> date: ...


@runtime_checkable
class GeneratoreId(Protocol):
    def nuovo(self) -> str: ...
