/**
 * Infrastruttura condivisa dei gate che leggono i sorgenti dell'app come AST:
 * dove sono i file, e come si parsano.
 *
 * Estratta da `primitive.test.ts` quando `colori.test.ts` ha avuto bisogno
 * esattamente della stessa cosa — elenco dei sorgenti di `app/` e `src/`,
 * stesso parser TSX. Duplicarla sarebbe una seconda copia di uno scaffolding
 * che due gate leggono allo stesso modo, ed è la classe di problema che
 * questo repo ha già pagato una volta (due copie di React, `T-23`).
 *
 * Non un file di test: `testMatch` in `package.json` cerca solo i file che
 * finiscono per `.test.ts` o `.test.tsx` sotto `test/`, quindi questo modulo
 * non viene raccolto da jest come suite a sé.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

export const RADICE = join(__dirname, '..', '..')

export function sorgenti(cartella: string): string[] {
  const trovati: string[] = []
  for (const voce of readdirSync(cartella)) {
    if (voce === 'node_modules' || voce === '.expo') continue
    const percorso = join(cartella, voce)
    if (statSync(percorso).isDirectory()) trovati.push(...sorgenti(percorso))
    else if (/\.tsx?$/.test(voce)) trovati.push(percorso)
  }
  return trovati
}

export function analizza(percorso: string): ts.SourceFile {
  const testo = readFileSync(percorso, 'utf8')
  // TSX per tutti: nessun sorgente di `src/ui/**` usa il cast d'epoca
  // `<Tipo>valore` (verificato a mano), quindi non c'è ambiguità con la
  // sintassi JSX da disambiguare.
  return ts.createSourceFile(percorso, testo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}
