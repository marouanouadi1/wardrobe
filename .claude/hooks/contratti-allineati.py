#!/usr/bin/env python3
"""Impedisce di chiudere una sessione con i contratti disallineati.

Un cambio a `domain/models.py` senza rigenerazione passa ruff, passa mypy,
passa pytest e passa anche il typecheck dell'app — che legge ancora i tipi
vecchi. Muore solo nel job `contracts` di api.yml: è l'unico modo di rompere
la CI dopo che tutto il resto è verde.

Si verifica con `contracts:check`, non con il proxy «src/generated/ è pulito»:
models.py contiene anche modelli che non attraversano il confine, e toccarli
lascia legittimamente i generati intatti. Il proxy bloccherebbe ogni volta.
"""

import json
import subprocess
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[2]


def main() -> None:
    try:
        json.load(sys.stdin)
    except Exception:
        return

    mosso = subprocess.run(
        ["git", "status", "--porcelain", "services/api/src/domain/models.py"],
        cwd=RADICE, capture_output=True, text=True, timeout=30,
    )
    if not mosso.stdout.strip():
        return  # models.py non è cambiato: niente da verificare

    esito = subprocess.run(
        ["npm", "run", "contracts:check"],
        cwd=RADICE, capture_output=True, text=True, timeout=300,
    )
    if esito.returncode == 0:
        return

    print(json.dumps({
        "decision": "block",
        "reason": (
            "`domain/models.py` è cambiato e i contratti non sono allineati.\n"
            "Esegui `npm run contracts:generate`, **leggi il diff generato** "
            "(se compaiono alias come `Nome1` o `StatoCapo2` è rientrato un "
            "`title`/`default`: si corregge `_senza_titoli_di_campo()`, non si "
            "subisce) e committa packages/contracts/.\n\n"
            f"{esito.stdout[-1500:]}{esito.stderr[-500:]}"
        ),
    }))


if __name__ == "__main__":
    main()
