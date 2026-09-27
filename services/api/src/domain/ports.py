"""Le porte del dominio: cosa il dominio pretende dal mondo, non come.

Ogni Protocol qui dentro ha almeno due implementazioni: una vera in
`adapters/`, una finta in `tests/fakes.py`. È questa simmetria che rende i test
del dominio istantanei e senza rete.

**L'archivio e il repository agiscono come l'utente** (ADR 0010): un'istanza nasce
per una sessione, con il suo token, e quello che vede lo decide l'RLS di
Supabase, non un filtro scritto qui. Per questo i metodi non prendono un
`utente_id`: non c'è un altro utente a cui chiedere.
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
    UsoToken,
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
class Archivio(Protocol):
    """Un bucket dello Storage, visto da chi chiama: legge e scrive solo nella sua
    cartella (`{utente_id}/…`), perché così dicono le policy di Storage."""

    def leggi(self, percorso: str) -> tuple[bytes, str]:
        """Restituisce (contenuto, media_type). `FotoNonTrovata` se non c'è, o
        se non è di chi chiede: per lui le due cose non si distinguono."""
        ...

    def salva(self, percorso: str, contenuto: bytes, media_type: str) -> None:
        """Scrive, sovrascrivendo se c'è già: la foto scontornata, lo zip di
        un'esportazione."""
        ...

    def firma_lettura(self, percorso: str, scade_in_s: int) -> str:
        """Un indirizzo che apre il file senza token, per `scade_in_s` secondi."""
        ...


@runtime_checkable
class ChiaviAuth(Protocol):
    """Le chiavi pubbliche con cui Supabase Auth firma i token (il JWKS del
    progetto). `domain/accesso.py` verifica; questa porta dice solo con quale
    chiave."""

    def chiave(self, kid: str) -> object | None:
        """La chiave con quell'id, o `None` se non la conosce.
        `AccessoNonDisponibile` se non riesce a saperlo affatto."""
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
    """L'armadio di chi chiama, come lo serve PostgREST con il suo token. Serve
    all'IA: leggere i capi e il profilo, creare il capo che l'analisi ha letto,
    tenere la chat, raccogliere l'esportazione. Il resto l'app lo legge e lo
    scrive da sé (ADR 0010)."""

    def elenca_capi(self) -> list[Capo]: ...

    def crea_capo(self, capo: Capo) -> Capo:
        """Il capo nato da un'analisi. Lo slot lo calcola il database dal tipo."""
        ...

    def leggi_profilo(self) -> Profilo | None: ...

    def elenca_outfit(self) -> list[Outfit]: ...

    def elenca_segnalazioni(self) -> list[Segnalazione]:
        """Solo le proprie, anche per l'amministratore, che l'RLS lascerebbe
        vedere tutte: serve all'esportazione, che è dei dati di chi la chiede."""
        ...

    # ── esiti dell'analisi ─────────────────────────────────────────────────
    def registra_esito_analisi(self, esito: EsitoAnalisi) -> None:
        """L'esito, scritto **una volta sola**, a lavoro finito: completata con il
        suo capo, oppure fallita con il motivo. Un esito aperto prima e chiuso
        dopo resterebbe «in corso» per sempre a ogni analisi interrotta — da un
        deploy, da un Supabase che non risponde alla seconda scrittura."""
        ...

    # ── chat ───────────────────────────────────────────────────────────────
    def leggi_conversazione_chat(self, conversazione_id: str) -> ConversazioneChat | None:
        """`None` se non esiste o non è di chi chiede: per lui le due cose non si
        distinguono, e l'id di una conversazione altrui non si rivela."""
        ...

    def crea_conversazione_chat(self, conversazione: ConversazioneChat) -> ConversazioneChat: ...

    def elenca_conversazioni_chat(self) -> list[ConversazioneChat]:
        """Dalla più recente."""
        ...

    def elenca_messaggi_chat(self, conversazione_id: str, limite: int = 200) -> list[MessaggioChat]:
        """Gli ultimi `limite` turni di una conversazione, in ordine cronologico."""
        ...

    def salva_messaggi_chat(
        self, conversazione_id: str, messaggi: list[MessaggioChat]
    ) -> list[MessaggioChat]:
        """I turni nuovi, **in una scrittura sola**: la domanda e la risposta
        entrano insieme o non entra nessuna delle due, e lo storico non resta mai
        con una domanda senza risposta. La conversazione sale in cima da sé (un
        trigger)."""
        ...


@runtime_checkable
class Orologio(Protocol):
    """Il tempo come dipendenza: «fermo da sei mesi» va testato senza attendere."""

    def adesso(self) -> datetime: ...

    def oggi(self) -> date: ...


@runtime_checkable
class GeneratoreId(Protocol):
    def nuovo(self) -> str: ...
