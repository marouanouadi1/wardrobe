"""La pipeline di analisi in linea: lo scontorno prima della lettura.

Verifica solo la parte che ho aggiunto — lo scontorno è un miglioramento, non
un requisito, e deve restare tale anche quando fallisce o non è configurato.
Il resto della pipeline (interpretazione della lettura, soglie) è già coperto
da `tests/domain/test_vision.py`.
"""

from __future__ import annotations

import json

import pytest

from conftest import LETTURA_BUONA, intestazioni_utente
from domain.errors import ErroreProvider
from fakes import ProviderFinto
from handlers import _container, analisi


def _evento_http(
    *, corpo: dict[str, object] | None = None, percorso: dict[str, str] | None = None
) -> dict[str, object]:
    return {
        "headers": intestazioni_utente(),
        "pathParameters": percorso or {},
        "body": json.dumps(corpo) if corpo is not None else "",
    }


class ServizioScontornoFinto:
    """Non chiama nessun servizio vero: restituisce bytes fissi, o fallisce a comando."""

    def __init__(self, *, fallisce: bool = False) -> None:
        self.fallisce = fallisce
        self.chiamate = 0

    def scontorna(self, contenuto: bytes, media_type: str) -> bytes:
        del contenuto, media_type
        self.chiamate += 1
        if self.fallisce:
            raise ErroreProvider("scontorno finto: non riuscito")
        return b"PNG-SCONTORNATO"


def _evento() -> dict[str, object]:
    return {
        "utente_id": "demo",
        "chiave_foto": "capi/demo/analisi.jpg",
        "provider": "finto",
        "modello": None,
    }


def _monkeypatch_provider_visione(monkeypatch: pytest.MonkeyPatch) -> None:
    from adapters.llm import registry

    monkeypatch.setattr(
        registry,
        "provider_per_nome",
        lambda nome, chiave_override=None: ProviderFinto(json.dumps(LETTURA_BUONA)),
    )


class TestAnalizza:
    def test_senza_servizio_di_scontorno_analizza_l_originale(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        _container.archivio_foto().salva("capi/demo/analisi.jpg", b"JPEG-ORIGINALE", "image/jpeg")
        monkeypatch.setattr(_container, "servizio_scontorno", lambda: None)
        _monkeypatch_provider_visione(monkeypatch)

        risultato = analisi.analizza(_evento())
        assert risultato["chiave_scontornata"] is None
        assert risultato["lettura"]

    def test_con_scontorno_riuscito_salva_la_foto_derivata_e_la_usa(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        _container.archivio_foto().salva("capi/demo/analisi.jpg", b"JPEG-ORIGINALE", "image/jpeg")
        finto = ServizioScontornoFinto()
        monkeypatch.setattr(_container, "servizio_scontorno", lambda: finto)
        _monkeypatch_provider_visione(monkeypatch)

        risultato = analisi.analizza(_evento())
        assert risultato["chiave_scontornata"] == "capi/demo/analisi.jpg-scontornata"
        assert finto.chiamate == 1
        contenuto, _ = _container.archivio_foto().leggi(risultato["chiave_scontornata"])
        assert contenuto == b"PNG-SCONTORNATO"

    def test_se_lo_scontorno_fallisce_lo_step_prosegue_sull_originale(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        _container.archivio_foto().salva("capi/demo/analisi.jpg", b"JPEG-ORIGINALE", "image/jpeg")
        finto = ServizioScontornoFinto(fallisce=True)
        monkeypatch.setattr(_container, "servizio_scontorno", lambda: finto)
        _monkeypatch_provider_visione(monkeypatch)

        risultato = analisi.analizza(_evento())
        assert risultato["chiave_scontornata"] is None
        # Il modello ha comunque letto qualcosa: un servizio esterno che non
        # risponde non deve far fallire tutta la pipeline di analisi.
        assert risultato["lettura"]


class TestStatoConUrlFirmato:
    """`avvia`/`stato` restituiscono il capo appena analizzato, non solo
    quello riletto dall'armadio: senza `foto.url` firmato l'app non lo mostra
    finché non riavvia e rifà il fetch dell'armadio da zero."""

    def test_il_capo_dell_analisi_completata_ha_l_url_della_foto(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        _container.archivio_foto().salva("capi/demo/analisi.jpg", b"JPEG-ORIGINALE", "image/jpeg")
        monkeypatch.setattr(_container, "servizio_scontorno", lambda: None)
        _monkeypatch_provider_visione(monkeypatch)

        avviata = analisi.avvia(_evento_http(corpo={"chiave_foto": "capi/demo/analisi.jpg"}), None)
        assert avviata["statusCode"] == 202
        esecuzione_id = json.loads(avviata["body"])["esecuzione_id"]

        risposta = analisi.stato(_evento_http(percorso={"esecuzioneId": esecuzione_id}), None)
        dati = json.loads(risposta["body"])
        assert dati["stato"] == "completata"
        assert dati["capo"]["foto"]["url"]
