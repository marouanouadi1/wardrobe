/**
 * Una riga di griglia ci deve stare, sul telefono più stretto che serviamo.
 *
 * Non è pedanteria: in React Native `flexShrink` vale **0** di default, al
 * contrario del web. Una cella con `width: '13.1%'` dentro un `flexWrap` non si
 * stringe di un pixel per far entrare le sorelle — va a capo. Il sintomo non è
 * un errore né un avviso: è un calendario che mostra sei giorni per riga invece
 * di sette, con le lettere dei giorni disallineate rispetto alle date, e
 * nessuno strumento statico se ne accorge.
 *
 * È esattamente ciò che è successo: `griglie.mese` chiedeva
 * `7 × 13.1% + 6 × 6px`, che entra solo in una larghezza utile di ~434px —
 * uno schermo da 478pt, che non esiste. Il difetto ha viaggiato finché questo
 * conto non è stato scritto (`T-37` in `docs/DA_FARE.md`).
 *
 * La larghezza utile è quella di `Schermata` (`ui/guscio.tsx`): la larghezza
 * dello schermo meno **due** `spazi.xl` di `paddingHorizontal`. Se quel padding
 * cambia, questo file va cambiato nella stessa modifica.
 */

import { griglie, spazi } from '../../src/tema/tokens'

/** Dal più stretto che si trovi ancora in giro al più largo in commercio. */
const LARGHEZZE = [320, 360, 375, 390, 414, 430, 480]

function percentuale(valore: string): number {
  const n = Number(valore.replace('%', ''))
  expect(Number.isFinite(n)).toBe(true)
  return n / 100
}

/** Quanto resta dopo aver messo in fila `colonne` celle e le loro distanze. */
function resto(larghezzaSchermo: number, colonne: number, colonna: string, distanza: number): number {
  const utile = larghezzaSchermo - 2 * spazi.xl
  return utile - (colonne * percentuale(colonna) * utile + (colonne - 1) * distanza)
}

describe('una riga di griglia entra nella larghezza utile', () => {
  test.each(LARGHEZZE)('l\'armadio: tre tessere a %ipt', (larghezza) => {
    const avanzo = resto(larghezza, 3, griglie.armadio.colonna, griglie.armadio.distanza)
    // Un margine, non lo zero: le percentuali si risolvono in float e poi si
    // arrotondano al pixel del dispositivo. Zero netto va a capo comunque.
    expect(avanzo).toBeGreaterThan(2)
  })

  test.each(LARGHEZZE)('il mese: sette celle a %ipt', (larghezza) => {
    const avanzo = resto(larghezza, 7, griglie.mese.colonna, griglie.mese.distanza)
    expect(avanzo).toBeGreaterThan(2)
  })

  test('la griglia non è nemmeno troppo stretta: il vuoto a destra resta contenuto', () => {
    // L'altro verso dello stesso errore: colonne troppo strette stanno dentro
    // ma lasciano una banda vuota che si legge come un difetto di allineamento.
    for (const larghezza of LARGHEZZE) {
      const utile = larghezza - 2 * spazi.xl
      expect(resto(larghezza, 3, griglie.armadio.colonna, griglie.armadio.distanza)).toBeLessThan(utile * 0.12)
      expect(resto(larghezza, 7, griglie.mese.colonna, griglie.mese.distanza)).toBeLessThan(utile * 0.12)
    }
  })
})
