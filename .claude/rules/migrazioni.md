# Standard migrazioni — `supabase/migrations/`

Lo legge: `api` **ogni volta che tocca `supabase/migrations/`**, e `reviewer`.
Una migrazione arrivata sul progetto vero non si ritira. Leggile per intero.


## Prima di aggirare un problema, chiedi se puoi toglierlo

> Se togliessi la mia soluzione, il problema tornerebbe? Se sì, è un **tampone**:
> la causa è ancora dove era.

Un tampone è legittimo quando la causa non si può togliere adesso — ma allora si
**dichiara** dov'è, si apre la voce del rimedio in `docs/DA_FARE.md`, e quando il
rimedio arriva **il tampone si toglie**.

Il segnale che distingue i due casi: **il rimedio toglie righe, il tampone ne
aggiunge.**

Per esteso, con l'esempio, in `CLAUDE.md` e in `docs/adr/0008`.

## Una cartella sola

Dal 2026-09-25 (ADR 0010) lo schema sta in **`supabase/migrations/`**, e dal passaggio
(2026-09-27) è l'unico: `services/api/migrations/` e il suo runner, che rieseguiva ogni
file a ogni avvio, non esistono più. Il Postgres di prima resta sul VPS, fermo, come copia
di riserva: nessuno ci applica più niente.

Il meccanismo è quello della CLI di Supabase: una tabella di storico, ogni file
applicato **una volta sola**, in ordine di timestamp, e mai rieseguito. L'idempotenza
non regge più niente; regge lo storico.

## Le regole

- **Un file nuovo** si crea con `supabase migration new <nome> < /dev/null`. Senza
  `< /dev/null` il comando resta appeso ad aspettare SQL da stdin.
- **Si può riscrivere finché non è arrivato sul progetto vero** (`supabase db push`).
  Da lì è storia: si aggiunge un file nuovo, e quello vecchio non si tocca più.
- **Una colonna nuova su una tabella che ha righe è nullable**, o ha un default.
  `add column … not null` senza default fallisce sul progetto vero, e il `db push` si
  ferma a metà. Se il campo deve diventare obbligatorio servono tre passi: aggiungi
  nullable, riempi, poi vincola.
- **Si verifica da zero**: `npm run supabase:reset && npm run supabase:test`, più
  `supabase:verifica` e `supabase:tipi`. È quello che fa il job `database` della CI.
- **Ogni tabella di `public` ha l'RLS attiva e le sue policy**, con i test pgTAP in
  `supabase/tests/database/` che provano A contro B. Una policy che nessun test prova
  non esiste.
- **Un permesso si prova con il ruolo che lo usa.** L'hook degli inviti gira come
  `supabase_auth_admin`, non come `postgres`: provato da `postgres` passava, mentre ogni
  registrazione vera veniva rifiutata. Da allora la CI fa due registrazioni vere.
- **`supabase/seed.sql` è solo per lo stack locale.** Mai `supabase db push
  --include-seed` verso il progetto vero: il seed inserisce un invito di sviluppo.
- **La CLI è la stessa della CI** (`database.yml`, oggi 2.109.1): un'altra versione
  genera tipi diversi e il confronto fallisce per quello. `supabase --version`.
- **Un enum o un limite che esiste anche in Python** si cambia nei due posti nella
  stessa modifica: `verifica_database.py` lo confronta, e il job `database` diventa
  rosso. La regola completa sta in `.claude/rules/contratti.md`.

## `drop` è distruttivo

`drop table`, `drop column`, e ogni `delete` o `truncate` massivo si **chiedono
prima** all'utente, dicendo cosa si perde, anche con `if exists`. Sul piano Free
non ci sono backup (ADR 0010): una colonna tolta sul progetto vero non torna.
