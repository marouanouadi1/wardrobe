"""POST /chat: un handler sottile sopra domain.chat, con memoria per utente.

Non riverifica le regole dello stilista (già coperte da test_stylist.py):
verifica che i due turni si salvino, che la cronologia arrivi davvero al
provider al messaggio successivo, e che la conversazione di un altro non si
raggiunga. Lo storico l'app lo legge da sé da Supabase (ADR 0010): qui lo si
guarda nel deposito finto.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta

import pytest

from adapters.llm import registry
from conftest import ADESSO, Supabase, costruisci_capo, intestazioni_utente
from domain.chat import SYSTEM_PROMPT_CHAT, TEMPERATURA_CHAT
from domain.models import TipoCapo
from fakes import ProviderFinto
from handlers import chat


def _evento(*, corpo: dict[str, object], utente: str = "demo") -> dict[str, object]:
    return {"headers": intestazioni_utente(utente), "body": json.dumps(corpo)}


@pytest.fixture(autouse=True)
def _capi_di_prova(supabase: Supabase) -> None:
    """Il finto LLM propone sempre gli id t1/b1/s1 (vedi `_risposta_modello`):
    senza questi capi veri nell'armadio di «demo», `proposte_tolleranti` li
    scarterebbe come inventati, e ogni turno arriverebbe senza proposte."""
    supabase.deposito.capi["demo"] = [
        costruisci_capo("t1", TipoCapo.TOP),
        costruisci_capo("b1", TipoCapo.PANTALONI),
        costruisci_capo("s1", TipoCapo.SCARPE),
    ]


def _corpo(risposta: dict[str, object]) -> dict[str, object]:
    return json.loads(str(risposta["body"]))


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


def _storia(supabase: Supabase, utente: str = "demo") -> list[str]:
    return [m.ruolo.value for turni in supabase.deposito.messaggi[utente].values() for m in turni]


class TestChat:
    def test_un_messaggio_produce_due_turni_salvati(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase
    ):
        _monkeypatch_provider(monkeypatch, _risposta_modello())

        risposta = chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None)

        assert risposta["statusCode"] == 200
        dati = _corpo(risposta)
        assert dati["utente"]["testo"] == "Cosa metto oggi?"  # type: ignore[index]
        assert dati["wardrobe"]["suggerimenti"][0]["titolo"] == "Comodo per l'ufficio"  # type: ignore[index]
        assert _storia(supabase) == ["utente", "wardrobe"]

    def test_il_turno_dello_stilista_viene_dopo_quello_dell_utente(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase
    ):
        """Con la stessa ora per i due turni, l'ordine nello storico sarebbe un
        pareggio: il database li ordina per `creato_il`. L'orologio avanza di un
        secondo a ogni lettura, così un pareggio si vede."""
        _monkeypatch_provider(monkeypatch, _risposta_modello())
        letture = iter(range(100))

        class OrologioCheAvanza:
            def adesso(self) -> datetime:
                return ADESSO + timedelta(seconds=next(letture))

            def oggi(self) -> date:
                return ADESSO.date()

        monkeypatch.setattr(chat, "orologio", OrologioCheAvanza)

        chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None)

        (turni,) = supabase.deposito.messaggi["demo"].values()
        assert [t.ruolo.value for t in turni] == ["utente", "wardrobe"]
        assert turni[0].creato_il < turni[1].creato_il

    def test_il_secondo_messaggio_porta_la_cronologia_del_primo(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        finto = _monkeypatch_provider(monkeypatch, _risposta_modello())

        prima = _corpo(chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None))
        conversazione_id = prima["conversazione"]["id"]  # type: ignore[index]
        chat.invia(
            _evento(corpo={"testo": "Fa più freddo, cambia", "conversazione_id": conversazione_id}),
            None,
        )

        # La seconda chiamata al provider deve portare con sé i due turni
        # della prima: è la memoria che distingue la chat vera dalla finta.
        ultima_richiesta = finto.richieste[-1]
        assert len(ultima_richiesta.cronologia) == 2
        assert ultima_richiesta.cronologia[0].ruolo == "utente"
        assert ultima_richiesta.cronologia[0].testo == "Cosa metto oggi?"
        assert ultima_richiesta.cronologia[1].ruolo == "assistente"

    def test_senza_conversazione_id_ogni_invio_apre_una_conversazione_nuova(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase
    ):
        _monkeypatch_provider(monkeypatch, _risposta_modello())

        prima = _corpo(chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None))
        seconda = _corpo(chat.invia(_evento(corpo={"testo": "E domani?"}), None))

        assert prima["conversazione"]["id"] != seconda["conversazione"]["id"]  # type: ignore[index]
        assert len(supabase.deposito.conversazioni["demo"]) == 2

    def test_usa_il_prompt_e_la_temperatura_di_dominio(self, monkeypatch: pytest.MonkeyPatch):
        finto = _monkeypatch_provider(monkeypatch, _risposta_modello())

        chat.invia(_evento(corpo={"testo": "Ciao"}), None)

        assert finto.richieste[-1].system == SYSTEM_PROMPT_CHAT
        assert finto.richieste[-1].temperatura == TEMPERATURA_CHAT

    def test_una_risposta_senza_proposte_e_comunque_una_risposta_valida(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase
    ):
        # «Grazie» non ha bisogno di un outfit: proposte assenti non è un
        # errore per la chat, a differenza di /suggerimenti.
        _monkeypatch_provider(
            monkeypatch, json.dumps({"risposta": "Figurati, a domani!", "proposte": None})
        )

        risposta = chat.invia(_evento(corpo={"testo": "Grazie!"}), None)

        assert risposta["statusCode"] == 200
        dati = _corpo(risposta)
        assert dati["wardrobe"]["testo"] == "Figurati, a domani!"  # type: ignore[index]
        assert dati["wardrobe"]["suggerimenti"] == []  # type: ignore[index]
        assert _storia(supabase) == ["utente", "wardrobe"]

    def test_una_risposta_fuori_formato_non_lascia_niente(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase
    ):
        # Il modello non ha prodotto un JSON recuperabile: l'handler propaga
        # l'errore di dominio, e non salva né il messaggio dell'utente — una
        # domanda senza risposta confonderebbe il turno successivo — né una
        # conversazione vuota da cancellare a mano.
        _monkeypatch_provider(monkeypatch, "non riesco a rispondere")

        risposta = chat.invia(_evento(corpo={"testo": "Cosa metto oggi?"}), None)

        assert risposta["statusCode"] >= 400
        assert _storia(supabase) == []
        assert supabase.deposito.conversazioni["demo"] == {}


class TestCorpo:
    def test_un_corpo_senza_testo_e_un_422_e_non_chiama_il_modello(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase
    ):
        finto = _monkeypatch_provider(monkeypatch, _risposta_modello())

        risposta = chat.invia(_evento(corpo={"conversazione_id": None}), None)

        assert risposta["statusCode"] == 422
        assert _corpo(risposta)["errore"] == "richiesta_non_valida"
        assert finto.richieste == []
        assert _storia(supabase) == []


class TestConversazioneAltrui:
    def test_la_conversazione_di_un_altro_utente_e_un_404(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase
    ):
        """Il repository nasce per la sessione di chi chiama: per «b» la
        conversazione di «a» non esiste, e non si distingue da un id inventato."""
        _monkeypatch_provider(monkeypatch, _risposta_modello())
        risposta = _corpo(chat.invia(_evento(corpo={"testo": "Ciao"}, utente="a"), None))
        conversazione_id = risposta["conversazione"]["id"]  # type: ignore[index]

        da_b = chat.invia(
            _evento(corpo={"testo": "Intruso", "conversazione_id": conversazione_id}, utente="b"),
            None,
        )

        assert da_b["statusCode"] == 404
        assert _corpo(da_b)["errore"] == "conversazione_non_trovata"
        assert _storia(supabase, "a") == ["utente", "wardrobe"]
        assert _storia(supabase, "b") == []

    def test_un_conversazione_id_inesistente_e_un_404(self, monkeypatch: pytest.MonkeyPatch):
        _monkeypatch_provider(monkeypatch, _risposta_modello())

        risposta = chat.invia(
            _evento(
                corpo={
                    "testo": "Continua",
                    "conversazione_id": "00000000-0000-4000-8000-0000000000ff",
                }
            ),
            None,
        )

        assert risposta["statusCode"] == 404
        assert _corpo(risposta)["errore"] == "conversazione_non_trovata"
