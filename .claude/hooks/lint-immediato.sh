#!/usr/bin/env bash
# Porta il fallimento del linter dentro il ciclo dell'agente invece che in CI
# dieci minuti dopo. In particolare TID251: un import di psycopg o httpx fuori
# da adapters/ — il confine architetturale del progetto.
#
# PostToolUse è corretto qui: deve girare sul file già scritto. Non nega, e
# non deve: è un avviso che arriva al momento giusto.
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
  printf '%s' "$ESITO" | head -30
  echo
  echo "(ruff su $PERCORSO — se è TID251, il dominio sta importando psycopg o httpx: quella logica va in adapters/)"
}
exit 0
