"""Errori di dominio.

Gli handler li traducono in status HTTP; il domain non sa cosa sia un 404.
"""

from __future__ import annotations


class ErroreDominio(Exception):
    """Radice di tutti gli errori previsti dal dominio."""

    codice = "errore_dominio"
    stato_http = 500


class RichiestaNonValida(ErroreDominio):
    codice = "richiesta_non_valida"
    stato_http = 422


class ConversazioneNonTrovata(ErroreDominio):
    codice = "conversazione_non_trovata"
    stato_http = 404

    def __init__(self, conversazione_id: str) -> None:
        super().__init__(f"Conversazione {conversazione_id} inesistente")
        self.conversazione_id = conversazione_id


class FotoNonTrovata(ErroreDominio):
    """La foto non c'è, o non è di chi la chiede: lo Storage, con il token di
    quella persona, risponde allo stesso modo nei due casi, e va bene così."""

    codice = "foto_non_trovata"
    stato_http = 404


class AccessoNegato(ErroreDominio):
    codice = "accesso_negato"
    stato_http = 403


class NonAutenticato(ErroreDominio):
    """Nessun token valido nella richiesta, o un token che non basta a quello
    che si chiede. Distinto da `RichiestaNonValida` (422): qui il corpo può
    essere perfetto, manca solo chi lo firma — è il segnale su cui l'app
    rinnova la sessione, o rimanda al login."""

    codice = "non_autenticato"
    stato_http = 401


class AccessoNonDisponibile(ErroreDominio):
    """Le chiavi pubbliche di Supabase Auth non si raggiungono, e senza non si
    verifica nessun token. Si chiude, non si apre: 503, non un passaggio libero."""

    codice = "accesso_non_disponibile"
    stato_http = 503


class ArchivioNonDisponibile(ErroreDominio):
    """Supabase (database o Storage) non risponde, o risponde con un errore che
    non è colpa di chi chiede. Il dettaglio va nei log, non al client."""

    codice = "archivio_non_disponibile"
    stato_http = 502


class LetturaNonValida(ErroreDominio):
    """Il modello di visione ha risposto qualcosa che non sappiamo usare."""

    codice = "lettura_non_valida"
    stato_http = 502

    def __init__(self, motivo: str, grezzo: str | None = None) -> None:
        super().__init__(motivo)
        self.motivo = motivo
        self.grezzo = grezzo


class SuggerimentoNonValido(ErroreDominio):
    """Lo stilista ha inventato capi, o ha risposto fuori formato."""

    codice = "suggerimento_non_valido"
    stato_http = 502

    def __init__(self, motivo: str, grezzo: str | None = None) -> None:
        super().__init__(motivo)
        self.motivo = motivo
        self.grezzo = grezzo


class ProviderSconosciuto(ErroreDominio):
    codice = "provider_sconosciuto"
    stato_http = 400

    def __init__(self, provider: str) -> None:
        super().__init__(f"Provider «{provider}» non registrato")
        self.provider = provider


class ProviderNonConfigurato(ErroreDominio):
    """Il provider esiste ma non ha una chiave: succede solo in sviluppo."""

    codice = "provider_non_configurato"
    stato_http = 503

    def __init__(self, provider: str) -> None:
        super().__init__(f"Provider «{provider}» senza credenziali")
        self.provider = provider


class ErroreProvider(ErroreDominio):
    codice = "errore_provider"
    stato_http = 502
