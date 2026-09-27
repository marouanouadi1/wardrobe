/**
 * I tipi condivisi fra backend e app.
 *
 * Non c'è nulla scritto a mano qui dentro, ed è il punto: i modelli Pydantic in
 * `services/api/src/domain/models.py` sono la fonte di verità, questo pacchetto
 * è il loro riflesso in TypeScript. Se qualcuno rinomina un campo nel backend
 * senza rigenerare, la CI se ne accorge — e se lo rinomina rigenerando, è
 * `tsc` dell'app a dire dove va aggiornato il codice.
 *
 * Dal passaggio a Supabase (ADR 0010) c'è una seconda fonte, per i dati
 * salvati: lo schema in `supabase/migrations/`, da cui nasce
 * `generated/database.ts`. L'app lo usa per le righe che legge e scrive da sé
 * (`apps/mobile/src/dati/supabase.ts`): un cambio di schema diventa rosso lì.
 * Solo i tipi, per nome: `Constants` duplicherebbe gli enum di `runtime.ts`.
 *
 * Rigenera con: npm run contracts:generate · npm run supabase:tipi
 */

export * from './generated/modelli'
export * from './generated/runtime'
export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './generated/database'
