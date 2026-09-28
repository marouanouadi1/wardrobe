"""Gli handler che non sono l'IA: la salute, l'accesso, l'esportazione.

Verificano che i parametri arrivino, che gli errori diventino status e che
nessun handler nasconda logica. L'accesso si prova con token veri, firmati
ES256 con le chiavi di prova del conftest: gli stessi passaggi della produzione,
senza Supabase.
"""

from __future__ import annotations

import io
import json
import tomllib
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import jwt
import pytest

from conftest import ADESSO, CHIAVI, EMITTENTE, Supabase, costruisci_capo, intestazioni_utente
from domain.errors import AccessoNonDisponibile
from domain.models import (
    ConversazioneChat,
    FotoCapo,
    MessaggioChat,
    PreferenzeStile,
    Profilo,
    RuoloChat,
    Segnalazione,
    StatoSegnalazione,
)
from handlers import _container, esportazione, health, suggerimenti

A = "00000000-0000-4000-8000-00000000000a"
B = "00000000-0000-4000-8000-00000000000b"


def _corpo(risposta: dict[str, Any]) -> Any:
    return json.loads(risposta["body"])


def _con_token(token: str) -> dict[str, Any]:
    return {"headers": {"authorization": f"Bearer {token}"}, "body": "{}"}


class TestSalute:
    def test_risponde_ok_senza_token(self):
        risposta = health.salute({"headers": {}}, None)
        assert risposta["statusCode"] == 200
        assert _corpo(risposta)["stato"] == "ok"

    def test_riporta_la_versione_di_pyproject(self):
        """Il campo `versione` è quello che il deploy confronta per sapere se il
        VPS sta servendo il codice appena rilasciato. Se il packaging si rompe e
        i metadati non sono leggibili, `health.py` ripiega su "dev" e questo
        test cade — che è esattamente la regressione da intercettare.
        """
        pyproject = Path(__file__).parents[2] / "pyproject.toml"
        attesa = tomllib.loads(pyproject.read_text())["project"]["version"]

        assert _corpo(health.salute({"headers": {}}, None))["versione"] == attesa


class TestAccesso:
    """Un endpoint qualunque fra quelli protetti: la porta è la stessa per tutti
    (`_http.sessione`), ed è la prima cosa che ogni handler fa — prima di leggere
    il corpo, prima del database, prima del modello."""

    def _stato(self, token: str) -> int:
        return int(suggerimenti.proponi(_con_token(token), None)["statusCode"])

    def test_senza_token_e_un_401(self):
        risposta = suggerimenti.proponi({"headers": {}, "body": "{}"}, None)
        assert risposta["statusCode"] == 401
        assert _corpo(risposta)["errore"] == "non_autenticato"

    def test_un_token_firmato_da_un_altra_chiave_e_un_401(self):
        from fakes import ChiaviFinte

        altre = ChiaviFinte()
        assert self._stato(altre.token(A, EMITTENTE)) == 401

    def test_un_token_hs256_e_un_401_anche_con_il_kid_giusto(self):
        """La forma classica di chi prova a firmarselo da sé: l'algoritmo lo
        decide il backend, non l'intestazione del token."""
        falso = jwt.encode(
            {
                "sub": A,
                "aud": "authenticated",
                "iss": EMITTENTE,
                "role": "authenticated",
                "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
            },
            "un-segreto-qualunque-lungo-abbastanza-per-hs256",
            algorithm="HS256",
            headers={"kid": CHIAVI.KID},
        )
        assert self._stato(falso) == 401

    def test_un_token_senza_firma_e_un_401(self):
        falso = jwt.encode(
            {"sub": A, "aud": "authenticated", "iss": EMITTENTE, "role": "authenticated"},
            None,
            algorithm="none",
            headers={"kid": CHIAVI.KID},
        )
        assert self._stato(falso) == 401

    def test_un_token_scaduto_e_un_401(self):
        assert self._stato(CHIAVI.token(A, EMITTENTE, scade_tra=timedelta(minutes=-1))) == 401

    def test_un_token_di_un_altro_progetto_e_un_401(self):
        assert self._stato(CHIAVI.token(A, "https://altro.supabase.co/auth/v1")) == 401

    def test_un_token_per_un_altro_pubblico_e_un_401(self):
        assert self._stato(CHIAVI.token(A, EMITTENTE, pubblico="altro")) == 401

    def test_un_token_anon_non_e_una_persona(self):
        assert self._stato(CHIAVI.token(A, EMITTENTE, ruolo="anon")) == 401

    def test_un_token_service_role_non_e_una_persona(self):
        assert self._stato(CHIAVI.token(A, EMITTENTE, ruolo="service_role")) == 401

    def test_un_accesso_anonimo_e_un_401(self):
        assert self._stato(CHIAVI.token(A, EMITTENTE, is_anonymous=True)) == 401

    def test_un_kid_sconosciuto_e_un_401(self):
        assert self._stato(CHIAVI.token(A, EMITTENTE, kid="chiave-che-non-esiste")) == 401

    def test_senza_le_chiavi_dell_auth_si_chiude_con_un_503(self, monkeypatch: pytest.MonkeyPatch):
        class ChiaviIrraggiungibili:
            def chiave(self, kid: str) -> object | None:
                raise AccessoNonDisponibile("il JWKS non risponde")

        monkeypatch.setattr(_container, "chiavi_auth", lambda: ChiaviIrraggiungibili())

        risposta = suggerimenti.proponi({"headers": intestazioni_utente(A), "body": "{}"}, None)

        assert risposta["statusCode"] == 503
        assert _corpo(risposta)["errore"] == "accesso_non_disponibile"


