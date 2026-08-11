"""Foto su disco: storage locale, senza un servizio esterno da configurare.

Le foto devono sopravvivere a un riavvio — sia di `npm run api:local` sia del
container `api` su un VPS — a differenza di `ArchivioInMemoria`, che le tiene
in un dict e le perde ad ogni riavvio. La PUT/GET vera passa comunque dal
bridge di `local_server.py` (`/foto/{chiave}`): qui cambia solo dove
finiscono i byte.
"""

from __future__ import annotations

import functools
import os
import socket
from datetime import UTC, datetime
from pathlib import Path

from domain.errors import ErroreDominio
from domain.firma_foto import firma_foto
from domain.models import UploadFirmato

_SUFFISSO_TIPO = ".contenttype"


def _url_firmata(chiave: str, scade_in_s: int) -> str:
    """`/foto/{chiave}` non è protetta da nient'altro: senza firma, chiunque
    conosca la chiave potrebbe leggere o sovrascrivere la foto. Il segreto è
    lo stesso dei JWT di login (`JWT_SECRET`) — un secondo segreto da
    ruotare a parte non renderebbe questa firma più sicura."""
    scade_epoch = int(datetime.now(UTC).timestamp()) + scade_in_s
    firma = firma_foto(chiave, scade_epoch, os.environ["JWT_SECRET"])
    return f"{_base_url()}/foto/{chiave}?scade={scade_epoch}&firma={firma}"


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


def _base_url() -> str:
    """`BASE_URL_PUBBLICA` (es. `https://api.tuodominio.it`) quando è
    impostata — un VPS dietro un reverse proxy HTTPS, dove l'IP LAN indovinato
    e la porta interna non sono raggiungibili dall'app. Senza, resta il
    comportamento di sempre per `npm run api:local` su una rete domestica."""
    pubblica = os.environ.get("BASE_URL_PUBBLICA")
    if pubblica:
        return pubblica.rstrip("/")
    return f"http://{_host_locale()}:{_porta_locale()}"


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
            url=_url_firmata(chiave, scade_in_s),
            intestazioni={"content-type": content_type},
            scade_in_s=scade_in_s,
        )

    def url_lettura(self, chiave: str, scade_in_s: int = 604_800) -> str:
        """7 giorni, non 1 ora: `archivio.tsx` carica i capi una volta e li
        tiene in memoria per tutta la sessione, senza un percorso di
        refetch — un TTL corto scadrebbe sotto le miniature a metà sessione.
        Il rischio che questo apre è indovinare una chiave firmata, non
        scriverla: la PUT anonima resta chiusa da `scade_in_s` corto."""
        return _url_firmata(chiave, scade_in_s)

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
