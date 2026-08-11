"""GET /dev/valutazioni: la tabella del banco letta dal repository.

Non riverifica `aggrega` (già coperto da test_valutazione.py): verifica solo
che l'handler scelga il run giusto — l'ultimo se non specificato — e che un
banco mai girato non sia un errore.
"""

from __future__ import annotations

import json
from datetime import timedelta

from conftest import ADESSO, intestazioni_utente
from domain.models import EsitoEsecuzione, Valutazione, ValutazioneImmagine
from handlers import playground
from handlers._container import repository


def _evento(*, run: str | None = None, corpo: dict[str, object] | None = None) -> dict[str, object]:
    return {
        "headers": intestazioni_utente(),
        "pathParameters": {},
        "queryStringParameters": {"run": run} if run else {},
        "body": json.dumps(corpo) if corpo is not None else "",
    }


def _corpo(risposta: dict[str, object]) -> dict[str, object]:
    return json.loads(risposta["body"])  # type: ignore[no-any-return, arg-type]


def _valutazione(
    run_id: str, modello: str, *, accuratezza: float, dopo_minuti: int = 0
) -> Valutazione:
    return Valutazione(
        id=f"{run_id}-{modello}",
        run_id=run_id,
        eseguita_il=ADESSO + timedelta(minutes=dopo_minuti),
        campione_id="c01",
        provider="anthropic",
        modello=modello,
        latenza_ms=500,
        esito=EsitoEsecuzione.OK,
        accuratezza=accuratezza,
    )


class TestValutazioni:
    def test_nessun_run_e_una_risposta_vuota_non_un_errore(self):
        risposta = playground.valutazioni(_evento(), None)
        corpo = _corpo(risposta)
        assert risposta["statusCode"] == 200
        assert corpo == {"righe": [], "valutazioni": []}

    def test_senza_run_prende_l_ultimo(self):
        repository().salva_valutazione(_valutazione("run-1", "claude-opus-5", accuratezza=0.5))
        repository().salva_valutazione(
            _valutazione("run-2", "claude-opus-5", accuratezza=1.0, dopo_minuti=5)
        )

        corpo = _corpo(playground.valutazioni(_evento(), None))

        assert corpo["run_id"] == "run-2"
        assert len(corpo["righe"]) == 1
        assert corpo["righe"][0]["accuratezza_media"] == 1.0

    def test_con_run_esplicito_prende_quello(self):
        repository().salva_valutazione(_valutazione("run-1", "claude-opus-5", accuratezza=0.5))
        repository().salva_valutazione(_valutazione("run-2", "claude-opus-5", accuratezza=1.0))

        corpo = _corpo(playground.valutazioni(_evento(run="run-1"), None))

        assert corpo["run_id"] == "run-1"
        assert corpo["righe"][0]["accuratezza_media"] == 0.5


def _valutazione_immagine(
    run_id: str, modello: str, campione_id: str = "c01", *, dopo_minuti: int = 0
) -> ValutazioneImmagine:
    return ValutazioneImmagine(
        id=f"{run_id}-{modello}-{campione_id}",
        run_id=run_id,
        eseguita_il=ADESSO + timedelta(minutes=dopo_minuti),
        campione_id=campione_id,
        servizio="google",
        modello=modello,
        chiave_immagine=f"valutazioni/{run_id}/{campione_id}-{modello}.jpg",
        costo_eur=0.06,
        latenza_ms=4000,
    )


class TestImmagini:
    def test_nessun_run_e_una_risposta_vuota_non_un_errore(self):
        corpo = _corpo(playground.immagini(_evento(), None))
        assert corpo == {"valutazioni": []}

    def test_senza_run_prende_l_ultimo(self):
        repository().salva_valutazione_immagine(_valutazione_immagine("run-img-1", "modello-a"))
        repository().salva_valutazione_immagine(
            _valutazione_immagine("run-img-2", "modello-a", dopo_minuti=5)
        )

        corpo = _corpo(playground.immagini(_evento(), None))

        assert corpo["run_id"] == "run-img-2"
        assert len(corpo["valutazioni"]) == 1

    def test_la_chiave_immagine_arriva_come_url_firmato(self):
        repository().salva_valutazione_immagine(_valutazione_immagine("run-img-1", "modello-a"))

        corpo = _corpo(playground.immagini(_evento(), None))

        assert corpo["valutazioni"][0]["url"]
        assert "valutazioni/run-img-1/c01-modello-a.jpg" in corpo["valutazioni"][0]["url"]


class TestVotaImmagine:
    def test_assegna_il_rating_alla_riga_esistente(self):
        repository().salva_valutazione_immagine(_valutazione_immagine("run-img-1", "modello-a"))

        corpo = _corpo(
            playground.vota_immagine(
                _evento(
                    corpo={
                        "run_id": "run-img-1",
                        "servizio": "google",
                        "modello": "modello-a",
                        "campione_id": "c01",
                        "rating": {"fedelta_colore": 5, "pulizia": 4, "artefatti": 5},
                    }
                ),
                None,
            )
        )

        assert corpo["rating"] == {"fedelta_colore": 5, "pulizia": 4, "artefatti": 5}

        rilette = repository().elenca_valutazioni_immagini("run-img-1")
        assert rilette[0].rating is not None
        assert rilette[0].rating.fedelta_colore == 5

    def test_non_si_puo_votare_un_immagine_mai_generata(self):
        risposta = playground.vota_immagine(
            _evento(
                corpo={
                    "run_id": "run-inesistente",
                    "servizio": "google",
                    "modello": "modello-a",
                    "campione_id": "c01",
                    "rating": {"fedelta_colore": 5, "pulizia": 4, "artefatti": 5},
                }
            ),
            None,
        )
        assert risposta["statusCode"] == 422
        assert _corpo(risposta)["errore"] == "richiesta_non_valida"
