/**
 * Nessun colore si compone a mano, primitive incluse: i valori stanno in
 * `src/tema/tokens.ts`, e per una velatura c'è `velo(colore, alfa)` —
 * `.claude/rules/react-native.md`. Un `rgba(21,21,26,0.4)` scritto di nuovo in
 * una schermata è una costante duplicata che nessuno aggiornerà quando il
 * token cambia (T-19, T-20 in `docs/DA_FARE.md`).
 *
 * Perché l'AST e non un `grep`: alcune occorrenze vivono solo in un commento
 * o in un docblock — spiegano un letterale già tolto, o lo citano come
 * esempio — e una sonda deliberata in `test/ui/leggibilita.test.tsx` scrive
 * `'#123456'` apposta, per provare che l'helper di quel test legga davvero lo
 * stile risolto. Un regex testuale segnalerebbe tutte queste righe; un walk
 * sui nodi letterali le ignora, perché non sono mai il testo di un nodo che
 * il bundler eseguirebbe.
 *
 * Le due esenzioni, col motivo accanto — lo stesso schema di
 * `RIDIPINGIBILI_SENZA_FONDO` in `primitive.test.ts`:
 * - `src/tema/tokens.ts` è la fonte: è fatto di esadecimali per costruzione.
 * - `src/dati/dominio.ts` contiene `PALETTE_COLORI`, i colori **dei capi**
 *   (dati di dominio), non della UI.
 */

import { join } from 'node:path'
import * as ts from 'typescript'
import { RADICE, analizza, sorgenti } from './fonti'

const ESENTI = new Set([join(RADICE, 'src', 'tema', 'tokens.ts'), join(RADICE, 'src', 'dati', 'dominio.ts')])

const FORMA_RGB = /^rgba?\(/
const FORMA_ESADECIMALE = /^#[0-9a-fA-F]{3,8}$/

/** Vero se il testo è un colore composto a mano: un `rgb()`/`rgba()` o un
 * esadecimale. Non un colore con nome (`'transparent'`, …): quelli non
 * duplicano nessun valore di `tokens.ts`. */
function eColoreScrittoAMano(testo: string): boolean {
  return FORMA_RGB.test(testo) || FORMA_ESADECIMALE.test(testo)
}

describe('nessun colore si compone a mano: solo token o velo()', () => {
  const files = [...sorgenti(join(RADICE, 'app')), ...sorgenti(join(RADICE, 'src'))].filter((f) => !ESENTI.has(f))

  test('ci sono sorgenti da controllare', () => {
    // Se la scansione trovasse zero file, il test sotto passerebbe senza
    // verificare niente — che è peggio di un test che non c'è.
    expect(files.length).toBeGreaterThan(20)
  })

  test('nessun letterale `rgba()`/`rgb()`/esadecimale in `app/` o `src/`', () => {
    const colpevoli: string[] = []

    for (const file of files) {
      const sorgente = analizza(file)
      const visita = (nodo: ts.Node): void => {
        if ((ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) && eColoreScrittoAMano(nodo.text)) {
          const { line } = sorgente.getLineAndCharacterOfPosition(nodo.getStart())
          colpevoli.push(`${file.replace(RADICE + '/', '')}:${line + 1} → "${nodo.text}"`)
        }
        // Un template con interpolazione (`` `rgba(21,21,26,${x})` ``) non è
        // un `NoSubstitutionTemplateLiteral`: è un `TemplateExpression`, e la
        // sua parte fissa iniziale è `head.text`.
        if (ts.isTemplateExpression(nodo) && eColoreScrittoAMano(nodo.head.text)) {
          const { line } = sorgente.getLineAndCharacterOfPosition(nodo.getStart())
          colpevoli.push(`${file.replace(RADICE + '/', '')}:${line + 1} → template "${nodo.head.text}…"`)
        }
        ts.forEachChild(nodo, visita)
      }
      visita(sorgente)
    }

    expect(colpevoli).toEqual([])
  })
})
