#!/usr/bin/env bash
# I tipi TypeScript dei dati salvati su Supabase, generati dallo schema locale.
#
#   npm run supabase:tipi                 -> scrive packages/contracts/src/generated/database.ts
#   bash scripts/tipi-database.sh <file>  -> li scrive altrove (la CI li confronta così)
#
# Uno script e non una riga in package.json perché lo usano in due, `npm` e il
# job `database` della CI: due copie dello stesso comando divergerebbero, e il
# confronto della CI fallirebbe per una differenza d'intestazione, non di tipi.
set -euo pipefail

DESTINAZIONE="${1:-packages/contracts/src/generated/database.ts}"
TEMPORANEO="$(mktemp)"
trap 'rm -f "$TEMPORANEO"' EXIT

{
  echo "// GENERATO da \`supabase gen types typescript --local\`: npm run supabase:tipi."
  echo "// Non si modifica a mano. La fonte è lo schema in supabase/migrations/ (ADR 0010)."
  echo
  supabase gen types typescript --local
} > "$TEMPORANEO"

mv "$TEMPORANEO" "$DESTINAZIONE"
trap - EXIT
