"""Gli handler: solo il loro lavoro, cioè tradurre evento -> dominio -> HTTP.

Non riverificano le regole dell'armadio (quelle stanno nei test del dominio):
verificano che i parametri arrivino, che gli errori diventino status, e che
nessun handler stia nascondendo logica.
"""

from __future__ import annotations

import io
import json
import tomllib
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest import mock

import pytest

from conftest import ADESSO, costruisci_capo, intestazioni_utente
from domain.errors import ErroreDominio, NonAutenticato
from domain.models import (
    ConversazioneChat,
    MessaggioChat,
    PreferenzeStile,
    Profilo,
    RuoloChat,
    StatoCapo,
    TipoCapo,
)
from handlers import (
    auth,
    capi,
    esportazione,
    foto,
    health,
    outfit,
    profilo,
    segnalazioni,
    svuotamento,
)
from handlers._container import archivio_foto, repository, repository_utenti
from handlers._http import utente_id


def evento(
    *,
    corpo: dict[str, Any] | None = None,
    percorso: dict[str, str] | None = None,
    query: dict[str, str] | None = None,
    utente: str = "demo",
) -> dict[str, Any]:
    return {
        "headers": intestazioni_utente(utente),
        "pathParameters": percorso or {},
        "queryStringParameters": query or {},
        "body": json.dumps(corpo) if corpo is not None else "",
    }


def corpo_di(risposta: dict[str, Any]) -> Any:
    return json.loads(risposta["body"])


@pytest.fixture(autouse=True)
def _armadio_demo() -> None:
    """Un armadio di test esplicito per l'utente «demo»: non più il seme di
    produzione (rimosso da `adapters/memory.py`, vedi il piano di pulizia),
    ma dati che vivono solo qui, con la forma che questi test si aspettano —
    12 capi, di cui 3 da lavare, due colori noti per i test sull'outfit."""
    capi_di_prova = [
        costruisci_capo(
            "t1", TipoCapo.TOP, nome="T-shirt bianca", hex_colore="#EFEBE3", preferito=True
        ),
        costruisci_capo("t2", TipoCapo.TOP, nome="T-shirt nera", stato=StatoCapo.DA_LAVARE),
        costruisci_capo("t3", TipoCapo.TOP, nome="Camicia in lino", materiale="Lino 100%"),
        costruisci_capo("t4", TipoCapo.TOP, nome="Maglione di lana"),
        costruisci_capo(
            "b1", TipoCapo.PANTALONI, nome="Jeans dritti", hex_colore="#46536B", preferito=True
        ),
        costruisci_capo("b2", TipoCapo.PANTALONI, nome="Jeans chiari", stato=StatoCapo.DA_LAVARE),
        costruisci_capo("b3", TipoCapo.PANTALONI, nome="Pantalone cammello"),
        costruisci_capo("b4", TipoCapo.PANTALONI, nome="Gonna nera"),
        costruisci_capo("s1", TipoCapo.SCARPE, nome="Sneaker bianche"),
        costruisci_capo("s2", TipoCapo.SCARPE, nome="Stivaletti neri", stato=StatoCapo.DA_LAVARE),
        costruisci_capo("o1", TipoCapo.CAPOSPALLA, nome="Giacca di jeans"),
        costruisci_capo("o2", TipoCapo.CAPOSPALLA, nome="Cardigan panna"),
    ]
    for capo in capi_di_prova:
        repository().salva_capo("demo", capo)

    repository().salva_profilo(
        Profilo(
            id="demo",
            nome="Utente di prova",
            citta="Milano",
            preferenze=PreferenzeStile(stili=["comodo", "classico"], palette=["neutri", "terra"]),
            creato_il=ADESSO,
        )
    )


class TestSalute:
    def test_risponde_ok(self):
        risposta = health.salute(evento(), None)
        assert risposta["statusCode"] == 200
        assert corpo_di(risposta)["stato"] == "ok"

    def test_riporta_la_versione_di_pyproject(self):
        """Il campo `versione` è quello che il deploy confronta per sapere se il
        VPS sta servendo il codice appena rilasciato. Se il packaging si rompe e
        i metadati non sono leggibili, `health.py` ripiega su "dev" e questo
        test cade — che è esattamente la regressione da intercettare.
        """
        pyproject = Path(__file__).parents[2] / "pyproject.toml"
        attesa = tomllib.loads(pyproject.read_text())["project"]["version"]

        assert corpo_di(health.salute(evento(), None))["versione"] == attesa


