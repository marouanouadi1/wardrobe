"""Lo stilista. La regola che conta: non può inventare capi."""

from __future__ import annotations

import json

import pytest

from conftest import OGGI, costruisci_capo
from domain.errors import SuggerimentoNonValido
from domain.models import Capo, Meteo, TipoCapo
from domain.stylist import (
    costruisci_contesto,
    interpreta_suggerimenti,
    payload_contesto,
    richiesta_suggerimento,
)


def _proposte(*gruppi: list[str], motivi: int = 3, match: int = 90) -> str:
    return json.dumps(
        {
            "proposte": [
                {
                    "titolo": "Comodo, ma tenuto",
                    "match": match,
                    "capi": capi,
                    "perche": [f"motivo {n}" for n in range(motivi)],
                }
                for capi in gruppi
            ]
        }
    )


class TestCostruisciContesto:
    def test_i_capi_sporchi_restano_fuori_dai_disponibili(self, armadio: list[Capo]):
        contesto = costruisci_contesto(armadio, oggi=OGGI)
        ids = {c.id for c in contesto.capi_disponibili}
        assert "t2" not in ids  # è da lavare
        assert "t1" in ids

    def test_ma_il_loro_nome_arriva_al_modello(self, armadio: list[Capo]):
        # Serve perché il modello possa dire «il lino lo lascio lì» invece di
        # ignorarlo senza spiegazioni.
        contesto = costruisci_contesto(armadio, oggi=OGGI)
        assert "T-shirt nera" in contesto.in_lavaggio

    def test_segnala_cosa_hai_messo_di_recente(self, armadio: list[Capo]):
        armadio = [
            *armadio,
            costruisci_capo("b9", TipoCapo.PANTALONI, nome="Chino", ultimo_uso=OGGI),
        ]
        contesto = costruisci_contesto(armadio, oggi=OGGI)
        assert "Chino" in contesto.indossati_di_recente

    def test_il_payload_e_leggibile_e_senza_campi_vuoti(self, armadio: list[Capo]):
        contesto = costruisci_contesto(
            armadio, oggi=OGGI, meteo=Meteo(citta="Milano", temp_c=12, condizione="pioggia leggera")
        )
        payload = payload_contesto(contesto)
        assert "Milano" in payload
        assert "null" not in payload
        assert json.loads(payload)["meteo"]["temp_c"] == 12


class TestInterpretaSuggerimenti:
    def test_costruisce_la_vestizione_dai_capi(self, armadio: list[Capo]):
        proposte = interpreta_suggerimenti(_proposte(["t1", "b1", "s1"]), armadio)
        assert len(proposte) == 1
        assert proposte[0].vestizione.top == "t1"
        assert proposte[0].vestizione.bottom == "b1"
        assert proposte[0].vestizione.shoes == "s1"
        assert proposte[0].vestizione.outer is None

    def test_un_capo_inventato_e_un_errore(self, armadio: list[Capo]):
        with pytest.raises(SuggerimentoNonValido, match="non esistono"):
            interpreta_suggerimenti(_proposte(["t1", "b1", "cintura-dorata"]), armadio)

    def test_due_capi_nello_stesso_slot_sono_un_errore(self, armadio: list[Capo]):
        with pytest.raises(SuggerimentoNonValido, match="stesso slot"):
            interpreta_suggerimenti(_proposte(["t1", "t2", "b1"]), armadio)

    def test_scarta_le_proposte_non_indossabili_e_tiene_le_altre(self, armadio: list[Capo]):
        # Una proposta zoppa non deve far cadere anche quelle buone: il modello
        # su tre ne sbaglia una, e l'utente non deve pagare un problema nostro.
        proposte = interpreta_suggerimenti(_proposte(["t1"], ["t1", "b1"]), armadio)
        assert len(proposte) == 1
        assert proposte[0].vestizione.bottom == "b1"

    def test_se_nessuna_e_indossabile_e_un_errore(self, armadio: list[Capo]):
        with pytest.raises(SuggerimentoNonValido, match="indossabile"):
            interpreta_suggerimenti(_proposte(["t1"], ["s1"]), armadio)

    def test_taglia_i_motivi_a_tre(self, armadio: list[Capo]):
        proposte = interpreta_suggerimenti(_proposte(["t1", "b1"], motivi=7), armadio)
        assert len(proposte[0].perche) == 3

    def test_riporta_il_match_dentro_i_limiti(self, armadio: list[Capo]):
        proposte = interpreta_suggerimenti(_proposte(["t1", "b1"], match=180), armadio)
        assert proposte[0].match == 100

    def test_un_abito_da_solo_basta(self):
        abito = costruisci_capo("d1", TipoCapo.ABITO, nome="Abito nero")
        proposte = interpreta_suggerimenti(_proposte(["d1"]), [abito])
        assert proposte[0].vestizione.dress == "d1"

    def test_rifiuta_una_risposta_senza_proposte(self, armadio: list[Capo]):
        with pytest.raises(SuggerimentoNonValido, match="nessuna proposta"):
            interpreta_suggerimenti('{"proposte": []}', armadio)

    def test_rifiuta_una_proposta_senza_capi(self, armadio: list[Capo]):
        with pytest.raises(SuggerimentoNonValido, match="senza capi"):
            interpreta_suggerimenti('{"proposte": [{"titolo": "x", "capi": []}]}', armadio)


class TestRichiestaSuggerimento:
    def test_inietta_il_contesto_nel_prompt(self, armadio: list[Capo]):
        contesto = costruisci_contesto(
            armadio, oggi=OGGI, richiesta_utente="cena fuori, ho freddo", numero_proposte=2
        )
        richiesta = richiesta_suggerimento(contesto, "finto-1")
        assert "cena fuori, ho freddo" in richiesta.prompt
        assert "Proponi 2 outfit" in richiesta.prompt
        assert richiesta.system is not None
        assert "Non inventare capi" in richiesta.system

    def test_non_manda_immagini(self, armadio: list[Capo]):
        # Lo stilista ragiona sul testo: mandargli anche le foto triplicherebbe
        # il costo senza migliorare la proposta.
        richiesta = richiesta_suggerimento(costruisci_contesto(armadio, oggi=OGGI), "finto-1")
        assert richiesta.immagini == []
