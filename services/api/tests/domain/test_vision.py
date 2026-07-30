"""Il modulo di visione: cosa accettiamo, cosa buttiamo, cosa rifiutiamo."""

from __future__ import annotations

import json

import pytest

from conftest import ADESSO, LETTURA_BUONA
from domain.errors import LetturaNonValida
from domain.models import AttributoCapo, SlotAvatar, TipoCapo
from domain.ports import ImmagineLlm
from domain.vision import (
    applica_soglie,
    crea_capo,
    estrai_json,
    interpreta_lettura,
    nome_capo,
    richiesta_analisi,
)


class TestEstraiJson:
    def test_accetta_json_pulito(self):
        assert estrai_json('{"a": 1}') == {"a": 1}

    def test_tollera_i_blocchi_di_codice(self):
        assert estrai_json('```json\n{"a": 1}\n```') == {"a": 1}

    def test_tollera_il_preambolo_gentile(self):
        assert estrai_json('Ecco il risultato:\n{"a": 1}\nSpero sia utile!') == {"a": 1}

    def test_rifiuta_il_testo_senza_json(self):
        with pytest.raises(LetturaNonValida, match="nessun oggetto JSON"):
            estrai_json("Mi dispiace, non riesco a vedere l'immagine.")

    def test_rifiuta_json_rotto(self):
        with pytest.raises(LetturaNonValida, match="JSON non valido"):
            estrai_json('{"a": 1,,}')

    def test_rifiuta_una_lista_di_scalari(self):
        # Cerchiamo un oggetto, non un JSON qualsiasi: `[1, 2, 3]` non contiene
        # graffe, quindi fallisce come qualunque altro testo senza oggetto.
        with pytest.raises(LetturaNonValida, match="nessun oggetto JSON"):
            estrai_json("[1, 2, 3]")

    def test_pesca_l_oggetto_dentro_una_lista(self):
        assert estrai_json('[{"a": 1}]') == {"a": 1}


class TestInterpretaLettura:
    def test_legge_una_risposta_valida(self):
        lettura = interpreta_lettura(json.dumps(LETTURA_BUONA))
        assert lettura.tipo is TipoCapo.TOP
        assert lettura.colore is not None
        assert lettura.colore.hex == "#E7DFD2"

    def test_rifiuta_un_tipo_fuori_enum(self):
        grezzo = {**LETTURA_BUONA, "tipo": "maglietta"}
        with pytest.raises(LetturaNonValida, match="fuori formato"):
            interpreta_lettura(json.dumps(grezzo))

    def test_rifiuta_un_hex_malformato(self):
        grezzo = {**LETTURA_BUONA, "colore": {"nome": "Panna", "hex": "panna"}}
        with pytest.raises(LetturaNonValida, match="fuori formato"):
            interpreta_lettura(json.dumps(grezzo))

    def test_rifiuta_campi_inventati(self):
        # extra="forbid": un modello che aggiunge campi ce lo dice subito,
        # invece di farci scoprire il disallineamento fra tre mesi.
        grezzo = {**LETTURA_BUONA, "prezzo_stimato": 39}
        with pytest.raises(LetturaNonValida):
            interpreta_lettura(json.dumps(grezzo))


class TestApplicaSoglie:
    def test_svuota_gli_attributi_a_bassa_confidenza(self):
        grezzo = {
            **LETTURA_BUONA,
            "confidenze": {**LETTURA_BUONA["confidenze"], "materiale": 30},
        }
        pulita = applica_soglie(interpreta_lettura(json.dumps(grezzo)))
        assert pulita.materiale is None
        assert AttributoCapo.MATERIALE not in pulita.confidenze
        # Gli altri non li tocca.
        assert pulita.lavaggio == "40°"

    def test_lascia_intatta_una_lettura_sicura(self):
        lettura = interpreta_lettura(json.dumps(LETTURA_BUONA))
        assert applica_soglie(lettura) == lettura


