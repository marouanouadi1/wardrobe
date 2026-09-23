/**
 * Le lunghezze si salvano in centimetri e si leggono come vuole l'utente:
 * fra le due cose c'è una conversione, e una conversione arrotondata sbaglia
 * in silenzio.
 *
 * Due difetti veri sono possibili qui, e nessuno dei due è visibile a `tsc`:
 *
 * 1. **Il giro non torna.** Si digita `66″`, si salva `168 cm`, si riapre la
 *    schermata e si legge `65″`. Nessun errore, nessun avviso: solo un numero
 *    che cambia da solo ogni volta che si guarda.
 * 2. **Il campo accetta ciò che il server rifiuta.** Il minimo è 120 cm, cioè
 *    47,24″. Arrotondando il limite per difetto il campo direbbe di sì a `47`,
 *    che diventa 119 cm — e il salvataggio cade con un 422 che l'utente non
 *    può correggere, perché il campo gli ha appena dato ragione. Per questo
 *    `limitiIn` arrotonda il minimo **per eccesso** e il massimo **per
 *    difetto**: il verso non è simmetrico, e invertirlo è l'errore facile.
 */

import { LIMITI_MISURE_CM } from '@wardrobe/contracts'
import { aCentimetri, daCentimetri, formattaLunghezza, limitiIn } from '../../src/dati/dominio'

const CHIAVI = ['altezza', 'spalle', 'lunghezza_gamba'] as const

describe('centimetri e pollici: il giro deve tornare', () => {
  test('in centimetri non si converte affatto', () => {
    for (let cm = 120; cm <= 230; cm++) {
      expect(daCentimetri(cm, 'cm')).toBe(cm)
      expect(aCentimetri(cm, 'cm')).toBe(cm)
    }
  })

  test('un valore digitato in pollici si rilegge identico', () => {
    // Il giro che fa l'utente: digita, si salva in cm, riapre, rilegge.
    const { min, max } = limitiIn('altezza', 'pollici')
    for (let pollici = min; pollici <= max; pollici++) {
      expect(daCentimetri(aCentimetri(pollici, 'pollici'), 'pollici')).toBe(pollici)
    }
  })

  test('e non si scrive «168 » senza unità', () => {
    expect(formattaLunghezza(168, 'cm')).toBe('168 cm')
    expect(formattaLunghezza(168, 'pollici')).toBe('66 ″')
  })
})

describe('i limiti in pollici non promettono ciò che il server rifiuta', () => {
  test.each(CHIAVI)('%s: ogni valore ammesso resta dentro i limiti veri', (chiave) => {
    const veri = LIMITI_MISURE_CM[chiave]
    const { min, max } = limitiIn(chiave, 'pollici')
    expect(min).toBeLessThan(max)
    for (let pollici = min; pollici <= max; pollici++) {
      const cm = aCentimetri(pollici, 'pollici')
      expect(cm).toBeGreaterThanOrEqual(veri.min)
      expect(cm).toBeLessThanOrEqual(veri.max)
    }
  })

  test.each(CHIAVI)('%s: e subito fuori si esce davvero, in entrambi i versi', (chiave) => {
    // L'altra metà: limiti troppo stretti starebbero dentro senza mai
    // fallire, e toglierebbero all'utente valori legittimi in silenzio.
    const veri = LIMITI_MISURE_CM[chiave]
    const { min, max } = limitiIn(chiave, 'pollici')
    expect(aCentimetri(min - 1, 'pollici')).toBeLessThan(veri.min)
    expect(aCentimetri(max + 1, 'pollici')).toBeGreaterThan(veri.max)
  })

  test('in centimetri i limiti sono quelli del dominio, senza ritocchi', () => {
    for (const chiave of CHIAVI) {
      expect(limitiIn(chiave, 'cm')).toEqual(LIMITI_MISURE_CM[chiave])
    }
  })
})
