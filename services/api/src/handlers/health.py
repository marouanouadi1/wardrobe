"""GET /salute — serve al deploy e agli health check del target group."""

from __future__ import annotations

import os

from handlers._container import orologio
from handlers._http import Evento, Risposta, endpoint, ok


@endpoint
def salute(_evento: Evento) -> Risposta:
    return ok(
        {
            "stato": "ok",
            "versione": os.environ.get("VERSIONE_APP", "dev"),
            "adesso": orologio().adesso(),
        }
    )
