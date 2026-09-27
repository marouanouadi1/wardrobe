"""Le regole dell'armadio che servono all'IA: slot, vestizioni, sintesi."""

from __future__ import annotations

from conftest import costruisci_capo
from domain.models import (
    Capo,
    Vestizione,
)
from domain.wardrobe import (
    per_id,
    sintetizza,
    vestizione_da_capi,
    vestizione_indossabile,
)


class TestVestizione:
    def test_assegna_ogni_capo_al_suo_slot(self, armadio: list[Capo]):
        vestizione, scartati = vestizione_da_capi(["t1", "b1", "s1", "o1"], per_id(armadio))
        assert scartati == []
        assert (vestizione.top, vestizione.bottom) == ("t1", "b1")
        assert (vestizione.shoes, vestizione.outer) == ("s1", "o1")

    def test_il_secondo_capo_dello_stesso_slot_viene_scartato(self, armadio: list[Capo]):
        vestizione, scartati = vestizione_da_capi(["t1", "t2"], per_id(armadio))
        assert vestizione.top == "t1"
        assert scartati == ["t2"]

    def test_un_id_che_non_e_nell_armadio_viene_scartato(self, armadio: list[Capo]):
        """Il modello può proporre un id che non esiste: non entra, e si sa quale."""
        vestizione, scartati = vestizione_da_capi(["inventato"], per_id(armadio))
        assert scartati == ["inventato"]
        assert vestizione == Vestizione()

    def test_serve_sopra_e_sotto(self):
        assert not vestizione_indossabile(Vestizione(top="t1"))
        assert vestizione_indossabile(Vestizione(top="t1", bottom="b1"))

    def test_un_abito_basta_da_solo(self):
        assert vestizione_indossabile(Vestizione(dress="d1"))


class TestSintetizza:
    def test_porta_le_etichette_nel_contesto(self):
        capo = costruisci_capo("t1").model_copy(update={"etichette": ["da lavoro"]})
        sintetico = sintetizza(capo)
        assert sintetico.etichette == ["da lavoro"]

    def test_senza_etichette_la_lista_e_vuota(self):
        assert sintetizza(costruisci_capo("t1")).etichette == []
