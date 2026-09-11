# Standard migrazioni — `services/api/migrations/`

Lo legge: `api` **ogni volta che tocca `migrations/`**, e `reviewer`.
Queste regole hanno conseguenze **irreversibili**. Leggile per intero.

## Il meccanismo, che spiega tutte le regole

`services/api/scripts/applica_migrazioni.py` fa una cosa sola:

```python
for file in sorted((RADICE / "migrations").glob("*.sql")):
    # esegue
```

**Tutti i file. In ordine lessicografico. A ogni avvio.** Lo chiama
`scripts/dev.sh` da solo, e in produzione `docker compose exec api python
scripts/applica_migrazioni.py`.

Non c'è una tabella di versione: il runner **non sa** quali migrazioni ha già
applicato, perché non gli serve saperlo — l'idempotenza sostituisce il tracking.
Non c'è un file `down`: la cartella contiene solo SQL in avanti.

Conseguenza da avere chiara prima di scrivere una riga: **una migrazione non
idempotente non rompe un deploy — rompe ogni avvio successivo, per sempre**,
finché qualcuno non entra sul server a sistemare.

## Le sette regole

1. **Prefisso a quattro cifre, zero-padded.** Il prossimo libero è `0010_`.
   L'ordine è lessicografico: un file `10_qualcosa.sql` ordinerebbe **prima** di
   `0001` e riordinerebbe l'intero schema a ogni boot.
   I buchi nella numerazione sono normali e non si compattano: mancano `0003` e
   `0004` perché due migrazioni del playground sono state rimosse.

2. **Ogni istruzione ripetibile.**
   `create table if not exists` · `create index if not exists` ·
   `alter table … add column if not exists` · `drop … if exists` ·
   `insert … on conflict do nothing`.

3. **Una colonna nuova è sempre nullable.** `add column … not null` **senza
   default** fallisce su una tabella che ha già righe — e senza tabella di
   versione quel fallimento si ripete a ogni avvio. Se il campo deve diventare
   obbligatorio, servono tre migrazioni distinte nel tempo: aggiungi nullable,
   backfilla, poi vincola.

4. **Il backfill è idempotente per costruzione, non per fortuna.** L'esempio
   canonico è `0009_conversazioni_chat.sql`: `conversazione_id` è nullable
   *proprio per* rendere ripetibile il backfill, e la `where … is null` lo rende
   un no-op dal secondo giro in poi.

5. **Mai modificare un file già applicato in produzione.** Si aggiunge un file
   nuovo. Un file già eseguito è storia, non codice.

6. **`drop` e `drop column` sono distruttivi e irreversibili — e verrebbero
   rieseguiti all'infinito.** Ci si ferma e si chiede all'utente, dicendo cosa si
   perde. L'unico precedente è `0008_rimuovi_playground.sql`, che porta quattro
   righe di commento a giustificare ogni `drop`.

7. **Verifica obbligatoria prima di chiudere:**
   ```bash
   npm run db:up && npm run db:migrate && npm run db:migrate
   ```
   **Due volte di fila.** Se il secondo giro non è pulito, la migrazione è
   sbagliata — e lo sarebbe rimasta fino al prossimo riavvio in produzione.

## Sul primo avvio in produzione

Su un volume vuoto le migrazioni le applica Postgres da sé via
`docker-entrypoint-initdb.d`. Una migrazione arrivata **dopo** va lanciata a
mano: è documentato in `docs/deploy.md`, sezione «Avvio e aggiornamento».
