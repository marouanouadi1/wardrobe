/**
 * Nessuno ridipinge dal di fuori il fondo di una primitiva.
 *
 * Questo difetto nessun test di rendering può prenderlo, perché non è un bug
 * della primitiva: è un punto di chiamata che le passa `style={{
 * backgroundColor }}`. La primitiva continua a calcolare il colore del testo
 * per il fondo che *credeva* di dipingere, e il testo sparisce.
 *
 * È esattamente ciò che è successo in PR #4: il diff di `be3392e` mostra una
 * schermata che scriveva `<BottonePrimario style={{ backgroundColor:
 * colori.scheda }} />`. Se serve un fondo diverso, si aggiunge una variante
 * alla primitiva — come `ambra`, `chiaro` e `pericolo` su `BottonePrimario` —
 * così il colore del testo si calcola insieme al fondo.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Le primitive che dipingono un fondo e calcolano il colore del testo da sé. */
const PRIMITIVE = [
  'BottonePrimario',
  'BottoneSecondario',
  'Scheda',
  'Pillola',
  'Badge',
  'BadgeIa',
  'SchedaFoto',
  'BottoneTondo',
  'Bolla',
  'BollaChat',
]

const RADICE = join(__dirname, '..', '..')

function sorgenti(cartella: string): string[] {
  const trovati: string[] = []
  for (const voce of readdirSync(cartella)) {
    if (voce === 'node_modules' || voce === '.expo') continue
    const percorso = join(cartella, voce)
    if (statSync(percorso).isDirectory()) trovati.push(...sorgenti(percorso))
    else if (/\.tsx?$/.test(voce)) trovati.push(percorso)
  }
  return trovati
}

describe('le primitive non vengono ridipinte dal punto di chiamata', () => {
  const files = [...sorgenti(join(RADICE, 'app')), ...sorgenti(join(RADICE, 'src'))]

  test('ci sono sorgenti da controllare', () => {
    // Se la scansione trovasse zero file, ogni test qui sotto passerebbe senza
    // verificare niente — che è peggio di un test che non c'è.
    expect(files.length).toBeGreaterThan(20)
  })

  test.each(PRIMITIVE)('nessun `backgroundColor` passato a <%s>', (primitiva) => {
    // Apre il tag e si ferma alla prima chiusura: prende l'elenco delle props
    // di quella chiamata, anche su più righe.
    const chiamata = new RegExp(`<${primitiva}\\b[^>]*?>`, 'gs')
    const colpevoli: string[] = []

    for (const file of files) {
      const testo = readFileSync(file, 'utf8')
      for (const trovato of testo.match(chiamata) ?? []) {
        if (/backgroundColor/.test(trovato)) {
          const riga = testo.slice(0, testo.indexOf(trovato)).split('\n').length
          colpevoli.push(`${file.replace(RADICE + '/', '')}:${riga}`)
        }
      }
    }

    expect(colpevoli).toEqual([])
  })
})
