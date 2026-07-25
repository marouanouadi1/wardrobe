"""Le controparti finte delle porte del dominio.

Ogni Protocol in `domain.ports` ha due implementazioni: una vera in `adapters/`
e una qui. Questi oggetti non sono mock generati: sono venti righe di codice che
si leggono, e quando un test fallisce si capisce perché.
"""

from __future__ import annotations

from datetime import date, datetime

from domain.models import ModelloDisponibile, UsoToken
from domain.ports import RichiestaLlm, RispostaLlm


class OrologioFermo:
    """Il tempo come dipendenza: «fermo da sei mesi» diventa verificabile."""

    def __init__(self, adesso: datetime) -> None:
        self._adesso = adesso

    def adesso(self) -> datetime:
        return self._adesso

    def oggi(self) -> date:
        return self._adesso.date()


class IdPrevedibili:
    def __init__(self, prefisso: str = "id") -> None:
        self._prefisso = prefisso
        self._contatore = 0

    def nuovo(self) -> str:
        self._contatore += 1
        return f"{self._prefisso}-{self._contatore}"


class ProviderFinto:
    """Risponde quello che gli dici, e ricorda cosa gli è stato chiesto."""

    nome = "finto"

    def __init__(self, testo: str = "{}", *, errore: Exception | None = None) -> None:
        self._testo = testo
        self._errore = errore
        self.richieste: list[RichiestaLlm] = []

    def modelli(self) -> list[ModelloDisponibile]:
        return [
            ModelloDisponibile(
                provider=self.nome, id="finto-1", etichetta="Finto", visione=True, configurato=True
            )
        ]

    def completa(self, richiesta: RichiestaLlm) -> RispostaLlm:
        self.richieste.append(richiesta)
        if self._errore is not None:
            raise self._errore
        return RispostaLlm(
            testo=self._testo,
            modello=richiesta.modello,
            uso=UsoToken(token_input=1000, token_output=500),
            latenza_ms=42,
        )
