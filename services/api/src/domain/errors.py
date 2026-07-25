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


class RichiestaNonValida(ErroreDominio):
    codice = "richiesta_non_valida"
    stato_http = 422


class AccessoNegato(ErroreDominio):
    codice = "accesso_negato"
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
