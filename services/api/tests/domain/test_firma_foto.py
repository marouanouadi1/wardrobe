"""La firma HMAC di /foto/{chiave}: l'unico controllo su quella rotta."""

from __future__ import annotations

from domain.firma_foto import firma_foto, firma_valida

SEGRETO = "segreto-di-test-lungo-abbastanza-per-hmac-sha256"


class TestFirmaValida:
    def test_una_firma_giusta_prima_della_scadenza_e_valida(self):
        scade = 2_000_000_000
        firma = firma_foto("capi/demo/1.jpg", scade, SEGRETO)
        assert firma_valida("capi/demo/1.jpg", scade, firma, SEGRETO, adesso_epoch=1_000)

    def test_dopo_la_scadenza_non_e_piu_valida(self):
        scade = 1_000
        firma = firma_foto("capi/demo/1.jpg", scade, SEGRETO)
        assert not firma_valida("capi/demo/1.jpg", scade, firma, SEGRETO, adesso_epoch=1_001)

    def test_una_chiave_diversa_da_quella_firmata_non_passa(self):
        scade = 2_000_000_000
        firma = firma_foto("capi/demo/1.jpg", scade, SEGRETO)
        assert not firma_valida("capi/demo/2.jpg", scade, firma, SEGRETO, adesso_epoch=1_000)

    def test_una_scadenza_diversa_da_quella_firmata_non_passa(self):
        """Anche se la firma stessa è una stringa esadecimale valida:
        cambiare `scade` senza rifirmare deve bastare a farla cadere."""
        firma = firma_foto("capi/demo/1.jpg", 2_000_000_000, SEGRETO)
        assert not firma_valida(
            "capi/demo/1.jpg", 2_000_000_001, firma, SEGRETO, adesso_epoch=1_000
        )

    def test_un_segreto_diverso_non_produce_la_stessa_firma(self):
        scade = 2_000_000_000
        firma = firma_foto("capi/demo/1.jpg", scade, SEGRETO)
        assert not firma_valida(
            "capi/demo/1.jpg", scade, firma, "un-altro-segreto", adesso_epoch=1_000
        )
