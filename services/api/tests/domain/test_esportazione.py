"""L'archivio «scarica i tuoi dati»: la firma che lo autorizza, e lo zip.

L'URL firmato è, di fatto, **una credenziale al portatore su tutto l'armadio**:
chi ce l'ha scarica capi, outfit, profilo, misure e conversazioni senza un
token. Qui si prova che non la si ottiene per caso, e che lo zip contiene
davvero quello che promette.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from domain.esportazione import (
    componi_esportazione,
    firma_esportazione,
    firma_esportazione_valida,
    senza_campi_interni,
    utente_da_query,
)
from domain.firma_foto import firma_foto

SEGRETO = "un-segreto-di-prova"
ADESSO = 1_700_000_000
FRA_UN_QUARTO_DORA = ADESSO + 900


class TestFirma:
    def test_la_firma_giusta_vale_finche_non_scade(self):
        firma = firma_esportazione("demo", FRA_UN_QUARTO_DORA, SEGRETO)
        assert firma_esportazione_valida("demo", FRA_UN_QUARTO_DORA, firma, SEGRETO, ADESSO)

    def test_scaduta_non_vale_piu(self):
        firma = firma_esportazione("demo", ADESSO - 1, SEGRETO)
        assert not firma_esportazione_valida("demo", ADESSO - 1, firma, SEGRETO, ADESSO)

    def test_non_vale_per_un_altro_utente(self):
        """Il caso che conta: cambiare `utente` nella query e scaricare
        l'armadio di qualcun altro. L'id è **dentro** il messaggio firmato, non
        accanto ad esso."""
        firma = firma_esportazione("demo", FRA_UN_QUARTO_DORA, SEGRETO)
        assert not firma_esportazione_valida("altro", FRA_UN_QUARTO_DORA, firma, SEGRETO, ADESSO)

    def test_non_vale_se_si_sposta_la_scadenza(self):
        firma = firma_esportazione("demo", FRA_UN_QUARTO_DORA, SEGRETO)
        assert not firma_esportazione_valida(
            "demo", FRA_UN_QUARTO_DORA + 86_400, firma, SEGRETO, ADESSO
        )

    def test_una_firma_di_foto_non_vale_come_esportazione(self):
        """Le due firme usano lo **stesso segreto** (`JWT_SECRET`), quindi
        senza separazione di contesto una firma emessa per la foto di chiave
        `demo` sarebbe bit per bit una firma d'esportazione per l'utente
        `demo` — e le URL delle foto vivono sette giorni, e stanno dentro ogni
        `Capo` che l'app riceve. Sarebbe un'escalation silenziosa da «vedo una
        miniatura» a «scarico tutto»."""
        di_foto = firma_foto("demo", FRA_UN_QUARTO_DORA, SEGRETO)
        assert not firma_esportazione_valida("demo", FRA_UN_QUARTO_DORA, di_foto, SEGRETO, ADESSO)
        # E il verso opposto, che è l'altra metà della stessa confusione.
        di_esportazione = firma_esportazione("demo", FRA_UN_QUARTO_DORA, SEGRETO)
        assert di_esportazione != di_foto


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


class TestUtenteDaQuery:
    """La riga che decide di chi è l'armadio che si sta per consegnare.

    Il ramo che la chiama è **fuori da `@endpoint`**: non ha chi traduca
    un'eccezione in uno status, quindi qui ogni ingresso storto deve tornare
    `None` e mai sollevare — altrimenti il thread muore e la connessione si
    chiude senza risposta.
    """

    def _query(self, utente: str = "demo", scade: int = FRA_UN_QUARTO_DORA) -> str:
        firma = firma_esportazione(utente, scade, SEGRETO)
        return f"utente={utente}&scade={scade}&firma={firma}"

    def test_una_query_buona_da_lutente(self):
        assert utente_da_query(self._query(), SEGRETO, ADESSO) == "demo"

    def test_scaduta_no(self):
        assert utente_da_query(self._query(scade=ADESSO - 1), SEGRETO, ADESSO) is None

    def test_utente_cambiato_a_mano_no(self):
        storta = self._query().replace("utente=demo", "utente=altro")
        assert utente_da_query(storta, SEGRETO, ADESSO) is None

    @pytest.mark.parametrize(
        "query",
        [
            "",
            "utente=demo",
            "utente=demo&scade=123",
            "utente=&scade=123&firma=aa",
            "utente=demo&scade=abc&firma=aa",
            # `'²'.isdigit()` è **True** — è un apice, non una cifra decimale —
            # e `int('²')` solleva. Con `isdigit()` questo ingresso uccideva il
            # thread invece di dare 403.
            "utente=demo&scade=²&firma=aa",
            # `compare_digest` fra `str` solleva `TypeError` appena una delle
            # due esce dall'ASCII.
            "utente=demo&scade=1700000000&firma=é",
            # Python rifiuta di convertire un intero con più di 4300 cifre.
            "utente=demo&scade=" + "9" * 5000 + "&firma=aa",
        ],
    )
    def test_ogni_ingresso_storto_torna_none_e_non_solleva(self, query):
        assert utente_da_query(query, SEGRETO, ADESSO) is None
