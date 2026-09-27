"""`adapters/supabase.py` contro un Supabase finto: `httpx.MockTransport`.

Nessuna rete. Si guarda cosa l'adapter **chiede** — l'indirizzo, i filtri, le
intestazioni con il token di chi chiama — e come **traduce** le risposte: le righe
in modelli, gli errori in errori di dominio. Che l'RLS faccia il suo lavoro lo
provano i test pgTAP contro il database vero.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from adapters.supabase import (
    ArchivioSupabase,
    ChiaviAuthSupabase,
    RepositorySupabase,
    capo_da_riga,
    riga_da_capo,
)
from conftest import CHIAVI, costruisci_capo
from domain.accesso import Sessione
from domain.errors import (
    AccessoNegato,
    AccessoNonDisponibile,
    ArchivioNonDisponibile,
    FotoNonTrovata,
    NonAutenticato,
    RichiestaNonValida,
)

URL = "https://progetto-di-prova.supabase.co"
CHIAVE = "sb_publishable_di_prova"
A = "00000000-0000-4000-8000-00000000000a"
SESSIONE = Sessione(A, "token-di-a", datetime.now(UTC) + timedelta(hours=1))

Gestore = Callable[[httpx.Request], httpx.Response]


class Registro:
    """Un Supabase finto che risponde come gli si dice, e ricorda cosa ha ricevuto."""

    def __init__(self, gestore: Gestore) -> None:
        self.richieste: list[httpx.Request] = []
        self._gestore = gestore

    def client(self) -> httpx.Client:
        def rispondi(richiesta: httpx.Request) -> httpx.Response:
            self.richieste.append(richiesta)
            return self._gestore(richiesta)

        return httpx.Client(transport=httpx.MockTransport(rispondi))


def _riga_capo(**altro: Any) -> dict[str, Any]:
    riga = riga_da_capo(costruisci_capo("10000000-0000-4000-8000-00000000000a"))
    return {**riga, "utente_id": A, "slot": "top", **altro}


def _repository(gestore: Gestore) -> tuple[RepositorySupabase, Registro]:
    registro = Registro(gestore)
    return RepositorySupabase(SESSIONE, URL, CHIAVE, registro.client()), registro


class TestRighe:
    def test_un_capo_va_e_torna_uguale(self):
        capo = costruisci_capo("10000000-0000-4000-8000-00000000000a")
        riga = {**riga_da_capo(capo), "utente_id": A, "slot": capo.slot.value}

        assert capo_da_riga(riga) == capo

    def test_l_inserimento_non_manda_lo_slot_ne_l_utente(self):
        """`slot` è una colonna generata, e il database la rifiuta se la si
        manda; `utente_id` lo prende dal token."""
        riga = riga_da_capo(costruisci_capo("c1"))
        assert "slot" not in riga
        assert "utente_id" not in riga

    def test_un_capo_senza_analisi_resta_senza(self):
        riga = _riga_capo(analisi_provider=None, analisi_eseguita_il=None)
        assert capo_da_riga(riga).analisi is None


class TestPostgrest:
    def test_chiede_con_la_chiave_pubblica_e_il_token_di_chi_chiama(self):
        repository, registro = _repository(lambda r: httpx.Response(200, json=[_riga_capo()]))

        (capo,) = repository.elenca_capi()

        (richiesta,) = registro.richieste
        assert richiesta.url.path == "/rest/v1/capi"
        assert richiesta.headers["apikey"] == CHIAVE
        assert richiesta.headers["authorization"] == "Bearer token-di-a"
        assert richiesta.url.params["utente_id"] == f"eq.{A}"
        assert capo.id == "10000000-0000-4000-8000-00000000000a"

    def test_le_segnalazioni_sono_solo_le_proprie_anche_per_l_amministratore(self):
        repository, registro = _repository(lambda r: httpx.Response(200, json=[]))

        repository.elenca_segnalazioni()

        assert registro.richieste[0].url.params["utente_id"] == f"eq.{A}"

    def test_un_profilo_assente_e_none(self):
        repository, _ = _repository(lambda r: httpx.Response(200, json=[]))
        assert repository.leggi_profilo() is None

    def test_una_conversazione_che_non_si_vede_e_none(self):
        repository, registro = _repository(lambda r: httpx.Response(200, json=[]))

        assert repository.leggi_conversazione_chat("k1") is None
        assert registro.richieste[0].url.params["id"] == "eq.k1"

    def test_i_messaggi_tornano_in_ordine_cronologico(self):
        righe = [
            {
                "id": "m2",
                "ruolo": "wardrobe",
                "testo": "b",
                "suggerimenti": [],
                "creato_il": "2026-09-27T10:01:00+00:00",
            },
            {
                "id": "m1",
                "ruolo": "utente",
                "testo": "a",
                "suggerimenti": [],
                "creato_il": "2026-09-27T10:00:00+00:00",
            },
        ]
        repository, registro = _repository(lambda r: httpx.Response(200, json=righe))

        messaggi = repository.elenca_messaggi_chat("k1", limite=2)

        assert [m.id for m in messaggi] == ["m1", "m2"]
        assert registro.richieste[0].url.params["order"] == "creato_il.desc"
        assert registro.richieste[0].url.params["limit"] == "2"

    def test_crea_un_capo_chiedendo_la_riga_scritta(self):
        def rispondi(richiesta: httpx.Request) -> httpx.Response:
            return httpx.Response(
                201, json=[{**json.loads(richiesta.content), "utente_id": A, "slot": "top"}]
            )

        repository, registro = _repository(rispondi)
        capo = costruisci_capo("10000000-0000-4000-8000-00000000000a")

        assert repository.crea_capo(capo) == capo
        assert registro.richieste[0].method == "POST"
        assert registro.richieste[0].headers["prefer"] == "return=representation"

    def test_un_esito_si_scrive_una_volta_sola_con_lo_stato_finale(self):
        from domain.models import EsitoAnalisi, StatoAnalisi

        repository, registro = _repository(lambda r: httpx.Response(201, json=[{}]))

        repository.registra_esito_analisi(
            EsitoAnalisi(esecuzione_id="e1", stato=StatoAnalisi.FALLITA, errore="niente luce")
        )

        (richiesta,) = registro.richieste
        assert richiesta.method == "POST"
        assert richiesta.url.path == "/rest/v1/analisi_esiti"
        assert json.loads(richiesta.content) == {
            "id": "e1",
            "stato": "fallita",
            "capo_id": None,
            "errore": "niente luce",
        }

    def test_i_due_turni_della_chat_sono_una_scrittura_sola(self):
        """Un array in una POST: per PostgREST un'istruzione sola, cioè una
        transazione. Due POST lascerebbero una domanda senza risposta se cadesse
        la seconda."""
        from domain.models import MessaggioChat, RuoloChat

        def rispondi(richiesta: httpx.Request) -> httpx.Response:
            # Il database le restituisce in un ordine suo: il repository le
            # rimette in quello chiesto.
            return httpx.Response(201, json=list(reversed(json.loads(richiesta.content))))

        repository, registro = _repository(rispondi)
        adesso = datetime(2026, 9, 27, 10, 0, tzinfo=UTC)
        turni = [
            MessaggioChat(id="m1", ruolo=RuoloChat.UTENTE, testo="Ciao", creato_il=adesso),
            MessaggioChat(
                id="m2",
                ruolo=RuoloChat.WARDROBE,
                testo="Ciao a te",
                creato_il=adesso + timedelta(seconds=3),
            ),
        ]

        salvati = repository.salva_messaggi_chat("k1", turni)

        (richiesta,) = registro.richieste
        corpo = json.loads(richiesta.content)
        assert [riga["id"] for riga in corpo] == ["m1", "m2"]
        assert {riga["conversazione_id"] for riga in corpo} == {"k1"}
        assert [m.id for m in salvati] == ["m1", "m2"]

    def test_una_conversazione_nuova_porta_le_sue_date(self):
        from domain.models import ConversazioneChat

        adesso = datetime(2026, 9, 27, 10, 0, tzinfo=UTC)
        repository, registro = _repository(
            lambda r: httpx.Response(201, json=[json.loads(r.content)])
        )

        creata = repository.crea_conversazione_chat(
            ConversazioneChat(
                id="k1", titolo="Cosa metto", creata_il=adesso, ultimo_turno_il=adesso
            )
        )

        corpo = json.loads(registro.richieste[0].content)
        assert corpo["creata_il"] == adesso.isoformat()
        assert "utente_id" not in corpo
        assert creata.titolo == "Cosa metto"

    def test_le_conversazioni_vengono_dalla_piu_recente(self):
        riga = {
            "id": "k1",
            "titolo": "Cosa metto",
            "creata_il": "2026-09-27T10:00:00+00:00",
            "ultimo_turno_il": "2026-09-27T10:05:00+00:00",
        }
        repository, registro = _repository(lambda r: httpx.Response(200, json=[riga]))

        (conversazione,) = repository.elenca_conversazioni_chat()

        assert registro.richieste[0].url.params["order"] == "ultimo_turno_il.desc"
        assert conversazione.ultimo_turno_il.minute == 5

    def test_profilo_outfit_e_segnalazioni_diventano_modelli(self):
        righe = {
            "/rest/v1/profili": [
                {
                    "id": A,
                    "nome": "Anna",
                    "citta": "Milano",
                    "stili": ["minimal"],
                    "altezza_cm": 170,
                    "avatar_foto_percorso": f"{A}/avatar.jpg",
                    "creato_il": "2026-09-01T10:00:00+00:00",
                }
            ],
            "/rest/v1/outfit": [
                {
                    "id": "o1",
                    "nome": "Ufficio",
                    "capo_top": "t1",
                    "capo_bottom": "b1",
                    "origine": "ia",
                    "volte_indossato": 2,
                    "creato_il": "2026-09-01T10:00:00+00:00",
                }
            ],
            "/rest/v1/segnalazioni": [
                {
                    "id": "s1",
                    "utente_id": A,
                    "testo": "si chiude",
                    "stato": "ricevuta",
                    "creata_il": "2026-09-01T10:00:00+00:00",
                    "aggiornata_il": "2026-09-01T10:00:00+00:00",
                }
            ],
        }
        repository, _ = _repository(lambda r: httpx.Response(200, json=righe[r.url.path]))

        profilo = repository.leggi_profilo()
        (outfit,) = repository.elenca_outfit()
        (segnalazione,) = repository.elenca_segnalazioni()

        assert profilo is not None
        assert profilo.preferenze.stili == ["minimal"]
        assert profilo.misure is not None and profilo.misure.altezza_cm == 170
        assert profilo.avatar_foto_chiave == f"{A}/avatar.jpg"
        assert outfit.vestizione.top == "t1" and outfit.vestizione.outer is None
        assert segnalazione.stato.value == "ricevuta"

    def test_un_profilo_senza_misure_non_ne_inventa(self):
        riga = {"id": A, "creato_il": "2026-09-01T10:00:00+00:00"}
        repository, _ = _repository(lambda r: httpx.Response(200, json=[riga]))

        profilo = repository.leggi_profilo()

        assert profilo is not None and profilo.misure is None and profilo.nome == ""

    @pytest.mark.parametrize(
        ("stato", "corpo", "errore"),
        [
            (401, {"code": "PGRST301", "message": "JWT expired"}, NonAutenticato),
            (403, {"code": "42501", "message": "permission denied"}, AccessoNegato),
            (400, {"code": "23514", "message": "check violation"}, RichiestaNonValida),
            (
                400,
                {"code": "22P02", "message": "invalid input syntax for type uuid"},
                RichiestaNonValida,
            ),
            (409, {"code": "23503", "message": "foreign key"}, RichiestaNonValida),
            (500, {"message": "boh"}, ArchivioNonDisponibile),
        ],
    )
    def test_ogni_errore_diventa_un_errore_di_dominio(
        self, stato: int, corpo: dict[str, str], errore: type[Exception]
    ):
        repository, _ = _repository(lambda r: httpx.Response(stato, json=corpo))

        with pytest.raises(errore):
            repository.elenca_capi()

    def test_supabase_irraggiungibile_e_un_502_non_un_500(self):
        def rete_giu(richiesta: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("rete giù", request=richiesta)

        repository, _ = _repository(rete_giu)

        with pytest.raises(ArchivioNonDisponibile):
            repository.elenca_capi()


class TestStorage:
    def _archivio(self, gestore: Gestore) -> tuple[ArchivioSupabase, Registro]:
        registro = Registro(gestore)
        return ArchivioSupabase(SESSIONE, "foto", URL, CHIAVE, registro.client()), registro

    def test_legge_come_l_utente_dal_percorso_autenticato(self):
        archivio, registro = self._archivio(
            lambda r: httpx.Response(200, content=b"JPEG", headers={"content-type": "image/jpeg"})
        )

        assert archivio.leggi(f"{A}/capi/x.jpg") == (b"JPEG", "image/jpeg")
        (richiesta,) = registro.richieste
        assert richiesta.url.path == f"/storage/v1/object/authenticated/foto/{A}/capi/x.jpg"
        assert richiesta.headers["authorization"] == "Bearer token-di-a"

    def test_una_foto_che_non_c_e_o_non_e_sua_e_la_stessa_cosa(self):
        archivio, _ = self._archivio(
            lambda r: httpx.Response(400, json={"statusCode": "404", "error": "not_found"})
        )

        with pytest.raises(FotoNonTrovata):
            archivio.leggi(f"{A}/capi/x.jpg")

    def test_scrive_sovrascrivendo(self):
        archivio, registro = self._archivio(lambda r: httpx.Response(200, json={"Key": "k"}))

        archivio.salva(f"{A}/capi/x.jpg-scontornata", b"PNG", "image/png")

        (richiesta,) = registro.richieste
        assert richiesta.method == "POST"
        assert richiesta.url.path == f"/storage/v1/object/foto/{A}/capi/x.jpg-scontornata"
        assert richiesta.headers["x-upsert"] == "true"
        assert richiesta.headers["content-type"] == "image/png"

    def test_fuori_dalla_propria_cartella_e_un_accesso_negato(self):
        archivio, _ = self._archivio(
            lambda r: httpx.Response(
                400,
                json={
                    "error": "Unauthorized",
                    "message": "new row violates row-level security policy",
                },
            )
        )

        with pytest.raises(AccessoNegato):
            archivio.salva("altro/x.jpg", b"PNG", "image/png")

    def test_la_firma_diventa_un_indirizzo_intero(self):
        archivio, registro = self._archivio(
            lambda r: httpx.Response(200, json={"signedURL": "/object/sign/foto/x.zip?token=abc"})
        )

        url = archivio.firma_lettura(f"{A}/x.zip", 900)

        assert url == f"{URL}/storage/v1/object/sign/foto/x.zip?token=abc"
        assert json.loads(registro.richieste[0].content) == {"expiresIn": 900}

    def test_una_firma_senza_indirizzo_e_un_502(self):
        archivio, _ = self._archivio(lambda r: httpx.Response(200, json={}))

        with pytest.raises(ArchivioNonDisponibile):
            archivio.firma_lettura(f"{A}/x.zip", 900)


class TestChiaviAuth:
    def _jwks(self) -> dict[str, Any]:
        from jwt.algorithms import ECAlgorithm

        chiave = json.loads(ECAlgorithm.to_jwk(CHIAVI.pubblica))
        return {"keys": [{**chiave, "kid": CHIAVI.KID, "alg": "ES256", "use": "sig"}]}

    def test_scarica_una_volta_e_poi_usa_la_cache(self):
        registro = Registro(lambda r: httpx.Response(200, json=self._jwks()))
        chiavi = ChiaviAuthSupabase(URL, registro.client())

        assert chiavi.chiave(CHIAVI.KID) is not None
        assert chiavi.chiave(CHIAVI.KID) is not None
        assert len(registro.richieste) == 1
        assert registro.richieste[0].url.path == "/auth/v1/.well-known/jwks.json"

    def test_un_kid_sconosciuto_non_scatena_una_richiesta_per_ogni_token(self):
        registro = Registro(lambda r: httpx.Response(200, json=self._jwks()))
        chiavi = ChiaviAuthSupabase(URL, registro.client())
        chiavi.chiave(CHIAVI.KID)

        for _ in range(5):
            assert chiavi.chiave("inventato") is None
        assert len(registro.richieste) == 1

    def test_senza_jwks_e_senza_cache_si_chiude(self):
        registro = Registro(lambda r: httpx.Response(503))
        chiavi = ChiaviAuthSupabase(URL, registro.client())

        with pytest.raises(AccessoNonDisponibile):
            chiavi.chiave(CHIAVI.KID)
        # E subito dopo non si riprova: il JWKS giù non diventa una richiesta
        # a Supabase per ogni chiamata.
        with pytest.raises(AccessoNonDisponibile):
            chiavi.chiave(CHIAVI.KID)
        assert len(registro.richieste) == 1

    def test_con_le_chiavi_in_cache_un_jwks_giu_non_ferma_niente(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        risposte = iter([httpx.Response(200, json=self._jwks()), httpx.Response(503)])
        registro = Registro(lambda r: next(risposte))
        chiavi = ChiaviAuthSupabase(URL, registro.client())
        assert chiavi.chiave(CHIAVI.KID) is not None

        # La cache invecchia: si prova a riscaricare, fallisce, e si continua
        # con le chiavi che si avevano.
        import adapters.supabase as modulo

        dopo = time.monotonic() + ChiaviAuthSupabase.DURATA_S + 1
        monkeypatch.setattr(modulo.time, "monotonic", lambda: dopo)
        assert chiavi.chiave(CHIAVI.KID) is not None
        assert len(registro.richieste) == 2

    @pytest.mark.parametrize("corpo", [[], {"keys": "non un elenco"}, {"keys": [1, "due"]}])
    def test_un_corpo_che_non_e_un_jwks_chiude_con_un_503(self, corpo: object):
        chiavi = ChiaviAuthSupabase(
            URL, Registro(lambda r: httpx.Response(200, json=corpo)).client()
        )

        with pytest.raises(AccessoNonDisponibile):
            chiavi.chiave(CHIAVI.KID)

    def test_una_chiave_illeggibile_non_butta_via_quella_buona(self):
        jwks = self._jwks()
        jwks["keys"] += [
            {"kty": "OKP", "crv": "X448", "x": "non-importa", "kid": "di-un-altro-tipo"},
            {"kty": "EC", "crv": "P-256", "x": "rotta", "y": "rotta", "kid": "rotta"},
        ]
        chiavi = ChiaviAuthSupabase(
            URL, Registro(lambda r: httpx.Response(200, json=jwks)).client()
        )

        assert chiavi.chiave(CHIAVI.KID) is not None
        assert chiavi.chiave("rotta") is None

    def test_un_kid_noto_non_aspetta_un_download_in_corso(self, monkeypatch: pytest.MonkeyPatch):
        """Un `kid` inventato, che chiunque può mandare, fa partire un download
        ogni 30 secondi: chi ha un token buono non deve aspettarlo."""
        import threading

        import adapters.supabase as modulo

        partito, sblocca = threading.Event(), threading.Event()
        chiamate: list[int] = []

        def rispondi(richiesta: httpx.Request) -> httpx.Response:
            chiamate.append(1)
            if len(chiamate) > 1:
                partito.set()
                sblocca.wait(5)
            return httpx.Response(200, json=self._jwks())

        chiavi = ChiaviAuthSupabase(URL, Registro(rispondi).client())
        assert chiavi.chiave(CHIAVI.KID) is not None
        # Passata l'attesa minima, ma con la cache ancora fresca.
        dopo = time.monotonic() + ChiaviAuthSupabase.ATTESA_MINIMA_S + 1
        monkeypatch.setattr(modulo.time, "monotonic", lambda: dopo)
        lento = threading.Thread(target=chiavi.chiave, args=("inventato",))
        lento.start()
        try:
            assert partito.wait(5), "il download del kid inventato è partito"
            inizio = time.perf_counter()
            assert chiavi.chiave(CHIAVI.KID) is not None
            assert time.perf_counter() - inizio < 1
        finally:
            sblocca.set()
            lento.join(5)