class TestAuth:
    def _crea_utente(self, email: str, password: str) -> None:
        from domain.autenticazione import genera_hash

        repository_utenti().crea(email, genera_hash(password))

    def test_credenziali_giuste_restituiscono_un_token(self):
        self._crea_utente("prova@esempio.it", "password-lunga")

        risposta = auth.accedi(
            evento(corpo={"email": "prova@esempio.it", "password": "password-lunga"}), None
        )
        assert risposta["statusCode"] == 200
        assert corpo_di(risposta)["token"]

    def test_password_sbagliata_e_un_401(self):
        self._crea_utente("prova2@esempio.it", "password-lunga")

        risposta = auth.accedi(
            evento(corpo={"email": "prova2@esempio.it", "password": "sbagliata"}), None
        )
        assert risposta["statusCode"] == 401

    def test_email_inesistente_e_un_401(self):
        risposta = auth.accedi(
            evento(corpo={"email": "fantasma@esempio.it", "password": "qualsiasi"}), None
        )
        assert risposta["statusCode"] == 401

    def test_il_token_emesso_autentica_le_richieste_successive(self):
        """Solo il token — non più l'header X-Utente senza verifica, sparito
        insieme ad AUTH_APERTA — deve identificare l'utente."""
        self._crea_utente("prova3@esempio.it", "password-lunga")

        risposta = auth.accedi(
            evento(corpo={"email": "prova3@esempio.it", "password": "password-lunga"}), None
        )
        token = corpo_di(risposta)["token"]

        assert utente_id({"headers": {"authorization": f"Bearer {token}"}}) != "demo"

    def test_senza_token_e_un_401(self):
        with pytest.raises(NonAutenticato):
            utente_id({"headers": {}})


