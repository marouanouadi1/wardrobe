"""La cancellazione per prefisso, sul filesystem vero.

**Questi test non potevano stare fra quelli degli handler**, che girano tutti
su `ArchivioInMemoria`: lì le chiavi sono voci di un dizionario e un prefisso è
uno `startswith`, mentre qui sono percorsi su disco, con cartelle da svuotare,
file `.contenttype` accanto a ogni foto, e un `rglob` che può uscire
dall'albero. È la stessa asimmetria per cui `svuota_armadio` va provata contro
un Postgres vero: l'adapter in memoria non ha la classe di difetti che conta.

`elimina_sotto` è, per costruzione, la funzione più pericolosa del backend —
una cancellazione ricorsiva con un argomento che viene da un id utente.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from adapters.filesystem import ArchivioFileSystem
from domain.errors import ErroreDominio


@pytest.fixture
def archivio(tmp_path: Path) -> ArchivioFileSystem:
    a = ArchivioFileSystem(str(tmp_path))
    a.salva("capi/alfa/2026-09-01/uno", b"capo1", "image/jpeg")
    a.salva("capi/alfa/2026-09-01/uno-scontornata", b"ritaglio", "image/png")
    a.salva("capi/alfa/2026-09-02/due", b"capo2", "image/jpeg")
    a.salva("capi/alfa/2026-09-03/avatar", b"io-in-piedi", "image/jpeg")
    a.salva("capi/alfa-bis/x", b"altro-utente", "image/jpeg")
    a.salva("capi/beta/2026-09-01/suo", b"di-beta", "image/jpeg")
    return a


def test_porta_via_solo_il_sottoalbero_chiesto(archivio: ArchivioFileSystem):
    # Quattro: le due foto, la scontornata, e l'avatar — che qui **non** è
    # escluso. I `.contenttype` spariscono con loro ma non si contano: sono
    # nostri, non file della persona.
    assert archivio.elimina_sotto("capi/alfa/") == 4
    assert archivio.leggi("capi/beta/2026-09-01/suo")[0] == b"di-beta"


def test_escludere_una_chiave_la_toglie_anche_dal_conto(archivio: ArchivioFileSystem):
    assert (
        archivio.elimina_sotto("capi/alfa/", tranne=frozenset({"capi/alfa/2026-09-03/avatar"})) == 3
    )


def test_uno_slash_finale_separa_alfa_da_alfa_bis(archivio: ArchivioFileSystem):
    """Senza lo slash, il prefisso `capi/alfa` prenderebbe anche `capi/alfa-bis`
    — cioè l'armadio di un altro, dentro l'unica operazione irreversibile che
    abbiamo. Gli id sono `uuid4().hex` e non hanno prefissi comuni, ma
    difendersi da un formato di id è una garanzia che nessuno impone."""
    archivio.elimina_sotto("capi/alfa/")
    assert archivio.leggi("capi/alfa-bis/x")[0] == b"altro-utente"


def test_la_chiave_esclusa_resta_leggibile_col_suo_tipo(archivio: ArchivioFileSystem):
    """La foto dell'avatar vive sotto lo stesso prefisso ma non si cancella con
    l'armadio. Non basta lasciare il file: `salva` scrive accanto un
    `.contenttype`, e senza quello `leggi` non sa più cosa sta restituendo."""
    archivio.elimina_sotto("capi/alfa/", tranne=frozenset({"capi/alfa/2026-09-03/avatar"}))
    contenuto, tipo = archivio.leggi("capi/alfa/2026-09-03/avatar")
    assert contenuto == b"io-in-piedi"
    assert tipo == "image/jpeg"


def test_porta_via_anche_le_scontornate(archivio: ArchivioFileSystem):
    archivio.elimina_sotto("capi/alfa/")
    for chiave in ["capi/alfa/2026-09-01/uno", "capi/alfa/2026-09-01/uno-scontornata"]:
        with pytest.raises(ErroreDominio):
            archivio.leggi(chiave)


def test_non_si_puo_risalire_fuori_dalla_cartella(archivio: ArchivioFileSystem):
    """La difesa che rende questa funzione qualcosa di diverso da `rm -rf` con
    un argomento che arriva da fuori."""
    with pytest.raises(ErroreDominio):
        archivio.elimina_sotto("../../../etc")


def test_un_prefisso_che_non_esiste_non_e_un_errore(archivio: ArchivioFileSystem):
    """Svuotare due volte, o svuotare un armadio che non ha mai avuto foto,
    deve riuscire: un'operazione irreversibile che fallisce al secondo giro
    lascerebbe la persona a chiedersi se il primo è andato a buon fine."""
    assert archivio.elimina_sotto("capi/nessuno/") == 0
