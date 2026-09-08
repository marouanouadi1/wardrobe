"""Errori di dominio.

Gli handler li traducono in status HTTP; il domain non sa cosa sia un 404.
"""

from __future__ import annotations


class ErroreDominio(Exception):
    """Radice di tutti gli errori previsti dal dominio."""

    codice = "errore_dominio"
    stato_http = 500


class CapoNonTrovato(ErroreDominio):
    codice = "capo_non_trovato"
    stato_http = 404

    def __init__(self, capo_id: str) -> None:
        super().__init__(f"Capo {capo_id} inesistente")
        self.capo_id = capo_id


class OutfitNonTrovato(ErroreDominio):
    codice = "outfit_non_trovato"
    stato_http = 404

    def __init__(self, outfit_id: str) -> None:
        super().__init__(f"Outfit {outfit_id} inesistente")
        self.outfit_id = outfit_id


class AnalisiNonTrovata(ErroreDominio):
    codice = "analisi_non_trovata"
    stato_http = 404

    def __init__(self, esecuzione_id: str) -> None:
        super().__init__(f"Analisi {esecuzione_id} inesistente")
        self.esecuzione_id = esecuzione_id


class RichiestaNonValida(ErroreDominio):
    codice = "richiesta_non_valida"
    stato_http = 422


class ConversazioneNonTrovata(ErroreDominio):
    codice = "conversazione_non_trovata"
    stato_http = 404

    def __init__(self, conversazione_id: str) -> None:
        super().__init__(f"Conversazione {conversazione_id} inesistente")
        self.conversazione_id = conversazione_id


class SegnalazioneNonTrovata(ErroreDominio):
    codice = "segnalazione_non_trovata"
    stato_http = 404

    def __init__(self, segnalazione_id: str) -> None:
        super().__init__(f"Segnalazione {segnalazione_id} inesistente")
        self.segnalazione_id = segnalazione_id


class AccessoNegato(ErroreDominio):
    codice = "accesso_negato"
    stato_http = 403


class CredenzialiNonValide(ErroreDominio):
    """Email inesistente o password sbagliata — stesso messaggio per
    entrambe, per non rivelare a un tentativo di accesso quali email esistono."""

    codice = "credenziali_non_valide"
    stato_http = 401


class NonAutenticato(ErroreDominio):
    """Nessun JWT valido nella richiesta. Distinto da `RichiestaNonValida`
    (422): qui il corpo può essere perfetto, manca solo chi lo firma — è
    il segnale su cui l'app decide se rimandare al login."""

    codice = "non_autenticato"
    stato_http = 401


class EmailGiaRegistrata(ErroreDominio):
    codice = "email_gia_registrata"
    stato_http = 409

    def __init__(self, email: str) -> None:
        super().__init__(f"«{email}» ha già un account")
        self.email = email


class RegistrazioneNonAmmessa(ErroreDominio):
    """L'email non è nell'allowlist (`EMAIL_AMMESSE`) — o l'allowlist è vuota,
    che significa registrazione chiusa del tutto."""

    codice = "registrazione_non_ammessa"
    stato_http = 403


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
