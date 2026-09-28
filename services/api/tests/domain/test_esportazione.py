"""L'archivio «scarica i tuoi dati»: che lo zip contenga davvero quello che
promette, e niente degli indirizzi interni."""

from __future__ import annotations

import io
import zipfile

from domain.esportazione import componi_esportazione, senza_campi_interni


class TestArchivio:
    def _apri(self, byte: bytes) -> zipfile.ZipFile:
        return zipfile.ZipFile(io.BytesIO(byte))

    def test_contiene_i_dati_e_le_foto(self):
        byte = componi_esportazione('{"capi": []}', [("rossa.jpg", b"\xff\xd8finta")])
        with self._apri(byte) as archivio:
            assert archivio.read("dati.json") == b'{"capi": []}'
            assert archivio.read("foto/rossa.jpg") == b"\xff\xd8finta"
            assert "LEGGIMI.txt" in archivio.namelist()

    def test_senza_foto_resta_un_archivio_valido(self):
        with self._apri(componi_esportazione("{}", [])) as archivio:
            assert archivio.namelist() == ["dati.json", "LEGGIMI.txt"]

    def test_due_foto_diverse_restano_due_voci(self):
        byte = componi_esportazione("{}", [("a.jpg", b"x"), ("b.jpg", b"y")])
        with self._apri(byte) as archivio:
            assert archivio.read("foto/a.jpg") == b"x"
            assert archivio.read("foto/b.jpg") == b"y"


class TestSenzaCampiInterni:
    """Dall'archivio escono due famiglie di campi, per due motivi diversi.

    Gli **indirizzi firmati** perché scadono (quindi non sono una copia di
    niente) e perche' in questo backend un indirizzo di lettura vale anche come
    `PUT` (`T-46`). Le **chiavi d'archivio** perche' per chi apre lo zip non
    valgono niente — le foto si riappaiano dall'id del capo — mentre per chi le
    ottiene valgono: `POST /capi/analisi` accetta una `chiave_foto` senza
    controllare di chi sia (`T-47`).
    """

    def test_toglie_gli_indirizzi_firmati(self):
        ripulito = senza_campi_interni({"nome": "Felpa", "foto_url": "http://x?firma=ab"})
        assert ripulito == {"nome": "Felpa"}

    def test_toglie_anche_le_chiavi_darchivio(self):
        grezzo = {"id": "a", "foto": {"chiave": "capi/utente-42/x.jpg", "larghezza": 800}}
        assert senza_campi_interni(grezzo) == {"id": "a", "foto": {"larghezza": 800}}

    def test_li_toglie_a_qualunque_profondita(self):
        grezzo = {
            "capi": [
                {"id": "a", "foto": {"chiave": "k", "url": "u?firma=1", "larghezza": 10}},
                {"id": "b", "foto": {"chiave": "k2", "chiave_scontornata": "k3"}},
            ],
            "profilo": {"nome": "Chi", "avatar_foto_chiave": "avatar/x.jpg"},
        }
        assert senza_campi_interni(grezzo) == {
            "capi": [{"id": "a", "foto": {"larghezza": 10}}, {"id": "b", "foto": {}}],
            "profilo": {"nome": "Chi"},
        }

    def test_non_tocca_niente_altro(self):
        """Il verso opposto dello stesso errore: uno scrub troppo largo
        svuoterebbe l'archivio invece di ripulirlo, e nessuno se ne
        accorgerebbe finche' non apre lo zip."""
        grezzo = {"nome": "Felpa", "urlografia": "resta", "note": None, "conteggio": 3}
        assert senza_campi_interni(grezzo) == grezzo
