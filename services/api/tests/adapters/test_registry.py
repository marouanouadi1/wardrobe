"""Il registro dei provider: il catalogo espone prezzi coerenti, non a caso."""

from __future__ import annotations

from adapters.llm import anthropic_provider, google_provider, openai_provider
from adapters.llm.registry import catalogo


class TestCatalogo:
    def test_i_provider_a_listino_hanno_un_prezzo(self):
        modelli = catalogo()
        a_listino = {(anthropic_provider.NOME, id_) for id_ in anthropic_provider.PREZZI_USD} | {
            (openai_provider.NOME, id_) for id_ in openai_provider.PREZZI_USD
        }
        a_listino |= {(google_provider.NOME, id_) for id_ in google_provider.PREZZI_USD}

        for modello in modelli:
            if (modello.provider, modello.id) not in a_listino:
                continue
            assert modello.costo_input_eur_mtok is not None
            assert modello.costo_output_eur_mtok is not None
            assert modello.costo_input_eur_mtok > 0

    def test_ollama_costa_zero_non_none(self):
        modelli = catalogo()
        ollama = [m for m in modelli if m.provider == "ollama"]
        assert ollama
        for modello in ollama:
            assert modello.costo_input_eur_mtok == 0.0
            assert modello.costo_output_eur_mtok == 0.0
