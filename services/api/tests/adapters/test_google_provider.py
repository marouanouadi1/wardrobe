"""La conversione dello schema per Gemini: niente `additionalProperties`, niente `type` a lista."""

from __future__ import annotations

from adapters.llm.google_provider import _converti_schema
from domain.vision import schema_lettura


class TestConvertiSchema:
    def test_toglie_additional_properties(self):
        convertito = _converti_schema(
            {"type": "object", "additionalProperties": False, "properties": {}}
        )
        assert "additionalProperties" not in convertito

    def test_type_a_lista_con_null_diventa_nullable(self):
        convertito = _converti_schema({"type": ["string", "null"]})
        assert convertito == {"type": "string", "nullable": True}

    def test_any_of_con_ramo_null_si_appiattisce(self):
        convertito = _converti_schema(
            {"anyOf": [{"type": "string", "enum": ["a", "b"]}, {"type": "null"}]}
        )
        assert convertito == {"type": "string", "enum": ["a", "b"], "nullable": True}

    def test_none_sparisce_dall_enum(self):
        convertito = _converti_schema({"type": ["string", "null"], "enum": ["a", "b", None]})
        assert convertito == {"type": "string", "nullable": True, "enum": ["a", "b"]}

    def test_ricorre_dentro_properties_annidate(self):
        convertito = _converti_schema(
            {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "colore": {"type": ["object", "null"], "additionalProperties": False}
                },
            }
        )
        assert "additionalProperties" not in convertito["properties"]["colore"]
        assert convertito["properties"]["colore"]["nullable"] is True

    def test_lo_schema_di_produzione_non_porta_piu_i_costrutti_vietati(self):
        """Lo schema reale di `vision.py`, dopo la conversione, non deve contenere
        nessuno dei costrutti che Gemini rifiuta con 400 (verificato in una
        chiamata di prova diretta all'API)."""
        import json

        convertito = _converti_schema(schema_lettura())
        serializzato = json.dumps(convertito)
        assert "additionalProperties" not in serializzato

        def nodi(oggetto: object):
            if isinstance(oggetto, dict):
                yield oggetto
                for valore in oggetto.values():
                    yield from nodi(valore)
            elif isinstance(oggetto, list):
                for elemento in oggetto:
                    yield from nodi(elemento)

        for nodo in nodi(convertito):
            assert not isinstance(nodo.get("type"), list), nodo
