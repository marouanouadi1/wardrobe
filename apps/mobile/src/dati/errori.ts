/**
 * Un errore solo, per le due strade dei dati: Supabase (`supabase.ts`,
 * `accesso.ts`) e il backend dell'IA (`api.ts`).
 *
 * `codice` è ciò su cui una schermata decide; `message` è ciò che mostra.
 * Mai il contrario: i testi cambiano, i codici no — la stessa regola del
 * backend (`.claude/rules/python.md`, «l'app discrimina sul campo `errore`»).
 * `stato` c'è solo quando l'errore viene da una risposta HTTP del backend.
 */
export class ErroreDati extends Error {
  constructor(
    readonly codice: string,
    messaggio: string,
    readonly stato?: number,
  ) {
    super(messaggio)
  }
}

/**
 * Il messaggio da mostrare per un errore qualunque: `ErroreDati` è già un
 * `Error` (il suo `.message` è il testo per chi usa l'app), quindi un solo
 * controllo copre sia la rete sia i dati — dove prima ogni schermata
 * ripeteva `errore instanceof Error ? errore.message : ripiego`.
 */
export function messaggioDiErrore(errore: unknown, ripiego: string): string {
  return errore instanceof Error && errore.message ? errore.message : ripiego
}