class TestNomeCapo:
    def test_preferisce_il_nome_proposto(self):
        assert nome_capo(interpreta_lettura(json.dumps(LETTURA_BUONA))) == "Camicia in lino"

    def test_ripiega_su_sottotipo_e_colore(self):
        grezzo = {**LETTURA_BUONA, "nome_proposto": None}
        assert nome_capo(interpreta_lettura(json.dumps(grezzo))) == "Camicia panna"


class TestCreaCapo:
    def _crea(self, grezzo: dict) -> object:
        return crea_capo(
            interpreta_lettura(json.dumps(grezzo)),
            capo_id="c1",
            chiave_foto="capi/demo/c1.jpg",
            provider="finto",
            modello="finto-1",
            adesso=ADESSO,
        )

    def test_costruisce_un_capo_completo(self):
        capo = self._crea(LETTURA_BUONA)
        assert capo.nome == "Camicia in lino"
        assert capo.slot is SlotAvatar.TOP
        assert capo.colore.hex == "#E7DFD2"
        assert capo.analisi is not None
        assert capo.analisi.provider == "finto"

    def test_lo_slot_segue_il_tipo(self):
        assert self._crea({**LETTURA_BUONA, "tipo": "capospalla"}).slot is SlotAvatar.OUTER
        assert self._crea({**LETTURA_BUONA, "tipo": "scarpe"}).slot is SlotAvatar.SHOES
        assert self._crea({**LETTURA_BUONA, "tipo": "abito"}).slot is SlotAvatar.DRESS

    def test_senza_tipo_non_esiste_un_capo(self):
        with pytest.raises(LetturaNonValida, match="tipo di capo"):
            self._crea({**LETTURA_BUONA, "tipo": None})

    def test_senza_colore_l_avatar_non_potrebbe_indossarlo(self):
        with pytest.raises(LetturaNonValida, match="colore dominante"):
            self._crea({**LETTURA_BUONA, "colore": None})

    def test_un_colore_incerto_e_un_capo_rifiutato(self):
        # La confidenza sotto soglia svuota il colore, e senza colore il capo
        # non si può salvare: è il comportamento che vogliamo, non un caso
        # limite. Meglio richiedere la foto che salvare un capo invisibile.
        grezzo = {**LETTURA_BUONA, "confidenze": {**LETTURA_BUONA["confidenze"], "colore": 20}}
        with pytest.raises(LetturaNonValida, match="colore dominante"):
            self._crea(grezzo)

    def test_porta_la_chiave_scontornata_se_presente(self):
        capo = crea_capo(
            interpreta_lettura(json.dumps(LETTURA_BUONA)),
            capo_id="c1",
            chiave_foto="capi/demo/c1.jpg",
            chiave_scontornata="capi/demo/c1.jpg-scontornata",
            provider="finto",
            modello="finto-1",
            adesso=ADESSO,
        )
        assert capo.foto.chiave_scontornata == "capi/demo/c1.jpg-scontornata"

    def test_senza_scontorno_la_chiave_resta_vuota(self):
        capo = self._crea(LETTURA_BUONA)
        assert capo.foto.chiave_scontornata is None


class TestRichiestaAnalisi:
    def test_porta_immagine_schema_e_temperatura_bassa(self):
        richiesta = richiesta_analisi(
            ImmagineLlm(media_type="image/jpeg", base64="Zm90bw=="), "finto-1"
        )
        assert len(richiesta.immagini) == 1
        assert richiesta.forza_json is True
        assert richiesta.schema_atteso is not None
        assert richiesta.temperatura <= 0.2

    def test_lo_schema_non_porta_vincoli_che_i_provider_rifiutano(self):
        schema = richiesta_analisi(
            ImmagineLlm(media_type="image/jpeg", base64="Zm90bw=="), "finto-1"
        ).schema_atteso
        serializzato = json.dumps(schema)
        for vietato in ("pattern", "minimum", "maximum", "minLength", "maxLength"):
            assert vietato not in serializzato
