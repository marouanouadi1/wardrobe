"""La chat vera: un handler sottile sopra domain.chat, con memoria per utente.

Non riverifica le regole dello stilista (già coperte da test_stylist.py):
verifica che i due turni si salvino e che la cronologia arrivi davvero al
provider al messaggio successivo.
"""

from __future__ import annotations

import json

import pytest

from adapters.llm import registry
from conftest import costruisci_capo, intestazioni_utente
from domain.chat import SYSTEM_PROMPT_CHAT, TEMPERATURA_CHAT
from domain.models import TipoCapo
from fakes import ProviderFinto
from handlers import chat
from handlers._container import repository


def _evento(*, corpo: dict[str, object] | None = None, utente: str = "demo") -> dict[str, object]:
    return {
        "headers": intestazioni_utente(utente),
        "pathParameters": {},
        "queryStringParameters": {},
        "body": json.dumps(corpo) if corpo is not None else "",
    }


@pytest.fixture(autouse=True)
def _capi_di_prova() -> None:
    """Il finto LLM propone sempre gli id t1/b1/s1 (vedi `_risposta_modello`):
    senza questi capi veri nell'armadio di «demo», `proposte_tolleranti` li
    scarterebbe come inventati, e ogni turno arriverebbe senza proposte."""
    for capo in (
        costruisci_capo("t1", TipoCapo.TOP),
        costruisci_capo("b1", TipoCapo.PANTALONI),
        costruisci_capo("s1", TipoCapo.SCARPE),
    ):
        repository().salva_capo("demo", capo)


def _corpo(risposta: dict[str, object]) -> object:
    return json.loads(risposta["body"])


def _risposta_modello(match: int = 88) -> str:
    return json.dumps(
        {
            "risposta": "Ti direi questo, comodo per l'ufficio.",
            "proposte": [
                {
                    "titolo": "Comodo per l'ufficio",
                    "match": match,
                    "capi": ["t1", "b1", "s1"],
                    "perche": ["motivo uno", "motivo due"],
                }
            ],
        }
    )


def _monkeypatch_provider(monkeypatch: pytest.MonkeyPatch, testo: str) -> ProviderFinto:
    finto = ProviderFinto(testo)
    monkeypatch.setattr(registry, "provider_per_nome", lambda nome, chiave_override=None: finto)
    return finto


class TestChat:
    def test_un_messaggio_produce_due_turni_salvati(self, monkeypatch: pytest.MonkeyPatch):
        _monkeypatch_provider(monkeypatch, _risposta_modello())

        risposta = chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None)
        assert risposta["statusCode"] == 200
        dati = _corpo(risposta)
        assert dati["utente"]["testo"] == "Cosa metto oggi?"
        assert dati["wardrobe"]["suggerimenti"][0]["titolo"] == "Comodo per l'ufficio"

        storia = _corpo(chat.elenca(_evento(), None))["messaggi"]
        assert [m["ruolo"] for m in storia] == ["utente", "wardrobe"]

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

    def test_usa_il_prompt_e_la_temperatura_di_dominio(self, monkeypatch: pytest.MonkeyPatch):
        finto = _monkeypatch_provider(monkeypatch, _risposta_modello())

        chat.invia(_evento(corpo={"testo": "Ciao"}), None)

        assert finto.richieste[-1].system == SYSTEM_PROMPT_CHAT
        assert finto.richieste[-1].temperatura == TEMPERATURA_CHAT

    def test_una_risposta_senza_proposte_e_comunque_una_risposta_valida(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        # «Grazie» non ha bisogno di un outfit: proposte assenti non è un
        # errore per la chat, a differenza di /suggerimenti.
        _monkeypatch_provider(
            monkeypatch, json.dumps({"risposta": "Figurati, a domani!", "proposte": None})
        )

        risposta = chat.invia(_evento(corpo={"testo": "Grazie!"}), None)
        assert risposta["statusCode"] == 200
        dati = _corpo(risposta)
        assert dati["wardrobe"]["testo"] == "Figurati, a domani!"
        assert dati["wardrobe"]["suggerimenti"] == []

        storia = _corpo(chat.elenca(_evento(), None))["messaggi"]
        assert [m["ruolo"] for m in storia] == ["utente", "wardrobe"]

    def test_una_risposta_fuori_formato_non_lascia_niente_di_orfano(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        # Il modello non ha prodotto un JSON recuperabile: l'handler propaga
        # l'errore di dominio, e stavolta non salva nemmeno il messaggio
        # dell'utente — altrimenti resterebbe una domanda senza risposta a
        # confondere il turno successivo.
        _monkeypatch_provider(monkeypatch, "non riesco a rispondere")

        risposta = chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None)
        assert risposta["statusCode"] >= 400

        storia = _corpo(chat.elenca(_evento(), None))["messaggi"]
        assert storia == []
