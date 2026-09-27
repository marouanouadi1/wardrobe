/**
 * I calcoli di presentazione che prima faceva anche il backend (ADR 0010):
 * da quando l'app legge l'armadio da sé, questa è l'unica copia, e le due
 * divergenze note col Python di allora — la fine del mese e il fuso — si
 * provano qui.
 */

import type { Capo } from '@wardrobe/contracts'
import { dormiente, mesiFa } from '../../src/dati/dominio'

const capo = (ultimo_uso: string | null) => ({ ultimo_uso }) as unknown as Capo

describe('mesiFa', () => {
  test('resta su un giorno che esiste', () => {
    expect(mesiFa('2026-08-31', 6)).toBe('2026-02-28')
    expect(mesiFa('2028-08-31', 6)).toBe('2028-02-29')
  })

  test('attraversa l’anno', () => {
    expect(mesiFa('2026-03-15', 6)).toBe('2025-09-15')
    expect(mesiFa('2026-01-31', 1)).toBe('2025-12-31')
  })
})

describe('dormiente', () => {
  test('un capo mai usato è fermo', () => {
    expect(dormiente(capo(null), new Date(2026, 7, 31, 12, 0))).toBe(true)
  })

  test('a fine mese il confine è il giorno che esiste, non tre giorni dopo', () => {
    // Il 31 agosto: sei mesi fa è il 28 febbraio. Con `setMonth` il confine
    // scivolava al 3 marzo, e il 1° e il 2 risultavano fermi.
    const adesso = new Date(2026, 7, 31, 12, 0)
    expect(dormiente(capo('2026-02-27'), adesso)).toBe(true)
    expect(dormiente(capo('2026-02-28'), adesso)).toBe(false)
    expect(dormiente(capo('2026-03-01'), adesso)).toBe(false)
    expect(dormiente(capo('2026-03-02'), adesso)).toBe(false)
  })

  test('il giorno di partenza è quello di qui, non quello di Greenwich', () => {
    // Le 00:30 del 1° settembre a Roma sono ancora il 31 agosto in UTC. Da qui
    // sei mesi fa è il 1° marzo; partendo dal giorno UTC sarebbe il 28 febbraio,
    // e un capo usato il 28 non risulterebbe fermo.
    const adesso = new Date(2026, 8, 1, 0, 30)
    expect(dormiente(capo('2026-02-28'), adesso)).toBe(true)
    expect(dormiente(capo('2026-03-01'), adesso)).toBe(false)
  })
})
