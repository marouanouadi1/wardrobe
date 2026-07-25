#!/usr/bin/env bash
# Costruisce il pacchetto delle Lambda.
#
#   ./scripts/build_lambda.sh                 -> build/pacchetto/ + build/lambda.zip
#   ./scripts/build_lambda.sh /una/cartella   -> mette i file lì e non comprime
#
# La seconda forma serve a CDK, che vuole i file scompattati e lo zip lo fa da
# sé: vedi infra/lib/codice-lambda.ts.
#
# Due dettagli che si pagano caro se si sbagliano:
#  1. le wheel vanno installate per manylinux ARM64, non per la macchina di chi
#     compila: psycopg[binary] su un Mac produrrebbe un pacchetto che su Lambda
#     non importa nemmeno. ARM perché le funzioni girano su Graviton, che a
#     parità di prestazioni costa il 20% in meno;
#  2. boto3 e botocore sono già nel runtime — includerli aggiunge decine di MB
#     al pacchetto e rallenta ogni cold start per niente.
set -euo pipefail

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COSTRUZIONE="$QUI/build"
DESTINAZIONE="${1:-$COSTRUZIONE/pacchetto}"

mkdir -p "$COSTRUZIONE" "$DESTINAZIONE"

# L'elenco delle dipendenze va in un file temporaneo, non in build/: CDK
# costruisce più asset in parallelo, e con un percorso condiviso una copia
# troncava il file che l'altra stava leggendo.
REQUISITI="$(mktemp)"
trap 'rm -f "$REQUISITI"' EXIT

echo "→ dipendenze (manylinux_2_28 aarch64, python 3.12)"
# `--output-file` invece della redirezione: quando lo script gira dentro il
# bundling di CDK, lo stdout è una pipe e la redirezione produceva un file
# vuoto. Scrivere il file direttamente è anche più chiaro.
uv export --frozen --no-dev --no-emit-project --format requirements-txt \
  --output-file "$REQUISITI" --quiet
[[ -s "$REQUISITI" ]] || {
  echo "uv export non ha prodotto nulla: la lock è aggiornata? (npm run api:sync)" >&2
  exit 1
}
uv pip install \
  --requirement "$REQUISITI" \
  --target "$DESTINAZIONE" \
  --python-platform aarch64-manylinux_2_28 \
  --python-version 3.12 \
  --only-binary=:all: \
  --quiet

echo "→ codice"
cp -r "$QUI/src/domain" "$QUI/src/handlers" "$QUI/src/adapters" "$DESTINAZIONE/"

echo "→ pulizia"
rm -rf "$DESTINAZIONE"/bin "$DESTINAZIONE"/boto3 "$DESTINAZIONE"/botocore "$DESTINAZIONE"/boto3-* "$DESTINAZIONE"/botocore-*
find "$DESTINAZIONE" -type d -name "__pycache__" -prune -exec rm -rf {} +
find "$DESTINAZIONE" -type d -name "tests" -prune -exec rm -rf {} +
find "$DESTINAZIONE" -type f -name "*.pyc" -delete

if [[ -n "${1:-}" ]]; then
  echo "✓ pacchetto in $DESTINAZIONE ($(du -sh "$DESTINAZIONE" | cut -f1))"
  exit 0
fi

echo "→ zip"
# `python -m zipfile` invece del comando `zip`: è nella libreria standard, e
# quindi c'è dovunque ci sia Python — che è un prerequisito già garantito.
rm -f "$COSTRUZIONE/lambda.zip"
(cd "$DESTINAZIONE" && python3 -m zipfile -c "$COSTRUZIONE/lambda.zip" .)

echo "✓ $COSTRUZIONE/lambda.zip ($(du -h "$COSTRUZIONE/lambda.zip" | cut -f1))"
