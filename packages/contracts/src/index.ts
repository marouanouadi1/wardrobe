/**
 * I tipi condivisi fra backend e app.
 *
 * Non c'è nulla scritto a mano qui dentro, ed è il punto: i modelli Pydantic in
 * `services/api/src/domain/models.py` sono la fonte di verità, questo pacchetto
 * è il loro riflesso in TypeScript. Se qualcuno rinomina un campo nel backend
 * senza rigenerare, la CI se ne accorge — e se lo rinomina rigenerando, è
 * `tsc` dell'app a dire dove va aggiornato il codice.
 *
 * Rigenera con: npm run contracts:generate
 */

export * from './generated/modelli'
export * from './generated/runtime'
