"""POST /suggerimenti — l'handler, non le regole dello stilista.

Le regole di validazione (capo inventato, slot doppio, ecc.) sono già coperte
da `tests/domain/test_stylist.py`: qui si verifica solo che l'handler assembli
il contesto, chiami il provider giusto e traduca gli errori di dominio in uno
status HTTP — la rotta non aveva nessuna copertura prima di questo file.
"""

from __future__ import annotations

import json

import pytest

from adapters.llm import registry
from conftest import costruisci_capo, intestazioni_utente
from domain.models import TipoCapo
from fakes import ProviderFinto
from handlers import suggerimenti
from handlers._container import repository


def _evento(*, corpo: dict[str, object] | None = None, utente: str = "demo") -> dict[str, object]:
    return {
        "headers": intestazioni_utente(utente),
        "pathParameters": {},
        "queryStringParameters": {},
        "body": json.dumps(corpo) if corpo is not None else "",
    }


def _corpo(risposta: dict[str, object]) -> object:
    return json.loads(risposta["body"])


def _risposta_modello(match: int = 88) -> str:
    return json.dumps(
        {
            "proposte": [
                {
                    "titolo": "Comodo per l'ufficio",
                    "match": match,
                    "capi": ["t1", "b1", "s1"],
                    "perche": ["motivo uno", "motivo due"],
                }
            ]
        }
    )


def _monkeypatch_provider(monkeypatch: pytest.MonkeyPatch, testo: str) -> ProviderFinto:
    finto = ProviderFinto(testo)
    monkeypatch.setattr(registry, "provider_per_nome", lambda nome, chiave_override=None: finto)
    return finto


class TestProponi:
    def test_il_percorso_felice_torna_le_proposte(self, monkeypatch: pytest.MonkeyPatch):
        for capo in (
            costruisci_capo("t1", TipoCapo.TOP),
            costruisci_capo("b1", TipoCapo.PANTALONI),
            costruisci_capo("s1", TipoCapo.SCARPE),
        ):
            repository().salva_capo("demo", capo)
        _monkeypatch_provider(monkeypatch, _risposta_modello())

        risposta = suggerimenti.proponi(_evento(corpo={"numero_proposte": 3}), None)

        assert risposta["statusCode"] == 200
        dati = _corpo(risposta)
        assert dati["suggerimenti"][0]["titolo"] == "Comodo per l'ufficio"
        assert dati["provider"] == "finto"

    def test_un_armadio_senza_capi_e_un_502_col_motivo_giusto(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        # Un chiamante diretto dell'API (l'app vera non ci arriva più: vedi
        # `apps/mobile/app/(tabs)/oggi.tsx`, che non chiama con un armadio
        # senza capi disponibili). Fissa il contratto per quel caso, non il
        # comportamento che l'utente vede.
        _monkeypatch_provider(monkeypatch, '{"proposte": []}')

        risposta = suggerimenti.proponi(_evento(corpo={"numero_proposte": 3}), None)

        assert risposta["statusCode"] == 502
        dati = _corpo(risposta)
        assert dati["errore"] == "suggerimento_non_valido"
        assert "capo disponibile" in dati["messaggio"]