class TestErroreImprevisto:
    def test_un_errore_imprevisto_e_un_500_che_non_racconta_niente(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        def guasto(sessione: object) -> object:
            raise RuntimeError("postgres://utente:segreto@host")

        monkeypatch.setattr(suggerimenti, "repository", guasto)

        risposta = suggerimenti.proponi({"headers": intestazioni_utente(A), "body": "{}"}, None)

        assert risposta["statusCode"] == 500
        assert _corpo(risposta) == {"errore": "errore_interno"}


@pytest.fixture
def armadio_di_a(supabase: Supabase) -> list[str]:
    """Due capi di A con le loro foto, un profilo con l'avatar, una conversazione,
    una segnalazione — e un capo di B, che nell'esportazione di A non deve
    comparire."""
    d = supabase.deposito
    capi = []
    for capo_id in ("c1", "c2"):
        capo = costruisci_capo(capo_id).model_copy(
            update={"foto": FotoCapo(chiave=f"{A}/capi/{capo_id}.jpg")}
        )
        capi.append(capo)
        d.file[("foto", f"{A}/capi/{capo_id}.jpg")] = (f"foto-{capo_id}".encode(), "image/jpeg")
    # c1 è passato dallo scontorno: la sua versione senza sfondo è un secondo file.
    capi[0] = capi[0].model_copy(
        update={
            "foto": FotoCapo(
                chiave=f"{A}/capi/c1.jpg", chiave_scontornata=f"{A}/capi/c1.jpg-scontornata"
            )
        }
    )
    d.file[("foto", f"{A}/capi/c1.jpg-scontornata")] = (b"senza-sfondo", "image/png")
    d.capi[A] = capi
    d.capi[B] = [costruisci_capo("di-b")]
    d.profili[A] = Profilo(
        id=A,
        nome="Anna",
        citta="Milano",
        preferenze=PreferenzeStile(),
        avatar_foto_chiave=f"{A}/avatar.jpg",
        creato_il=ADESSO,
    )
    d.file[("foto", f"{A}/avatar.jpg")] = (b"io-in-piedi", "image/jpeg")
    d.conversazioni[A]["k1"] = ConversazioneChat(
        id="k1", titolo="Cosa metto", creata_il=ADESSO, ultimo_turno_il=ADESSO
    )
    d.messaggi[A]["k1"] = [
        MessaggioChat(id="m1", ruolo=RuoloChat.UTENTE, testo="Ciao", creato_il=ADESSO)
    ]
    d.segnalazioni[A] = [
        Segnalazione(
            id="s1",
            utente_id=A,
            testo="si chiude",
            stato=StatoSegnalazione.RICEVUTA,
            creata_il=ADESSO,
            aggiornata_il=ADESSO,
        )
    ]
    return ["c1", "c2"]


def _zip_di(supabase: Supabase, utente: str) -> zipfile.ZipFile:
    contenuto, media_type = supabase.deposito.file[
        ("esportazioni", f"{utente}/{esportazione.NOME_NELLO_STORAGE}")
    ]
    assert media_type == "application/zip"
    return zipfile.ZipFile(io.BytesIO(contenuto))


class TestEsportazione:
    def _crea(self, utente: str = A) -> dict[str, Any]:
        return esportazione.crea({"headers": intestazioni_utente(utente), "body": ""}, None)

    def test_carica_lo_zip_nella_propria_cartella_e_ne_da_l_indirizzo(
        self, supabase: Supabase, armadio_di_a: list[str]
    ):
        risposta = self._crea()

        assert risposta["statusCode"] == 200
        dati = _corpo(risposta)
        assert dati["url"].startswith("https://storage.finto/esportazioni/")
        assert f"{A}/{esportazione.NOME_NELLO_STORAGE}" in dati["url"]
        assert "&download=aura-i-tuoi-dati-" in dati["url"]
        scade = datetime.fromisoformat(dati["scade_il"])
        assert timedelta(0) < scade - datetime.now(UTC) <= timedelta(minutes=30)
        assert _zip_di(supabase, A).testzip() is None

    def test_una_seconda_esportazione_sostituisce_la_prima(
        self, supabase: Supabase, armadio_di_a: list[str]
    ):
        self._crea()
        self._crea()

        mie = [chiave for chiave in supabase.deposito.file if chiave[0] == "esportazioni"]
        assert mie == [("esportazioni", f"{A}/{esportazione.NOME_NELLO_STORAGE}")]

    def test_contiene_l_armadio_le_foto_e_le_conversazioni_di_chi_lo_chiede(
        self, supabase: Supabase, armadio_di_a: list[str]
    ):
        self._crea()

        archivio = _zip_di(supabase, A)
        dati = json.loads(archivio.read("dati.json"))
        assert dati["profilo"]["citta"] == "Milano"
        assert sorted(capo["id"] for capo in dati["capi"]) == armadio_di_a
        assert dati["conversazioni"][0]["messaggi"][0]["testo"] == "Ciao"
        assert [s["testo"] for s in dati["segnalazioni"]] == ["si chiude"]
        assert archivio.read("foto/c1.jpg") == b"foto-c1"
        assert archivio.read("foto/c1-senza-sfondo.png") == b"senza-sfondo"
        assert archivio.read("foto/avatar.jpg") == b"io-in-piedi"

    def test_non_contiene_i_percorsi_interni(self, supabase: Supabase, armadio_di_a: list[str]):
        """I percorsi nello Storage portano l'id dell'utente: in un file che la
        persona conserva, e magari gira, non servono."""
        self._crea()

        grezzo = _zip_di(supabase, A).read("dati.json").decode()
        # L'id dell'utente c'è, come id del profilo: è un dato suo. Un percorso
        # nella sua cartella no.
        assert f"{A}/" not in grezzo
        assert "chiave" not in grezzo

    def test_non_contiene_l_armadio_di_qualcun_altro(
        self, supabase: Supabase, armadio_di_a: list[str]
    ):
        self._crea()

        dati = json.loads(_zip_di(supabase, A).read("dati.json"))
        assert "di-b" not in [capo["id"] for capo in dati["capi"]]

    def test_una_foto_illeggibile_non_fa_cadere_tutto(
        self, supabase: Supabase, armadio_di_a: list[str]
    ):
        del supabase.deposito.file[("foto", f"{A}/capi/c1.jpg")]

        risposta = self._crea()

        assert risposta["statusCode"] == 200
        nomi = _zip_di(supabase, A).namelist()
        assert "foto/c1.jpg" not in nomi and "foto/c2.jpg" in nomi

    def test_uno_storage_che_non_risponde_non_da_uno_zip_con_i_buchi(
        self, monkeypatch: pytest.MonkeyPatch, supabase: Supabase, armadio_di_a: list[str]
    ):
        """Una foto sparita si salta; uno Storage che non risponde no: lo zip
        uscirebbe con dei buchi e un 200, e chi lo scarica crederebbe di avere
        tutto."""
        from domain.errors import ArchivioNonDisponibile
        from fakes import ArchivioFinto

        def guasto(self: ArchivioFinto, percorso: str) -> tuple[bytes, str]:
            raise ArchivioNonDisponibile("lo Storage non risponde")

        monkeypatch.setattr(ArchivioFinto, "leggi", guasto)

        risposta = self._crea()

        assert risposta["statusCode"] == 502
        assert not [chiave for chiave in supabase.deposito.file if chiave[0] == "esportazioni"]

    def test_senza_token_e_un_401(self):
        assert esportazione.crea({"headers": {}, "body": ""}, None)["statusCode"] == 401
