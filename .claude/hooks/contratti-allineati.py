#!/usr/bin/env python3
"""Impedisce di chiudere una sessione con i contratti disallineati.

Un cambio a `domain/models.py` senza rigenerazione passa ruff, passa mypy,
passa pytest e passa anche il typecheck dell'app — che legge ancora i tipi
vecchi. Muore solo nel job `contracts` di api.yml: è l'unico modo di rompere
la CI dopo che tutto il resto è verde.

Si verifica con `contracts:check`, non con il proxy «src/generated/ è pulito»:
models.py contiene anche modelli che non attraversano il confine, e toccarli
lascia legittimamente i generati intatti. Il proxy bloccherebbe ogni volta.

**«Cambiato» non vuol dire «non committato».** `git status` da solo vede solo
il working tree, e in questo repo committare dentro la sessione è il flusso
normale (tre commit con lo stesso trailer `Claude-Session` su b5ba358,
437089c, 1a35d83). L'hook usciva prima di controllare proprio nel caso che il
docstring qui sopra descrive. Si guarda anche il branch rispetto a main.
"""

import json
import subprocess
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[2]
MODELLI = "services/api/src/domain/models.py"


def eseguito(comando: list[str], timeout: int) -> subprocess.CompletedProcess[str] | None:
    try:
        return subprocess.run(
            comando, cwd=RADICE, capture_output=True, text=True, timeout=timeout
        )
    except (subprocess.TimeoutExpired, OSError):
        return None


def modelli_mossi() -> bool:
    """Nel working tree **o** nei commit di questo branch."""
    lavoro = eseguito(["git", "status", "--porcelain", "--", MODELLI], 30)
    if lavoro is not None and lavoro.stdout.strip():
        return True

    for base in ("origin/main...HEAD", "main...HEAD"):
        branch = eseguito(["git", "diff", "--name-only", base, "--", MODELLI], 30)
        if branch is None:
            continue
        if branch.returncode == 0:
            return bool(branch.stdout.strip())  # la base esiste: la sua risposta è quella buona
    return False


def main() -> None:
    try:
        evento = json.load(sys.stdin)
    except Exception:
        return

    # Senza questa guardia, un `contracts:check` che continua a fallire blocca
    # lo Stop a ogni giro: è la ricetta del ciclo infinito.
    if evento.get("stop_hook_active"):
        return

    if not modelli_mossi():
        return

    # Il timeout dell'hook in .claude/settings.json è 300s. Qui si sta sotto,
    # altrimenti il processo muore fuori da qualunque except e l'hook esce con
    # un traceback invece che con la sua diagnosi.
    esito = eseguito(["npm", "run", "contracts:check"], 240)
    if esito is None:
        print(json.dumps({
            "decision": "block",
            "reason": (
                "`domain/models.py` è cambiato e `npm run contracts:check` non "
                "è arrivato in fondo (timeout o comando assente). Eseguilo a "
                "mano prima di chiudere: è l'unico controllo che vede un "
                "disallineamento dei contratti."
            ),
        }))
        return
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
