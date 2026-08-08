#!/usr/bin/env bash
# Applica tutte le migration in services/api/migrations/, in ordine.
#
# A differenza di docker-entrypoint-initdb.d (che gira SOLO alla creazione di
# un volume Postgres vuoto), questo si può rilanciare su un volume che esiste
# già — il caso comune dopo aver aggiunto una nuova migration a un ambiente
# in uso. `create ... if not exists` in ogni file la rende innocua da
# rieseguire anche su chi le ha già applicate.
set -euo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose --file "$RADICE/docker-compose.yml")

"${COMPOSE[@]}" up -d --wait postgres

for FILE in "$RADICE"/services/api/migrations/*.sql; do
  NOME="$(basename "$FILE")"
  echo "→ $NOME"
  "${COMPOSE[@]}" exec -T postgres psql -U wardrobe -d wardrobe -f "/docker-entrypoint-initdb.d/$NOME"
done
