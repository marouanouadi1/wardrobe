"""Il registro dei provider: l'unico posto da toccare per aggiungerne uno.

Aggiungere un provider = un file in questa cartella + una riga qui. Nessuna
schermata, nessun handler, nessun modello di dominio cambia. È il punto di tutta
la struttura: «provo un altro modello» deve costare un file.
"""

from __future__ import annotations

from collections.abc import Callable

from adapters.llm import anthropic_provider, google_provider, ollama_provider, openai_provider
from domain.errors import ProviderSconosciuto
from domain.ports import ProviderLlm

_COSTRUTTORI: dict[str, Callable[[str | None], ProviderLlm]] = {
    anthropic_provider.NOME: anthropic_provider.ProviderAnthropic,
    openai_provider.NOME: openai_provider.ProviderOpenAI,
    google_provider.NOME: google_provider.ProviderGoogle,
    ollama_provider.NOME: ollama_provider.ProviderOllama,
}


def provider_per_nome(nome: str, chiave_override: str | None = None) -> ProviderLlm:
    costruttore = _COSTRUTTORI.get(nome)
    if costruttore is None:
        raise ProviderSconosciuto(nome)
    return costruttore(chiave_override)
