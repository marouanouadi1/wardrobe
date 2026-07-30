"""La chat vera: un handler sottile sopra domain.chat, con memoria per utente.

Non riverifica le regole dello stilista (già coperte da test_stylist.py e
test_playground.py): verifica che i due turni si salvino, che la cronologia
arrivi davvero al provider al messaggio successivo, e che il preset salvato
nel playground sia quello che la chat usa.
"""

from __future__ import annotations

import json

import pytest

from fakes import ProviderFinto
from handlers import chat, playground


def _evento(*, corpo: dict[str, object] | None = None, utente: str = "demo") -> dict[str, object]:
    return {
        "headers": {"x-utente": utente},
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
    monkeypatch.setattr(chat, "_provider", lambda nome: finto)
    return finto


class TestChat:
    def test_un_messaggio_produce_due_turni_salvati(self, monkeypatch: pytest.MonkeyPatch):
        _monkeypatch_provider(monkeypatch, _risposta_modello())

        risposta = chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None)
        assert risposta["statusCode"] == 200
        dati = _corpo(risposta)
        assert dati["utente"]["testo"] == "Cosa metto oggi?"
        assert dati["tela"]["suggerimenti"][0]["titolo"] == "Comodo per l'ufficio"

        storia = _corpo(chat.elenca(_evento(), None))["messaggi"]
        assert [m["ruolo"] for m in storia] == ["utente", "tela"]

    def test_il_secondo_messaggio_porta_la_cronologia_del_primo(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        finto = _monkeypatch_provider(monkeypatch, _risposta_modello())

        chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None)
        chat.invia(_evento(corpo={"testo": "Fa più freddo, cambia"}), None)

        # La seconda chiamata al provider deve portare con sé i due turni
        # della prima: è la memoria che distingue la chat vera dalla finta.
        ultima_richiesta = finto.richieste[-1]
        assert len(ultima_richiesta.cronologia) == 2
        assert ultima_richiesta.cronologia[0].ruolo == "utente"
        assert ultima_richiesta.cronologia[0].testo == "Cosa metto oggi?"
        assert ultima_richiesta.cronologia[1].ruolo == "assistente"

    def test_la_cronologia_e_per_utente(self, monkeypatch: pytest.MonkeyPatch):
        _monkeypatch_provider(monkeypatch, _risposta_modello())

        chat.invia(_evento(corpo={"testo": "Ciao"}, utente="a"), None)
        assert _corpo(chat.elenca(_evento(utente="b"), None))["messaggi"] == []

    def test_usa_il_prompt_salvato_nel_playground(self, monkeypatch: pytest.MonkeyPatch):
        finto = _monkeypatch_provider(monkeypatch, _risposta_modello())
        playground.salva_preset(
            _evento(
                corpo={
                    "id": "suggeritore-mattina",
                    "etichetta": "Suggeritore mattina",
                    "job": "suggerimento",
                    "system_prompt": "Prompt di prova salvato dal playground.",
                    "temperatura": 0.1,
                    "max_token": 500,
                }
            ),
            None,
        )

        chat.invia(_evento(corpo={"testo": "Ciao"}), None)

        assert finto.richieste[-1].system == "Prompt di prova salvato dal playground."
        assert finto.richieste[-1].temperatura == 0.1

    def test_una_risposta_fuori_formato_lascia_comunque_lo_storico_coerente(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        # Il modello risponde fuori contratto: l'handler propaga l'errore di
        # dominio (stesso comportamento di /suggerimenti), ma il messaggio
        # dell'utente resta salvato — ha comunque chiesto qualcosa.
        _monkeypatch_provider(monkeypatch, "non riesco a rispondere")

        risposta = chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None)
        assert risposta["statusCode"] >= 400

        storia = _corpo(chat.elenca(_evento(), None))["messaggi"]
        assert [m["ruolo"] for m in storia] == ["utente"]