class TestRegistrazione:
    def test_email_ammessa_si_registra_ed_entra_subito(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("EMAIL_AMMESSE", "nuovo@esempio.it,altro@esempio.it")

        risposta = auth.registra(
            evento(corpo={"email": "nuovo@esempio.it", "password": "password-lunga"}), None
        )
        assert risposta["statusCode"] == 201
        assert corpo_di(risposta)["token"]

    def test_email_fuori_allowlist_e_un_403(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("EMAIL_AMMESSE", "nuovo@esempio.it")

        risposta = auth.registra(
            evento(corpo={"email": "estraneo@esempio.it", "password": "password-lunga"}), None
        )
        assert risposta["statusCode"] == 403
        assert corpo_di(risposta)["errore"] == "registrazione_non_ammessa"

    def test_allowlist_vuota_e_un_403(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("EMAIL_AMMESSE", raising=False)

        risposta = auth.registra(
            evento(corpo={"email": "chiunque@esempio.it", "password": "password-lunga"}), None
        )
        assert risposta["statusCode"] == 403

    def test_email_gia_registrata_e_un_409(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("EMAIL_AMMESSE", "duplicato@esempio.it")
        auth.registra(
            evento(corpo={"email": "duplicato@esempio.it", "password": "password-lunga"}), None
        )

        risposta = auth.registra(
            evento(corpo={"email": "duplicato@esempio.it", "password": "un-altra-password"}), None
        )
        assert risposta["statusCode"] == 409
        assert corpo_di(risposta)["errore"] == "email_gia_registrata"

    def test_password_corta_e_un_422(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("EMAIL_AMMESSE", "corta@esempio.it")

        risposta = auth.registra(
            evento(corpo={"email": "corta@esempio.it", "password": "corta"}), None
        )
        assert risposta["statusCode"] == 422

    def test_email_normalizzata_prima_del_confronto(self, monkeypatch: pytest.MonkeyPatch):
        """Maiuscole e spazi non devono far sembrare un'email invitata come
        se non lo fosse, né creare due account per la stessa persona."""
        monkeypatch.setenv("EMAIL_AMMESSE", "spazio@esempio.it")

        risposta = auth.registra(
            evento(corpo={"email": "  Spazio@Esempio.It  ", "password": "password-lunga"}), None
        )
        assert risposta["statusCode"] == 201

        trovato = repository_utenti().trova_per_email("spazio@esempio.it")
        assert trovato is not None


class TestCapi:
    def test_elenca_l_armadio_di_prova(self):
        risposta = capi.elenca(evento(), None)
        assert risposta["statusCode"] == 200
        dati = corpo_di(risposta)
        assert dati["totale"] == 12
        assert len(dati["capi"]) == 12

    def test_ogni_capo_esce_con_un_url_firmato(self):
        primo = corpo_di(capi.elenca(evento(), None))["capi"][0]
        assert primo["foto"]["url"]

    def test_il_filtro_arriva_al_dominio(self):
        risposta = capi.elenca(evento(query={"tipo": "scarpe"}), None)
        assert {c["tipo"] for c in corpo_di(risposta)["capi"]} == {"scarpe"}

    def test_la_ricerca_testuale_funziona(self):
        risposta = capi.elenca(evento(query={"testo": "lino"}), None)
        assert corpo_di(risposta)["totale"] == 1

    def test_legge_un_capo(self):
        risposta = capi.leggi(evento(percorso={"capoId": "t3"}), None)
        assert corpo_di(risposta)["nome"] == "Camicia in lino"

    def test_un_capo_inesistente_e_un_404(self):
        risposta = capi.leggi(evento(percorso={"capoId": "mai-esistito"}), None)
        assert risposta["statusCode"] == 404
        assert corpo_di(risposta)["errore"] == "capo_non_trovato"

    def test_un_parametro_mancante_e_un_422(self):
        risposta = capi.leggi(evento(), None)
        assert risposta["statusCode"] == 422

    def test_aggiorna_etichette_e_appunti(self):
        risposta = capi.aggiorna(
            evento(
                percorso={"capoId": "t4"},
                corpo={"etichette": ["da lavoro", "comodo"], "appunti": "regalo"},
            ),
            None,
        )
        assert risposta["statusCode"] == 200
        dati = corpo_di(risposta)
        assert dati["etichette"] == ["da lavoro", "comodo"]
        assert dati["appunti"] == "regalo"

    def test_corregge_un_attributo(self):
        risposta = capi.aggiorna(
            evento(
                percorso={"capoId": "t4"},
                corpo={"correzioni": {"materiale": "Lana merino 100%"}},
            ),
            None,
        )
        assert risposta["statusCode"] == 200
        dati = corpo_di(risposta)
        assert dati["materiale"] == "Lana merino 100%"
        assert dati["analisi"]["confidenze"]["materiale"] == 100

    def test_un_corpo_non_valido_e_un_422(self):
        risposta = capi.aggiorna(
            evento(percorso={"capoId": "t4"}, corpo={"correzioni": {"tipo": "maglietta"}}), None
        )
        assert risposta["statusCode"] == 422

    def test_segna_un_capo_come_indossato(self):
        risposta = capi.indossa(evento(percorso={"capoId": "t1"}), None)
        dati = corpo_di(risposta)
        assert dati["stato"] == "da_lavare"
        assert dati["ultimo_uso"]

    def test_il_riepilogo_conta(self):
        dati = corpo_di(capi.sommario(evento(), None))
        assert dati["totale"] == 12
        assert dati["da_lavare"] == 3


class TestFoto:
    def test_firma_un_upload(self):
        risposta = foto.upload(evento(corpo={"content_type": "image/jpeg"}), None)
        assert risposta["statusCode"] == 200
        dati = corpo_di(risposta)
        assert dati["metodo"] == "PUT"
        assert dati["chiave"].startswith("capi/demo/")

    def test_rifiuta_un_tipo_non_immagine(self):
        risposta = foto.upload(evento(corpo={"content_type": "application/pdf"}), None)
        assert risposta["statusCode"] == 422
        assert "non ammesso" in corpo_di(risposta)["messaggio"]


class TestOutfit:
    def test_salva_e_rilegge(self):
        creato = outfit.salva(
            evento(
                corpo={
                    "nome": "Riunione di lunedì",
                    "occasione": "Ufficio",
                    "vestizione": {"top": "t1", "bottom": "b1", "shoes": "s1"},
                }
            ),
            None,
        )
        assert creato["statusCode"] == 201
        elenco = corpo_di(outfit.elenca(evento(), None))["outfit"]
        assert any(o["nome"] == "Riunione di lunedì" for o in elenco)

    def test_rifiuta_un_outfit_non_indossabile(self):
        risposta = outfit.salva(
            evento(corpo={"nome": "Solo sopra", "vestizione": {"top": "t1"}}), None
        )
        assert risposta["statusCode"] == 422

    def test_restituisce_i_colori_per_il_manichino(self):
        creato = corpo_di(
            outfit.salva(
                evento(
                    corpo={
                        "nome": "Per l'avatar",
                        "vestizione": {"top": "t1", "bottom": "b1"},
                    }
                ),
                None,
            )
        )
        colori = corpo_di(outfit.colori(evento(percorso={"outfitId": creato["id"]}), None))
        assert colori["top"] == "#EFEBE3"
        assert colori["bottom"] == "#46536B"


class TestProfilo:
    def test_al_primo_accesso_crea_il_profilo(self):
        dati = corpo_di(profilo.leggi(evento(utente="nuovo-utente"), None))
        assert dati["id"] == "nuovo-utente"

    def test_legge_il_profilo_di_prova(self):
        dati = corpo_di(profilo.leggi(evento(), None))
        assert dati["citta"] == "Milano"
        assert "neutri" in dati["preferenze"]["palette"]

    def _con_misure(self, misure: dict[str, Any] | None) -> dict[str, Any]:
        """Il PUT è a oggetto intero: si rilegge, si cambia un campo, si rimanda.

        È la stessa cosa che fa `app/misure.tsx` con `{ ...profilo, misure }` —
        se questo test costruisse un `Profilo` da zero non proverebbe il giro
        vero, proverebbe un giro più facile.
        """
        attuale = corpo_di(profilo.leggi(evento(), None))
        return {**attuale, "misure": misure}

    def test_le_misure_fanno_il_giro_e_tornano(self):
        risposta = profilo.aggiorna(
            evento(
                corpo=self._con_misure(
                    {
                        "sistema_taglie": "unisex",
                        "taglia": "m",
                        "altezza_cm": 168,
                        "corporatura": "media",
                    }
                )
            ),
            None,
        )
        assert risposta["statusCode"] == 200
        # Non basta la risposta: `profili.dati` è jsonb, e un campo nuovo che
        # non sopravvive alla serializzazione tornerebbe comunque dalla
        # risposta — che è l'oggetto appena ricevuto, non quello riletto.
        riletto = corpo_di(profilo.leggi(evento(), None))
        assert riletto["misure"]["altezza_cm"] == 168
        assert riletto["misure"]["taglia"] == "m"
        # E non ha mangiato il resto del profilo nel passaggio.
        assert riletto["citta"] == "Milano"
        assert "neutri" in riletto["preferenze"]["palette"]

    def test_si_possono_cancellare(self):
        """«Puoi cancellarle quando vuoi» è una promessa della schermata, non
        un modo di dire: dopo il `null` non deve tornare l'ultimo valore salvato.

        Si verifica l'**assenza** del campo e non `is None`, perché `ok()`
        serializza con `exclude_none=True` (`handlers/_http.py:88`): un campo
        nullo non arriva affatto al client, non arriva come `null`. Vale per
        tutto il repo, ed è il motivo per cui `misure` è generato `misure?:` in
        TypeScript. Scriverlo qui perché il prossimo che aggiunge un campo
        opzionale non lo scopra dal test rosso.
        """
        profilo.aggiorna(evento(corpo=self._con_misure({"altezza_cm": 168})), None)
        assert corpo_di(profilo.leggi(evento(), None))["misure"]["altezza_cm"] == 168
        profilo.aggiorna(evento(corpo=self._con_misure(None)), None)
        assert "misure" not in corpo_di(profilo.leggi(evento(), None))

    def test_lunita_di_lettura_ha_un_default_e_non_e_mai_assente(self):
        """Il profilo di prova è stato salvato **prima** che il campo esistesse:
        è il caso vero di ogni riga già in `profili.dati`, e prova che il campo
        nuovo non ha avuto bisogno di una migrazione. Senza il default sarebbe
        `None`, e ogni punto che mostra una lunghezza avrebbe un ramo in più."""
        assert corpo_di(profilo.leggi(evento(), None))["unita_lunghezza"] == "cm"

    def test_lunita_si_cambia_e_non_tocca_le_misure(self):
        """Cambiare unità è una preferenza di **lettura**: i centimetri salvati
        restano quelli. Se un giorno qualcuno convertisse al salvataggio invece
        che alla lettura, questo test lo direbbe — e sarebbe una perdita di
        precisione a ogni cambio, non un difetto visibile subito."""
        profilo.aggiorna(evento(corpo=self._con_misure({"altezza_cm": 168})), None)
        attuale = corpo_di(profilo.leggi(evento(), None))
        profilo.aggiorna(evento(corpo={**attuale, "unita_lunghezza": "pollici"}), None)
        riletto = corpo_di(profilo.leggi(evento(), None))
        assert riletto["unita_lunghezza"] == "pollici"
        assert riletto["misure"]["altezza_cm"] == 168

    def test_unaltezza_impossibile_e_rifiutata(self):
        """Il dito che scivola: `1680` invece di `168`. L'app lo ferma già sulla
        tastiera leggendo `LIMITI_MISURE_CM`, ma il limite deve valere anche per
        chi non passa dall'app — è il server a doverlo sapere."""
        risposta = profilo.aggiorna(evento(corpo=self._con_misure({"altezza_cm": 1680})), None)
        assert risposta["statusCode"] == 422
        assert corpo_di(risposta)["errore"] == "richiesta_non_valida"


class TestEsportazione:
    """«Scarica i tuoi dati», dal tocco allo zip.

    Il ramo che serve i byte vive in `local_server.py`, che è escluso dal conto
    della coverage: per questo fa **due cose sole** — verifica la firma e
    scrive. Tutto il resto è qui sotto, e gira sui finti.
    """

    def test_crea_restituisce_un_indirizzo_firmato_e_a_scadenza(self):
        risposta = esportazione.crea(evento(), None)
        assert risposta["statusCode"] == 200
        dati = corpo_di(risposta)
        assert "/esportazione?" in dati["url"]
        assert "firma=" in dati["url"] and "scade=" in dati["url"]
        # La scadenza è nel futuro e **non** è quella delle foto (sette
        # giorni): questo indirizzo vale l'armadio intero, e finisce nella
        # cronologia del browser di sistema.
        #
        # Contro l'ora **vera** e non contro `ADESSO`: `_container.orologio()`
        # restituisce `OrologioDiSistema` anche nei test — `ADESSO` è una
        # costante per costruire i dati di prova, non un orologio congelato.
        scade = datetime.fromisoformat(dati["scade_il"])
        assert timedelta(0) < scade - datetime.now(UTC) <= timedelta(minutes=30)

    def _con_foto_vere(self) -> dict[str, bytes]:
        """Mette davvero dei byte nell'archivio, per ogni capo di prova.

        **Senza questo, i test qui sotto passavano per il motivo sbagliato.**
        La fixture salva dei `Capo` ma non ha mai scritto una foto: ogni
        `leggi()` sollevava, ogni foto veniva saltata, e l'archivio usciva con
        `dati.json` e basta. L'asserzione «contiene dati.json e LEGGIMI.txt»
        era vera anche così — e sarebbe rimasta vera con la chiave sbagliata,
        con l'archivio scollegato, o senza una riga che copia le foto.
        """
        attesi: dict[str, bytes] = {}
        for indice, capo in enumerate(repository().elenca_capi("demo")):
            contenuto_foto = f"finta-{indice}".encode()
            archivio_foto().salva(capo.foto.chiave, contenuto_foto, "image/jpeg")
            attesi[f"foto/{capo.id}.jpg"] = contenuto_foto
        assert attesi, "senza capi di prova questi test non direbbero niente"
        return attesi

    def test_larchivio_contiene_larmadio_di_chi_lo_chiede(self):
        attesi = self._con_foto_vere()
        archivio = zipfile.ZipFile(io.BytesIO(esportazione.archivio_per("demo")))
        dati = json.loads(archivio.read("dati.json"))
        assert dati["profilo"]["citta"] == "Milano"
        assert len(dati["capi"]) == len(repository().elenca_capi("demo"))
        for nome, contenuto_atteso in attesi.items():
            assert archivio.read(nome) == contenuto_atteso

    def test_il_nome_dentro_lo_zip_e_lid_che_sta_in_dati_json(self):
        """Il LEGGIMI promette «il capo `abc123` è `foto/abc123.jpg`». Se il
        nome venisse dalla chiave d'archivio quella frase sarebbe falsa, e chi
        apre lo zip non avrebbe modo di riappaiare una foto al suo capo."""
        self._con_foto_vere()
        archivio = zipfile.ZipFile(io.BytesIO(esportazione.archivio_per("demo")))
        dati = json.loads(archivio.read("dati.json"))
        nella_cartella = {
            v.removeprefix("foto/").rsplit(".", 1)[0]
            for v in archivio.namelist()
            if v.startswith("foto/")
        }
        assert nella_cartella == {capo["id"] for capo in dati["capi"]}

    def test_porta_anche_la_scontornata_e_la_foto_dellavatar(self):
        """Le due che un'esportazione non può dimenticare: la scontornata è un
        **secondo file vero** sull'archivio, e `avatar_foto_chiave` è la foto a
        figura intera della persona — il file più personale che ci sia."""
        capo = repository().elenca_capi("demo")[0]
        senza_sfondo = capo.foto.chiave.replace(".jpg", "-ritagliata.png")
        repository().salva_capo(
            "demo",
            capo.model_copy(
                update={"foto": capo.foto.model_copy(update={"chiave_scontornata": senza_sfondo})}
            ),
        )
        archivio_foto().salva(capo.foto.chiave, b"originale", "image/jpeg")
        archivio_foto().salva(senza_sfondo, b"ritagliata", "image/png")

        attuale = corpo_di(profilo.leggi(evento(), None))
        archivio_foto().salva("avatar/demo.jpg", b"io-in-piedi", "image/jpeg")
        profilo.aggiorna(evento(corpo={**attuale, "avatar_foto_chiave": "avatar/demo.jpg"}), None)

        archivio = zipfile.ZipFile(io.BytesIO(esportazione.archivio_per("demo")))
        assert archivio.read(f"foto/{capo.id}.jpg") == b"originale"
        assert archivio.read(f"foto/{capo.id}-senza-sfondo.png") == b"ritagliata"
        assert archivio.read("foto/avatar.jpg") == b"io-in-piedi"

    def test_dati_json_non_contiene_nessun_indirizzo_firmato(self):
        """Il gate che conta, e che non elenca campi.

        Un URL firmato di questo backend **non è solo lettura**: `_foto_put` e
        `_foto_get` verificano la stessa firma (`T-46`), quindi un indirizzo di
        lettura vale come scrittura per tutti e sette i suoi giorni. Metterne
        anche uno solo in un file che il LEGGIMI dice che puoi girare a chi
        vuoi sarebbe consegnare le chiavi dell'archivio foto.

        Si cerca `firma=` e non un elenco di campi di proposito: un campo `url`
        aggiunto domani dentro un modello annidato lo prenderebbe comunque.
        """
        self._con_foto_vere()
        # Gli indirizzi firmati **si scrivono davvero**, altrimenti questo test
        # non prova niente: nei finti il repository restituisce `url=None` — è
        # `handlers/capi.py` a decorare le risposte, non il deposito. Ma
        # `Profilo.foto_url` lo persiste il `PUT /profilo`, e un `Capo` salvato
        # con la sua `url` dentro resta tale: il campo esiste sul modello, e il
        # giorno che qualcuno lo scrive l'esportazione lo porterebbe fuori.
        capo = repository().elenca_capi("demo")[0]
        repository().salva_capo(
            "demo",
            capo.model_copy(
                update={
                    "foto": capo.foto.model_copy(
                        update={"url": "http://api/foto/k?scade=999&firma=deadbeef"}
                    )
                }
            ),
        )
        attuale = corpo_di(profilo.leggi(evento(), None))
        profilo.aggiorna(
            evento(corpo={**attuale, "foto_url": "http://api/foto/avatar?scade=999&firma=cafe"}),
            None,
        )

        archivio = zipfile.ZipFile(io.BytesIO(esportazione.archivio_per("demo")))
        grezzo = archivio.read("dati.json").decode()
        assert "firma=" not in grezzo
        assert "deadbeef" not in grezzo and "cafe" not in grezzo
        # E le foto vere ci sono lo stesso: non si è svuotato l'archivio per
        # far passare l'asserzione qui sopra.
        assert [v for v in archivio.namelist() if v.startswith("foto/")]

    def test_non_contiene_larmadio_di_qualcun_altro(self):
        """L'isolamento fra utenti è la cosa che questo endpoint può sbagliare
        in modo peggiore: l'id viene dal JWT quando l'URL si firma, e dalla
        firma quando si scarica — mai da un parametro non coperto."""
        vuoto = zipfile.ZipFile(io.BytesIO(esportazione.archivio_per("nessuno")))
        dati = json.loads(vuoto.read("dati.json"))
        assert dati["capi"] == []
        assert dati["profilo"] is None

    def test_una_foto_illeggibile_non_fa_cadere_tutto(self):
        """Un archivio in meno di una foto è ancora l'armadio di qualcuno; un
        500 perché un file è sparito dal disco non è niente."""
        self._con_foto_vere()

        class ArchivioRotto:
            def leggi(self, chiave: str) -> tuple[bytes, str]:
                raise OSError("disco via")

        with mock.patch.object(esportazione, "archivio_foto", lambda: ArchivioRotto()):
            byte = esportazione.archivio_per("demo")
        archivio = zipfile.ZipFile(io.BytesIO(byte))
        assert [v for v in archivio.namelist() if v.startswith("foto/")] == []
        assert json.loads(archivio.read("dati.json"))["capi"] != []


class TestSvuotamento:
    """L'unica operazione del backend che distrugge davvero.

    Quello che questi test **non** possono dire è scritto nel docstring di
    `RepositoryInMemoria.svuota_armadio`: qui lo stato è già partizionato per
    utente, quindi un errore di ambito è strutturalmente impossibile, mentre in
    SQL è una `where` dimenticata e cancella la tabella. Quella riga è stata
    provata contro un Postgres vero — `docs/PROGRESS.md` dice come.
    """

    def _armadio_di(self, utente: str) -> None:
        for indice in range(2):
            capo = costruisci_capo(f"{utente}-capo-{indice}", TipoCapo.TOP)
            repository().salva_capo(utente, capo)
            archivio_foto().salva(f"capi/{utente}/g/{indice}", b"foto", "image/jpeg")

    def test_svuota_e_dice_quanto(self):
        risposta = svuotamento.svuota(evento(corpo={"conferma": "SVUOTA"}), None)
        assert risposta["statusCode"] == 200
        conto = corpo_di(risposta)
        assert conto["capi"] > 0
        assert repository().elenca_capi("demo") == []
        assert repository().elenca_outfit("demo") == []

    def test_senza_la_parola_non_cancella_niente(self):
        """La difesa che sopravvive a un `curl` ricopiato, a un deep-link e a
        una richiesta rimandata due volte dalla libreria di rete — cioè a tutto
        ciò a cui il campo di conferma nella schermata **non** sopravvive."""
        prima = len(repository().elenca_capi("demo"))
        assert prima > 0
        for storto in [{}, {"conferma": "svuota"}, {"conferma": "ELIMINA"}, {"conferma": ""}]:
            risposta = svuotamento.svuota(evento(corpo=storto), None)
            assert risposta["statusCode"] == 422, storto
        assert len(repository().elenca_capi("demo")) == prima

    def test_larmadio_di_un_altro_resta_intatto(self):
        """Il difetto peggiore che questa operazione possa avere, e l'unico che
        non si scopre guardando l'armadio di chi l'ha chiesta."""
        self._armadio_di("vicina")
        svuotamento.svuota(evento(corpo={"conferma": "SVUOTA"}), None)
        assert len(repository().elenca_capi("vicina")) == 2
        assert archivio_foto().leggi("capi/vicina/g/0")[0] == b"foto"

    def test_porta_via_le_foto_ma_non_quella_dellavatar(self):
        """La foto a figura intera sta sotto lo **stesso prefisso** delle altre
        — passa dallo stesso upload — ma non è dell'armadio: è del profilo, che
        resta (scelta dell'utente, 2026-09-23). Si esclude per chiave, e
        escludere è la direzione sicura: al massimo protegge un file di troppo.
        """
        archivio_foto().salva("capi/demo/g/1", b"un-capo", "image/jpeg")
        archivio_foto().salva("capi/demo/g/avatar", b"io-in-piedi", "image/jpeg")
        attuale = corpo_di(profilo.leggi(evento(), None))
        profilo.aggiorna(
            evento(corpo={**attuale, "avatar_foto_chiave": "capi/demo/g/avatar"}), None
        )

        svuotamento.svuota(evento(corpo={"conferma": "SVUOTA"}), None)

        assert archivio_foto().leggi("capi/demo/g/avatar")[0] == b"io-in-piedi"
        with pytest.raises(ErroreDominio):
            archivio_foto().leggi("capi/demo/g/1")

    def test_non_tocca_lutente_il_cui_id_comincia_uguale(self):
        """`prefisso_foto` finisce con uno slash, e questo test è l'unica cosa
        che lo tiene fermo.

        Senza, il prefisso `capi/demo` prenderebbe anche `capi/demo-bis/…` —
        cioè le foto di un altro, dentro l'unica operazione irreversibile che
        abbiamo. Gli id sono `uuid4().hex` e oggi non hanno prefissi comuni:
        difendersi da un formato di id è una garanzia che nessuno impone, e che
        cambia il giorno che qualcuno rende gli id leggibili.
        """
        archivio_foto().salva("capi/demo/g/mia", b"mia", "image/jpeg")
        archivio_foto().salva("capi/demo-bis/g/sua", b"sua", "image/jpeg")
        svuotamento.svuota(evento(corpo={"conferma": "SVUOTA"}), None)
        assert archivio_foto().leggi("capi/demo-bis/g/sua")[0] == b"sua"

    def test_il_profilo_sopravvive_con_le_sue_misure(self):
        attuale = corpo_di(profilo.leggi(evento(), None))
        profilo.aggiorna(evento(corpo={**attuale, "misure": {"altezza_cm": 168}}), None)
        svuotamento.svuota(evento(corpo={"conferma": "SVUOTA"}), None)
        dopo = corpo_di(profilo.leggi(evento(), None))
        assert dopo["misure"]["altezza_cm"] == 168
        assert dopo["citta"] == "Milano"
        assert "neutri" in dopo["preferenze"]["palette"]

    def test_le_conversazioni_spariscono_coi_loro_turni(self):
        repository().salva_conversazione_chat(
            "demo",
            ConversazioneChat(
                id="c1", titolo="Cosa metto", creata_il=ADESSO, ultimo_turno_il=ADESSO
            ),
        )
        repository().salva_messaggio_chat(
            "demo",
            "c1",
            MessaggioChat(id="m1", ruolo=RuoloChat.UTENTE, testo="ciao", creato_il=ADESSO),
        )
        svuotamento.svuota(evento(corpo={"conferma": "SVUOTA"}), None)
        assert repository().elenca_conversazioni_chat("demo") == []
        assert repository().elenca_messaggi_chat("demo", "c1") == []

    def test_se_le_foto_non_si_cancellano_lo_dice_invece_di_tacere(self):
        """Una foto sopravvissuta a uno svuotamento completato vuol dire che la
        cancellazione ha mentito. Nell'esportazione una foto illeggibile si
        saltava, e lì era giusto: qui è il contrario."""

        class ArchivioRotto:
            def elimina_sotto(self, prefisso, tranne=frozenset()):
                raise OSError("disco via")

        with mock.patch.object(svuotamento, "archivio_foto", lambda: ArchivioRotto()):
            risposta = svuotamento.svuota(evento(corpo={"conferma": "SVUOTA"}), None)
        assert risposta["statusCode"] == 500
        assert corpo_di(risposta)["errore"] == "svuotamento_parziale"
        # E non è un rollback: le righe **sono** sparite, ed è esattamente ciò
        # che il messaggio deve far capire.
        assert repository().elenca_capi("demo") == []


class TestSegnalazioni:
    def _registra(self, email: str) -> str:
        """Un utente vero, con un'email in `repository_utenti`: serve perché
        `_e_amministratore` risale dall'id all'email — un `utente_id` di
        comodo come "demo" non basta qui."""
        from domain.autenticazione import genera_hash

        return repository_utenti().crea(email, genera_hash("password-lunga"))

    def test_crea_nasce_ricevuta_e_legata_a_chi_segnala(self):
        utente = self._registra("cugino@esempio.it")
        risposta = segnalazioni.crea(
            evento(corpo={"testo": "l'app si è chiusa caricando una foto"}, utente=utente), None
        )
        assert risposta["statusCode"] == 201
        dati = corpo_di(risposta)
        assert dati["stato"] == "ricevuta"
        assert dati["utente_id"] == utente

    def test_elenca_vede_solo_le_proprie_senza_essere_amministratore(self):
        io = self._registra("io@esempio.it")
        altro = self._registra("altro@esempio.it")
        segnalazioni.crea(evento(corpo={"testo": "problema mio"}, utente=io), None)
        segnalazioni.crea(evento(corpo={"testo": "problema di un altro"}, utente=altro), None)

        dati = corpo_di(segnalazioni.elenca(evento(utente=io), None))
        assert dati["amministratore"] is False
        assert [s["testo"] for s in dati["segnalazioni"]] == ["problema mio"]

    def test_elenca_amministratore_vede_tutte(self, monkeypatch: pytest.MonkeyPatch):
        admin = self._registra("admin@esempio.it")
        altro = self._registra("cugino@esempio.it")
        monkeypatch.setenv("EMAIL_AMMINISTRATORI", "admin@esempio.it")
        segnalazioni.crea(evento(corpo={"testo": "problema mio"}, utente=admin), None)
        segnalazioni.crea(evento(corpo={"testo": "problema del cugino"}, utente=altro), None)

        dati = corpo_di(segnalazioni.elenca(evento(utente=admin), None))
        assert dati["amministratore"] is True
        assert {s["testo"] for s in dati["segnalazioni"]} == {"problema mio", "problema del cugino"}

    def test_aggiorna_senza_essere_amministratore_e_un_403(self):
        utente = self._registra("cugino2@esempio.it")
        creata = corpo_di(
            segnalazioni.crea(evento(corpo={"testo": "problema"}, utente=utente), None)
        )

        risposta = segnalazioni.aggiorna(
            evento(
                corpo={"stato": "risolta"},
                percorso={"segnalazioneId": creata["id"]},
                utente=utente,
            ),
            None,
        )
        assert risposta["statusCode"] == 403

    def test_aggiorna_da_amministratore_cambia_lo_stato(self, monkeypatch: pytest.MonkeyPatch):
        admin = self._registra("admin2@esempio.it")
        monkeypatch.setenv("EMAIL_AMMINISTRATORI", "admin2@esempio.it")
        creata = corpo_di(
            segnalazioni.crea(evento(corpo={"testo": "problema"}, utente=admin), None)
        )

        risposta = segnalazioni.aggiorna(
            evento(
                corpo={"stato": "in_lavorazione"},
                percorso={"segnalazioneId": creata["id"]},
                utente=admin,
            ),
            None,
        )
        assert risposta["statusCode"] == 200
        assert corpo_di(risposta)["stato"] == "in_lavorazione"

    def test_aggiorna_una_segnalazione_inesistente_e_un_404(self, monkeypatch: pytest.MonkeyPatch):
        admin = self._registra("admin3@esempio.it")
        monkeypatch.setenv("EMAIL_AMMINISTRATORI", "admin3@esempio.it")

        risposta = segnalazioni.aggiorna(
            evento(
                corpo={"stato": "risolta"}, percorso={"segnalazioneId": "fantasma"}, utente=admin
            ),
            None,
        )
        assert risposta["statusCode"] == 404
