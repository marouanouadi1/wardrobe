"""Gli handler: solo il loro lavoro, cioè tradurre evento -> dominio -> HTTP.

Non riverificano le regole dell'armadio (quelle stanno nei test del dominio):
verificano che i parametri arrivino, che gli errori diventino status, e che
nessun handler stia nascondendo logica.
"""

from __future__ import annotations

import json
import tomllib
from pathlib import Path
from typing import Any

import pytest

from conftest import ADESSO, costruisci_capo, intestazioni_utente
from domain.errors import NonAutenticato
from domain.models import PreferenzeStile, Profilo, StatoCapo, TipoCapo
from handlers import auth, capi, foto, health, outfit, playground, profilo, segnalazioni
from handlers._container import repository, repository_utenti
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

    def test_crea_un_capo_a_mano(self):
        risposta = capi.crea(
            evento(
                corpo={
                    "nome": "Camicia in lino",
                    "tipo": "top",
                    "colore": {"nome": "Panna", "hex": "#E7DFD2"},
                    "chiave_foto": "capi/demo/manuale.jpg",
                }
            ),
            None,
        )
        assert risposta["statusCode"] == 201
        dati = corpo_di(risposta)
        assert dati["nome"] == "Camicia in lino"
        assert dati["slot"] == "top"
        # `ok()` serializza con `exclude_none=True`: un capo senza analisi non
        # ha nemmeno la chiave, non la ha a `null`.
        assert "analisi" not in dati
        # È subito in armadio: nessun secondo passo, nessuna analisi asincrona.
        assert corpo_di(capi.elenca(evento(), None))["totale"] == 13

    def test_un_capo_a_mano_senza_tipo_e_un_422(self):
        risposta = capi.crea(
            evento(corpo={"nome": "Senza tipo", "colore": {"nome": "Nero", "hex": "#111111"}}), None
        )
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


class TestPlayground:
    def test_elenca_i_modelli_con_la_spia_configurato(self):
        modelli = corpo_di(playground.modelli(evento(), None))
        assert modelli
        assert {"provider", "id", "configurato"} <= set(modelli[0])

    def test_elenca_i_due_preset(self):
        preset = corpo_di(playground.preset(evento(), None))
        assert {p["job"] for p in preset} == {"analisi_capo", "suggerimento"}

    def test_mostra_il_contesto_iniettato(self):
        contesto = corpo_di(playground.contesto(evento(), None))
        # I capi in lavatrice non sono fra i disponibili, ma il modello sa che
        # esistono: è la differenza fra una proposta e una proposta che convince.
        assert len(contesto["capi_disponibili"]) == 9
        assert len(contesto["in_lavaggio"]) == 3

    def test_lo_storico_parte_vuoto(self):
        assert corpo_di(playground.storico(evento(), None)) == []

    def test_un_provider_sconosciuto_e_un_400(self):
        risposta = playground.esegui_test(
            evento(corpo={"job": "suggerimento", "provider": "inventato", "modello": "x"}), None
        )
        assert risposta["statusCode"] == 400
        assert corpo_di(risposta)["errore"] == "provider_sconosciuto"

    def test_un_provider_senza_chiave_e_un_503(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        risposta = playground.esegui_test(
            evento(corpo={"job": "suggerimento", "provider": "openai", "modello": "gpt-5.1"}), None
        )
        assert risposta["statusCode"] == 503
        assert corpo_di(risposta)["errore"] == "provider_non_configurato"


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
