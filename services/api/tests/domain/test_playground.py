"""Il playground: costi, verdetti, e un provider che fallisce."""

from __future__ import annotations

import json

from conftest import ADESSO, LETTURA_BUONA, OGGI
from domain.errors import ErroreProvider
from domain.models import (
    Capo,
    EsitoEsecuzione,
    JobIa,
    RichiestaPlayground,
    UsoToken,
)
from domain.playground import PRESETS, calcola_costo, esegui, preset, preset_effettivo, traccia
from domain.ports import ImmagineLlm
from domain.stylist import costruisci_contesto
from fakes import ProviderFinto

IMMAGINE = ImmagineLlm(media_type="image/jpeg", base64="Zm90bw==")


def _richiesta(job: JobIa, contesto=None) -> RichiestaPlayground:
    return RichiestaPlayground(
        job=job,
        provider="finto",
        modello="finto-1",
        temperatura=0.3,
        max_token=900,
        contesto=contesto,
        chiave_foto="capi/demo.jpg" if job is JobIa.ANALISI_CAPO else None,
    )


class TestCalcolaCosto:
    def test_calcola_sui_token_usati(self):
        uso = UsoToken(token_input=1_000_000, token_output=500_000)
        costo = calcola_costo(uso, costo_input_eur_mtok=4.6, costo_output_eur_mtok=23.0)
        assert costo == 4.6 + 11.5

    def test_senza_listino_il_costo_e_ignoto_non_zero(self):
        # None e 0.0 dicono cose diverse: «non lo so» e «è gratis».
        uso = UsoToken(token_input=1000, token_output=100)
        assert calcola_costo(uso, costo_input_eur_mtok=None, costo_output_eur_mtok=None) is None

    def test_un_modello_locale_costa_zero_e_lo_dice(self):
        uso = UsoToken(token_input=5000, token_output=900)
        assert calcola_costo(uso, costo_input_eur_mtok=0.0, costo_output_eur_mtok=0.0) == 0.0


class TestEseguiAnalisi:
    def test_una_lettura_completa_e_ok(self):
        esito = esegui(
            _richiesta(JobIa.ANALISI_CAPO),
            ProviderFinto(json.dumps(LETTURA_BUONA)),
            immagine=IMMAGINE,
        )
        assert esito.ok is True
        assert esito.esito is EsitoEsecuzione.OK
        assert esito.lettura is not None
        assert esito.lettura.materiale == "Lino 100%"
        assert esito.latenza_ms == 42

    def test_una_lettura_povera_e_vaga(self):
        povera = {
            **LETTURA_BUONA,
            "materiale": None,
            "fantasia": None,
            "stagione": None,
            "vestibilita": None,
            "confidenze": dict.fromkeys(LETTURA_BUONA["confidenze"], 30),
        }
        esito = esegui(
            _richiesta(JobIa.ANALISI_CAPO), ProviderFinto(json.dumps(povera)), immagine=IMMAGINE
        )
        assert esito.ok is True
        assert esito.esito is EsitoEsecuzione.VAGO

    def test_una_risposta_fuori_formato_conserva_il_testo_grezzo(self):
        esito = esegui(
            _richiesta(JobIa.ANALISI_CAPO),
            ProviderFinto("Non riesco a vedere l'immagine, mi dispiace."),
            immagine=IMMAGINE,
        )
        assert esito.ok is False
        assert esito.esito is EsitoEsecuzione.ERRORE
        # Il testo grezzo è la cosa che serve davvero quando si confrontano due
        # provider: senza, resta solo «non ha funzionato».
        assert esito.testo is not None
        assert "mi dispiace" in esito.testo

    def test_senza_foto_fallisce_subito(self):
        esito = esegui(_richiesta(JobIa.ANALISI_CAPO), ProviderFinto(), immagine=None)
        assert esito.ok is False
        assert esito.errore is not None
        assert "foto" in esito.errore

    def test_un_provider_che_esplode_non_solleva(self):
        # Un provider che fallisce è un risultato del test, non un incidente:
        # lo storico serve proprio a vedere chi fallisce e quando.
        esito = esegui(
            _richiesta(JobIa.ANALISI_CAPO),
            ProviderFinto(errore=ErroreProvider("429 troppe richieste")),
            immagine=IMMAGINE,
        )
        assert esito.ok is False
        assert esito.errore is not None
        assert "429" in esito.errore


class TestEseguiSuggerimento:
    def _risposta(self, match: int = 92, motivi: int = 3) -> str:
        return json.dumps(
            {
                "proposte": [
                    {
                        "titolo": "Comodo, ma tenuto",
                        "match": match,
                        "capi": ["t1", "b1", "s1"],
                        "perche": [f"motivo {n}" for n in range(motivi)],
                    }
                ]
            }
        )

    def test_proposte_solide_sono_ok(self, armadio: list[Capo]):

        contesto = costruisci_contesto(armadio, oggi=OGGI)
        esito = esegui(
            _richiesta(JobIa.SUGGERIMENTO, contesto), ProviderFinto(self._risposta()), capi=armadio
        )
        assert esito.esito is EsitoEsecuzione.OK
        assert len(esito.suggerimenti) == 1

    def test_proposte_senza_convinzione_sono_vaghe(self, armadio: list[Capo]):

        contesto = costruisci_contesto(armadio, oggi=OGGI)
        esito = esegui(
            _richiesta(JobIa.SUGGERIMENTO, contesto),
            ProviderFinto(self._risposta(match=40)),
            capi=armadio,
        )
        assert esito.esito is EsitoEsecuzione.VAGO

    def test_senza_contesto_fallisce_subito(self):
        esito = esegui(_richiesta(JobIa.SUGGERIMENTO), ProviderFinto())
        assert esito.ok is False
        assert esito.errore is not None
        assert "contesto" in esito.errore


class TestPreset:
    def test_i_due_job_veri_hanno_un_preset(self):
        assert {p.job for p in PRESETS} == {JobIa.ANALISI_CAPO, JobIa.SUGGERIMENTO}

    def test_si_trova_per_id(self):
        assert preset("analisi-foto-capo") is not None
        assert preset("inesistente") is None

    def test_l_analisi_gira_a_temperatura_bassa(self):
        analisi = preset("analisi-foto-capo")
        assert analisi is not None
        assert analisi.temperatura <= 0.2


class TestPresetEffettivo:
    def test_senza_salvataggio_torna_il_default_di_fabbrica(self):
        di_fabbrica = preset("suggeritore-mattina")
        assert di_fabbrica is not None
        assert preset_effettivo("suggeritore-mattina", None) == di_fabbrica

    def test_il_salvato_vince_sul_default(self):
        di_fabbrica = preset("suggeritore-mattina")
        assert di_fabbrica is not None
        salvato = di_fabbrica.model_copy(update={"system_prompt": "Nuovo prompt di prova"})

        effettivo = preset_effettivo("suggeritore-mattina", salvato)
        assert effettivo.system_prompt == "Nuovo prompt di prova"


class TestTraccia:
    def test_registra_quello_che_serve_a_confrontare(self):
        richiesta = _richiesta(JobIa.ANALISI_CAPO)
        esito = esegui(richiesta, ProviderFinto(json.dumps(LETTURA_BUONA)), immagine=IMMAGINE)
        riga = traccia(
            richiesta, esito, esecuzione_id="e1", adesso=ADESSO, preset_id="analisi-foto-capo"
        )
        assert riga.provider == "finto"
        assert riga.temperatura == 0.3
        assert riga.esito is EsitoEsecuzione.OK
        assert riga.eseguita_il == ADESSO
