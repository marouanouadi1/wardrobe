#!/usr/bin/env bash
# Porta il fallimento del linter dentro il ciclo dell'agente invece che in CI
# dieci minuti dopo. In particolare TID251: un import di psycopg o httpx fuori
# da adapters/ — il confine architetturale del progetto.
#
# PostToolUse è corretto qui: deve girare sul file già scritto. Non nega, e
# non deve: è un avviso che arriva al momento giusto.
#
# **Il canale, però, non è stdout.** Su PostToolUse lo stdout di un hook che
# esce 0 finisce nel transcript e basta: il modello non lo vede mai, e l'hook
# stampava diligentemente un rapporto che nessuno leggeva. Il campo che torna
# al modello è `reason`, con `decision: "block"` — la stessa forma che usa già
# contratti-allineati.py. «block» qui non annulla la scrittura (il file è già
# scritto): dice all'agente di guardare cosa ha appena rotto.
#
# Niente per apps/mobile/: `tsc -b` sull'intero workspace è troppo lento per
# un hook, e resta nel runbook di verifica dell'agente.
set -uo pipefail

PERCORSO=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null) || exit 0
case "$PERCORSO" in
  *services/api/src/*.py) ;;
  *) exit 0 ;;
esac

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ESITO=$(cd "$RADICE/services/api" && uv run ruff check "$PERCORSO" 2>&1) || {
  printf '%s' "$ESITO" | python3 -c '
import json, sys
rapporto = sys.stdin.read()[:4000]
print(json.dumps({
    "decision": "block",
    "reason": (
        "ruff non è pulito sul file appena scritto:\n\n" + rapporto +
        "\n\nSe è TID251, il dominio sta importando psycopg o httpx: quella "
        "logica va in adapters/ (.claude/rules/python.md)."
    ),
}))
'
}
exit 0
