"""POST /capi/analisi: la foto dallo Storage, la lettura, il capo, l'esito.

Il deposito finto tiene i dati per utente, come farebbe l'RLS: un'analisi
lanciata da A sulla foto di B non la trova. L'interpretazione della lettura e le
soglie sono già in `tests/domain/test_vision.py`: qui si guarda la pipeline.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest

from conftest import LETTURA_BUONA, Supabase, intestazioni_utente
from domain.accesso import Sessione
from domain.errors import ErroreProvider
from domain.models import StatoAnalisi
from fakes import ProviderFinto
from handlers import _container, analisi

A = "00000000-0000-4000-8000-00000000000a"
B = "00000000-0000-4000-8000-00000000000b"
FOTO_DI_A = f"{A}/capi/2026-09-27/camicia.jpg"


def _evento(chiave_foto: str = FOTO_DI_A, **intestazioni: timedelta) -> dict[str, object]:
    return {
        "headers": intestazioni_utente(A, **intestazioni),
        "body": json.dumps({"chiave_foto": chiave_foto, "provider": "finto"}),
    }


def _corpo(risposta: dict[str, object]) -> dict[str, object]:
    return json.loads(str(risposta["body"]))


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


@pytest.fixture
def provider(monkeypatch: pytest.MonkeyPatch) -> ProviderFinto:
    from adapters.llm import registry

    finto = ProviderFinto(json.dumps(LETTURA_BUONA))
    monkeypatch.setattr(registry, "provider_per_nome", lambda nome, chiave_override=None: finto)
    return finto


@pytest.fixture
def foto_di_a(supabase: Supabase) -> None:
    supabase.deposito.file[("foto", FOTO_DI_A)] = (b"JPEG", "image/jpeg")


class TestAnalisi:
    def test_il_percorso_felice_crea_il_capo_e_chiude_l_esito(
        self, supabase: Supabase, provider: ProviderFinto, foto_di_a: None
    ):
        risposta = analisi.avvia(_evento(), None)

        assert risposta["statusCode"] == 202
        esecuzione = str(_corpo(risposta)["esecuzione_id"])
        esito = supabase.deposito.esiti[A][esecuzione]
        assert esito.stato is StatoAnalisi.COMPLETATA
        (capo,) = supabase.deposito.capi[A]
        assert esito.capo is not None and esito.capo.id == capo.id
        assert capo.foto.chiave == FOTO_DI_A
        assert capo.analisi is not None and capo.analisi.provider == "finto"
        assert provider.richieste, "il modello di visione è stato interrogato"

    def test_la_foto_di_un_altro_e_un_422_e_non_tocca_niente(
        self, supabase: Supabase, provider: ProviderFinto
    ):
        supabase.deposito.file[("foto", f"{B}/capi/x.jpg")] = (b"JPEG", "image/jpeg")

        risposta = analisi.avvia(_evento(f"{B}/capi/x.jpg"), None)

        assert risposta["statusCode"] == 422
        assert supabase.deposito.esiti[A] == {}
        assert supabase.deposito.capi[A] == [] and supabase.deposito.capi[B] == []
        assert provider.richieste == []

    def test_risalire_con_i_punti_e_lo_stesso_rifiuto(self, provider: ProviderFinto):
        risposta = analisi.avvia(_evento(f"{A}/../{B}/capi/x.jpg"), None)
        assert risposta["statusCode"] == 422

    def test_una_foto_che_non_c_e_chiude_l_esito_come_fallito(
        self, supabase: Supabase, provider: ProviderFinto
    ):
        risposta = analisi.avvia(_evento(f"{A}/capi/sparita.jpg"), None)

        assert risposta["statusCode"] == 202
        (esito,) = supabase.deposito.esiti[A].values()
        assert esito.stato is StatoAnalisi.FALLITA
        assert esito.errore and "non c'è" in esito.errore
        assert supabase.deposito.capi[A] == []

    def test_una_sessione_che_sta_per_scadere_e_un_401_prima_di_cominciare(
        self, supabase: Supabase, provider: ProviderFinto, foto_di_a: None
    ):
        risposta = analisi.avvia(_evento(scade_tra=timedelta(minutes=2)), None)

        assert risposta["statusCode"] == 401
        assert supabase.deposito.esiti[A] == {}

    def test_un_errore_imprevisto_chiude_l_esito_senza_dettagli(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase, foto_di_a: None
    ):
        from adapters.llm import registry

        guasto = ProviderFinto(errore=RuntimeError("stack trace del provider"))
        monkeypatch.setattr(
            registry, "provider_per_nome", lambda nome, chiave_override=None: guasto
        )

        analisi.avvia(_evento(), None)

        (esito,) = supabase.deposito.esiti[A].values()
        assert esito.stato is StatoAnalisi.FALLITA
        assert esito.errore and "stack trace" not in esito.errore


class TestProvider:
    """Senza il provider finto: il registro vero, che rifiuta prima di spendere."""

    def _evento_con(self, provider: str) -> dict[str, object]:
        return {
            "headers": intestazioni_utente(A),
            "body": json.dumps({"chiave_foto": FOTO_DI_A, "provider": provider}),
        }

    def test_un_provider_che_non_esiste_chiude_l_esito_con_il_motivo(
        self, supabase: Supabase, foto_di_a: None
    ):
        analisi.avvia(self._evento_con("inesistente"), None)

        (esito,) = supabase.deposito.esiti[A].values()
        assert esito.stato is StatoAnalisi.FALLITA
        assert esito.errore and "inesistente" in esito.errore
        assert supabase.deposito.capi[A] == []

    def test_un_provider_senza_chiave_chiude_l_esito_con_il_motivo(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase, foto_di_a: None
    ):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

        analisi.avvia(self._evento_con("anthropic"), None)

        (esito,) = supabase.deposito.esiti[A].values()
        assert esito.stato is StatoAnalisi.FALLITA
        assert esito.errore and "senza credenziali" in esito.errore


class TestScontorno:
    def test_senza_servizio_di_scontorno_analizza_l_originale(
        self, supabase: Supabase, provider: ProviderFinto, foto_di_a: None
    ):
        analisi.avvia(_evento(), None)

        (capo,) = supabase.deposito.capi[A]
        assert capo.foto.chiave_scontornata is None
        assert provider.richieste[0].immagini[0].media_type == "image/jpeg"

    def test_lo_scontorno_scrive_nella_stessa_cartella_e_si_legge_quello(
        self,
        monkeypatch: pytest.MonkeyPatch,
        supabase: Supabase,
        provider: ProviderFinto,
        foto_di_a: None,
    ):
        scontorno = ServizioScontornoFinto()
        monkeypatch.setattr(analisi, "servizio_scontorno", lambda: scontorno)

        analisi.avvia(_evento(), None)

        derivata = f"{FOTO_DI_A}-scontornata"
        assert supabase.deposito.file[("foto", derivata)] == (b"PNG-SCONTORNATO", "image/png")
        (capo,) = supabase.deposito.capi[A]
        assert capo.foto.chiave_scontornata == derivata
        assert provider.richieste[0].immagini[0].media_type == "image/png"

    def test_se_lo_scontorno_fallisce_si_prosegue_sull_originale(
        self,
        monkeypatch: pytest.MonkeyPatch,
        supabase: Supabase,
        provider: ProviderFinto,
        foto_di_a: None,
    ):
        monkeypatch.setattr(
            analisi, "servizio_scontorno", lambda: ServizioScontornoFinto(fallisce=True)
        )

        risposta = analisi.avvia(_evento(), None)

        assert _corpo(risposta)["stato"] == StatoAnalisi.COMPLETATA.value
        (capo,) = supabase.deposito.capi[A]
        assert capo.foto.chiave_scontornata is None


class TestContainer:
    """Il test che nessun altro farebbe diventare rosso: un repository in cache
    darebbe al prossimo chiamante il token del precedente."""

    def test_non_mette_in_cache_ne_il_repository_ne_l_archivio(self):
        assert not hasattr(_container.repository, "cache_clear")
        assert not hasattr(_container.archivio, "cache_clear")

    def test_ogni_sessione_chiede_a_supabase_con_il_suo_token_e_niente_d_altri(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """Il pool si condivide, lo stato no: un cookie che una risposta imposta ad
        A non riparte con la richiesta di B."""
        import httpx

        import adapters.supabase

        visti: list[tuple[str, str | None]] = []

        def rispondi(richiesta: httpx.Request) -> httpx.Response:
            visti.append((richiesta.headers["authorization"], richiesta.headers.get("cookie")))
            biscotto = {"set-cookie": "sb-sessione=di-a; Path=/"}
            if "/storage/" in richiesta.url.path:
                return httpx.Response(
                    200, content=b"x", headers={"content-type": "image/jpeg", **biscotto}
                )
            return httpx.Response(200, json=[], headers=biscotto)

        trasporto = httpx.MockTransport(rispondi)
        monkeypatch.setattr(adapters.supabase, "trasporto_condiviso", lambda: trasporto)
        di_a = Sessione(A, "token-di-a", datetime.now(UTC) + timedelta(hours=1))
        di_b = Sessione(B, "token-di-b", datetime.now(UTC) + timedelta(hours=1))

        _container.repository(di_a).elenca_capi()
        _container.repository(di_b).elenca_capi()
        _container.archivio(di_a, _container.BUCKET_FOTO).leggi(FOTO_DI_A)
        _container.archivio(di_b, _container.BUCKET_FOTO).leggi(f"{B}/capi/x.jpg")

        assert visti == [("Bearer token-di-a", None), ("Bearer token-di-b", None)] * 2
