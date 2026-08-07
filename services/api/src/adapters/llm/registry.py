"""Il registro dei provider: l'unico posto da toccare per aggiungerne uno.

Aggiungere un provider = un file in questa cartella + una riga qui. Nessuna
schermata, nessun handler, nessun modello di dominio cambia. È il punto di tutta
la struttura: «provo un altro modello» deve costare un file.
"""

from __future__ import annotations

import os
from collections.abc import Callable

from adapters.llm import anthropic_provider, google_provider, ollama_provider, openai_provider
from domain.errors import ProviderSconosciuto
from domain.models import ModelloDisponibile
from domain.ports import ProviderLlm

# I listini dei provider sono in dollari. Il tasso sta qui, in un posto solo,
# così i costi del playground sono confrontabili fra provider. È indicativo:
# serve a scegliere un modello, non a chiudere un bilancio.
TASSO_USD_EUR = float(os.environ.get("TASSO_USD_EUR", "0.92"))

_COSTRUTTORI: dict[str, Callable[[str | None], ProviderLlm]] = {
    anthropic_provider.NOME: anthropic_provider.ProviderAnthropic,
    openai_provider.NOME: openai_provider.ProviderOpenAI,
    google_provider.NOME: google_provider.ProviderGoogle,
    ollama_provider.NOME: ollama_provider.ProviderOllama,
}

# Un listino per provider, in dollari per milione di token (input, output).
# Ollama non c'è: il suo catalogo popola già 0.0 da sé (gira in locale, costa
# davvero zero) — un'informazione diversa da «non lo so», che è quella che
# `_con_prezzi` lascia intatta per ogni provider assente da questa mappa.
_PREZZI_PER_PROVIDER: dict[str, dict[str, tuple[float, float]]] = {
    anthropic_provider.NOME: anthropic_provider.PREZZI_USD,
    openai_provider.NOME: openai_provider.PREZZI_USD,
    google_provider.NOME: google_provider.PREZZI_USD,
}

_VARIABILI_CHIAVE = {
    anthropic_provider.NOME: anthropic_provider.VARIABILE_CHIAVE,
    openai_provider.NOME: openai_provider.VARIABILE_CHIAVE,
    google_provider.NOME: google_provider.VARIABILE_CHIAVE,
    ollama_provider.NOME: None,  # gira in locale, non ha credenziali
}


def provider_per_nome(nome: str, chiave_override: str | None = None) -> ProviderLlm:
    costruttore = _COSTRUTTORI.get(nome)
    if costruttore is None:
        raise ProviderSconosciuto(nome)
    return costruttore(chiave_override)


def configurato(nome: str) -> bool:
    variabile = _VARIABILI_CHIAVE.get(nome, "")
    if variabile is None:
        return True
    return bool(os.environ.get(variabile))


def catalogo() -> list[ModelloDisponibile]:
    """Tutti i modelli noti, con la spia «configurato» accesa o spenta.

    Elenchiamo anche i provider senza chiave: nel playground vedere che Gemini
    esiste ma non è configurato è informazione utile, non rumore.
    """
    modelli: list[ModelloDisponibile] = []
    modelli += anthropic_provider.catalogo(configurato(anthropic_provider.NOME))
    modelli += openai_provider.catalogo(configurato(openai_provider.NOME))
    modelli += google_provider.catalogo(configurato(google_provider.NOME))
    modelli += ollama_provider.catalogo()
    return [_con_prezzi(m) for m in modelli]


def scheda_modello(provider: str, modello: str) -> ModelloDisponibile | None:
    return next(
        (m for m in catalogo() if m.provider == provider and m.id == modello),
        None,
    )


def _con_prezzi(modello: ModelloDisponibile) -> ModelloDisponibile:
    """Converte in euro i listini che conosciamo, e lascia None gli altri.

    None non è zero: «non so quanto costa» e «costa zero» sono due risposte
    diverse, e nel confronto fra provider la differenza conta.
    """
    if modello.costo_input_eur_mtok is not None or modello.costo_output_eur_mtok is not None:
        return modello

    prezzo = _PREZZI_PER_PROVIDER.get(modello.provider, {}).get(modello.id)
    if prezzo is None:
        return modello

    ingresso, uscita = prezzo
    return modello.model_copy(
        update={
            "costo_input_eur_mtok": round(ingresso * TASSO_USD_EUR, 4),
            "costo_output_eur_mtok": round(uscita * TASSO_USD_EUR, 4),
        }
    )
