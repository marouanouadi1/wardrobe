"""POST /foto/upload — l'app carica la foto da sola, senza passare dal backend.

Chiediamo un URL firmato all'archivio configurato (`archivio_foto()`) e il
telefono fa la PUT diretta a quello.
"""

from __future__ import annotations

from domain.errors import RichiestaNonValida
from domain.models import RichiestaUpload
from handlers._container import archivio_foto, generatore_id, orologio
from handlers._http import Evento, Risposta, corpo, endpoint, ok, utente_id

TIPI_AMMESSI = {"image/jpeg", "image/png", "image/heic", "image/webp"}


@endpoint
def upload(evento: Evento) -> Risposta:
    richiesta = corpo(evento, RichiestaUpload)
    if richiesta.content_type not in TIPI_AMMESSI:
        raise RichiestaNonValida(f"tipo immagine non ammesso: {richiesta.content_type}")

    utente = utente_id(evento)
    giorno = orologio().oggi().isoformat()
    chiave = f"capi/{utente}/{giorno}/{generatore_id().nuovo()}"

    return ok(archivio_foto().url_upload(chiave, richiesta.content_type))
