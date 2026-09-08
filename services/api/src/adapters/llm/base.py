"""Quello che tutti i provider condividono: tempi, errori, chiavi."""

from __future__ import annotations

import os
import time
from collections.abc import Callable

import httpx

from domain.errors import ErroreProvider, ProviderNonConfigurato

TIMEOUT_S = float(os.environ.get("LLM_TIMEOUT_S", "60"))


def cronometra[T](azione: Callable[[], T]) -> tuple[T, int]:
    """Esegue e restituisce (risultato, millisecondi).

    La latenza la misuriamo noi, non la chiediamo al provider: è l'unico numero
    confrontabile fra provider diversi.
    """
    inizio = time.perf_counter()
    risultato = azione()
    return risultato, int((time.perf_counter() - inizio) * 1000)


def chiave(nome_provider: str, variabile: str, override: str | None = None) -> str:
    """La chiave del provider, dall'ambiente o da un override esplicito.

    In produzione la variabile viene impostata come variabile d'ambiente del
    processo (`.env` sul server); nessun chiamante di prodotto passa oggi un
    `override`, ma resta il punto per farlo senza toccare i provider.
    """
    valore = override or os.environ.get(variabile)
    if not valore:
        raise ProviderNonConfigurato(nome_provider)
    return valore


def client_http() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT_S)


def alza_se_errore(risposta: httpx.Response, nome_provider: str) -> None:
    if risposta.is_success:
        return
    # Il corpo dell'errore è la cosa più utile per capire cosa non è piaciuto:
    # lo tronchiamo ma non lo buttiamo.
    raise ErroreProvider(
        f"{nome_provider} ha risposto {risposta.status_code}: {risposta.text[:400]}"
    )
