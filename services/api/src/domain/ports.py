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
    EsecuzionePlayground,
    EsitoAnalisi,
    MessaggioChat,
    ModelloDisponibile,
    ModelloWardrobe,
    Outfit,
    PresetPrompt,
    Profilo,
    Segnalazione,
    UploadFirmato,
    UsoToken,
    Valutazione,
    ValutazioneImmagine,
)


class ImmagineLlm(ModelloWardrobe):
    media_type: str
    base64: str


class MessaggioLlm(ModelloWardrobe):
    """Un turno già avvenuto di una conversazione, da rimandare al modello.

    Serve solo alla chat vera: i due job del playground restano one-shot e non
    la valorizzano mai.
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
class ServizioGenerazioneImmagini(Protocol):
    """Rigenera o pulisce la foto di un capo: mai una persona.

    È il servizio che il banco immagini valuta (`scripts/genera_immagini.py`)
    — scope deciso apposta, vedi `tests/fixtures/campioni/GUIDA.md`: nessun
    virtual try-on, solo il capo.
    """

    def genera(self, contenuto: bytes, media_type: str, istruzioni: str, modello: str) -> bytes:
        """Restituisce l'immagine risultato. Solleva `ErroreProvider` se il
        servizio non torna con un'immagine."""
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

    def leggi_preset(self, preset_id: str) -> PresetPrompt | None:
        """`None` se non è mai stato salvato: il chiamante ricade sul default di fabbrica."""
        ...

    def salva_preset(self, preset: PresetPrompt) -> PresetPrompt: ...

    def elenca_messaggi_chat(self, utente_id: str, limite: int = 200) -> list[MessaggioChat]:
        """La chat continua di un utente, in ordine cronologico. Una sola, non a sessioni."""
        ...

    def salva_messaggio_chat(self, utente_id: str, messaggio: MessaggioChat) -> MessaggioChat: ...

    def salva_valutazione(self, valutazione: Valutazione) -> None:
        """Idempotente su (run_id, provider, modello, campione_id): rilanciare lo
        stesso modello sullo stesso campione dentro un run aggiorna la riga."""
        ...

    def elenca_valutazioni(self, run_id: str) -> list[Valutazione]: ...

    def ultimo_run_valutazione(self) -> str | None:
        """Il `run_id` più recente, o `None` se il banco non ha mai girato."""
        ...

    def salva_valutazione_immagine(self, valutazione: ValutazioneImmagine) -> None:
        """Idempotente su (run_id, servizio, modello, campione_id): lo script
        che genera l'immagine e la schermata che scrive il rating aggiornano
        la stessa riga, non ne creano due."""
        ...

    def elenca_valutazioni_immagini(self, run_id: str) -> list[ValutazioneImmagine]: ...

    def ultimo_run_valutazione_immagine(self) -> str | None: ...

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
