"""Foto su disco: storage locale invece di S3 — niente account cloud, niente
container in più da tenere su.

Pensato per usare l'app per davvero in locale, dove le foto devono
sopravvivere al riavvio di `npm run api:local` — a differenza di
`ArchivioInMemoria`, che le tiene in un dict e le perde ad ogni riavvio. La
PUT/GET vera passa comunque dal bridge di `local_server.py`
(`/dev/foto/{chiave}`): qui cambia solo dove finiscono i byte.
"""

from __future__ import annotations

import functools
import os
import socket
from pathlib import Path

from domain.errors import ErroreDominio
from domain.models import UploadFirmato

_SUFFISSO_TIPO = ".contenttype"


def _porta_locale() -> str:
    """La stessa porta su cui ascolta `local_server.py` (default 8787)."""
    return os.environ.get("PORTA", "8787")


@functools.cache
def _rileva_ip_lan() -> str:
    """L'IP di questa macchina sulla rete locale, senza doverlo scrivere a
    mano: apre un socket UDP verso un indirizzo pubblico — nessun pacchetto
    parte davvero, serve solo a far scegliere al sistema operativo quale
    interfaccia di rete userebbe — e legge l'indirizzo locale di quella
    rotta. È lo stesso IP che un telefono sulla stessa Wi-Fi userebbe per
    raggiungere questo computer.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return str(s.getsockname()[0])
    except OSError:
        return "localhost"
    finally:
        s.close()


def _host_locale() -> str:
    """Rilevato in automatico; sovrascrivibile con HOST_LOCALE se questa
    macchina ha più schede di rete e quella indovinata non è quella giusta."""
    return os.environ.get("HOST_LOCALE") or _rileva_ip_lan()


class ArchivioFileSystem:
    def __init__(self, cartella: str) -> None:
        self._radice = Path(cartella).resolve()
        self._radice.mkdir(parents=True, exist_ok=True)

    def _percorso(self, chiave: str) -> Path:
        percorso = (self._radice / chiave).resolve()
        if not percorso.is_relative_to(self._radice):
            raise ErroreDominio(f"chiave fuori dalla cartella foto: {chiave}")
        return percorso

    def url_upload(self, chiave: str, content_type: str, scade_in_s: int = 900) -> UploadFirmato:
        return UploadFirmato(
            chiave=chiave,
            url=f"http://{_host_locale()}:{_porta_locale()}/dev/foto/{chiave}",
            intestazioni={"content-type": content_type},
            scade_in_s=scade_in_s,
        )

    def url_lettura(self, chiave: str, scade_in_s: int = 3600) -> str:
        del scade_in_s
        return f"http://{_host_locale()}:{_porta_locale()}/dev/foto/{chiave}"

    def salva(self, chiave: str, contenuto: bytes, media_type: str) -> None:
        percorso = self._percorso(chiave)
        percorso.parent.mkdir(parents=True, exist_ok=True)
        percorso.write_bytes(contenuto)
        Path(f"{percorso}{_SUFFISSO_TIPO}").write_text(media_type)

    def leggi(self, chiave: str) -> tuple[bytes, str]:
        percorso = self._percorso(chiave)
        if not percorso.is_file():
            raise ErroreDominio(f"la foto «{chiave}» non è in questo archivio")
        meta = Path(f"{percorso}{_SUFFISSO_TIPO}")
        media_type = meta.read_text().strip() if meta.is_file() else "image/jpeg"
        return percorso.read_bytes(), media_type
