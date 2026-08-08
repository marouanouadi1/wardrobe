"""Gli handler: solo il loro lavoro, cioè tradurre evento -> dominio -> HTTP.

Non riverificano le regole dell'armadio (quelle stanno nei test del dominio):
verificano che i parametri arrivino, che gli errori diventino status, e che
nessun handler stia nascondendo logica.
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from domain.errors import RichiestaNonValida
from handlers import auth, capi, foto, health, outfit, playground, profilo
from handlers._container import repository_utenti
from handlers._http import utente_id


def evento(
    *,
    corpo: dict[str, Any] | None = None,
    percorso: dict[str, str] | None = None,
    query: dict[str, str] | None = None,
    utente: str = "demo",
) -> dict[str, Any]:
    return {
        "headers": {"x-utente": utente},
        "pathParameters": percorso or {},
        "queryStringParameters": query or {},
        "body": json.dumps(corpo) if corpo is not None else "",
    }


def corpo_di(risposta: dict[str, Any]) -> Any:
    return json.loads(risposta["body"])


class TestSalute:
    def test_risponde_ok(self):
        risposta = health.salute(evento(), None)
        assert risposta["statusCode"] == 200
        assert corpo_di(risposta)["stato"] == "ok"


class TestAuth:
    def _crea_utente(self, email: str, password: str) -> None:
        from domain.autenticazione import genera_hash

        repository_utenti().crea(email, genera_hash(password))

    def test_credenziali_giuste_restituiscono_un_token(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("JWT_SECRET", "segreto-di-test-lungo-abbastanza-per-hmac-sha256")
        self._crea_utente("prova@esempio.it", "password-lunga")

        risposta = auth.accedi(
            evento(corpo={"email": "prova@esempio.it", "password": "password-lunga"}), None
        )
        assert risposta["statusCode"] == 200
        assert corpo_di(risposta)["token"]

    def test_password_sbagliata_e_un_401(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("JWT_SECRET", "segreto-di-test-lungo-abbastanza-per-hmac-sha256")
        self._crea_utente("prova2@esempio.it", "password-lunga")

        risposta = auth.accedi(
            evento(corpo={"email": "prova2@esempio.it", "password": "sbagliata"}), None
        )
        assert risposta["statusCode"] == 401

    def test_email_inesistente_e_un_401(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("JWT_SECRET", "segreto-di-test-lungo-abbastanza-per-hmac-sha256")

        risposta = auth.accedi(
            evento(corpo={"email": "fantasma@esempio.it", "password": "qualsiasi"}), None
        )
        assert risposta["statusCode"] == 401

    def test_il_token_emesso_autentica_le_richieste_successive(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """Con AUTH_APERTA spenta, solo il token — non più l'header X-Utente
        senza verifica — deve identificare l'utente."""
        monkeypatch.setenv("JWT_SECRET", "segreto-di-test-lungo-abbastanza-per-hmac-sha256")
        monkeypatch.delenv("AUTH_APERTA", raising=False)
        self._crea_utente("prova3@esempio.it", "password-lunga")

        risposta = auth.accedi(
            evento(corpo={"email": "prova3@esempio.it", "password": "password-lunga"}), None
        )
        token = corpo_di(risposta)["token"]

        assert utente_id({"headers": {"authorization": f"Bearer {token}"}}) != "demo"

    def test_senza_auth_aperta_ne_token_e_una_richiesta_non_valida(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.delenv("AUTH_APERTA", raising=False)

        with pytest.raises(RichiestaNonValida):
            utente_id({"headers": {}})


class TestCapi:
    def test_elenca_l_armadio_seminato(self):
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

    def test_legge_il_profilo_seminato(self):
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
