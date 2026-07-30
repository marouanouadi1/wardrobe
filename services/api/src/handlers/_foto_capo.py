"""URL firmati per le foto di un capo — condiviso fra `capi.py` e `analisi.py`.

Entrambi restituiscono un `Capo` all'app: chi lo legge dall'archivio (`capi.py`)
e chi lo produce appena finita l'analisi (`analisi.py`, endpoint `stato`/`avvia`
in sviluppo). Senza questo passaggio la foto arriva con `foto.url = None` e
l'app non mostra nulla finché non rifà il fetch dell'armadio da zero.
"""

from __future__ import annotations

from domain.models import Capo
from handlers._container import archivio_foto


def con_url(capo: Capo) -> Capo:
    """La foto viaggia come URL firmato a vita breve, mai come bucket pubblico."""
    chiave_scontornata = capo.foto.chiave_scontornata
    return capo.model_copy(
        update={
            "foto": capo.foto.model_copy(
                update={
                    "url": archivio_foto().url_lettura(capo.foto.chiave),
                    "url_scontornata": (
                        archivio_foto().url_lettura(chiave_scontornata)
                        if chiave_scontornata
                        else None
                    ),
                }
            )
        }
    )
