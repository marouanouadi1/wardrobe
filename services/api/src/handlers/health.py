"""GET /salute — serve al deploy e agli health check del target group."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

from handlers._container import orologio
from handlers._http import Evento, Risposta, endpoint, ok

# La versione viene dai metadati del pacchetto installato, cioè dalla `version`
# di pyproject.toml: è la stessa che il job `deploy` bumpa e tagga. Funziona in
# container perché il Dockerfile fa `uv sync --no-dev` (il progetto è
# *installato* in /app/.venv, non solo copiato dentro l'immagine).
#
# Prima qui c'era `os.environ["VERSIONE_APP"]`, che nessuno impostava: in
# produzione questo endpoint rispondeva sempre "dev", quindi dopo un deploy non
# si poteva sapere quale codice stesse girando. Ora lo step finale del deploy
# confronta questo campo con la versione appena rilasciata.
try:
    _VERSIONE = version("wardrobe-api")
except PackageNotFoundError:  # pragma: no cover — solo fuori da un venv installato
    _VERSIONE = "dev"


@endpoint
def salute(_evento: Evento) -> Risposta:
    return ok(
        {
            "stato": "ok",
            "versione": _VERSIONE,
            "adesso": orologio().adesso(),
        }
    )
