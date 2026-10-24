/**
 * `useRisorsa` con `deps` che cambiano: vince l'ultimo caricamento chiesto, non l'ultimo arrivato.
 *
 * Il difetto che questo test ferma l'ha trovato la review dell'avatar: si cambia corpo, poi si
 * torna indietro prima che il primo finisca di caricare. Il corpo di ritorno era già in cache e
 * arrivava subito; quello lento arrivava dopo e prendeva il suo posto. La schermata restava su
 * «Preparo il corpo…» per sempre, senza errore e senza niente da riprovare.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useRisorsa } from '../../src/dati/risorsa'

function promessa<T>() {
  let risolvi!: (valore: T) => void
  const p = new Promise<T>((ok) => {
    risolvi = ok
  })
  return { p, risolvi }
}

test('una risposta superata da un caricamento più recente non sovrascrive i dati', async () => {
  const lento = promessa<string>()
  const carica = (chiave: string) => (chiave === 'lento' ? lento.p : Promise.resolve(chiave))

  const { result, rerender } = await renderHook(({ chiave }: { chiave: string }) => useRisorsa(() => carica(chiave), [chiave]), {
    initialProps: { chiave: 'lento' },
  })
  // il primo caricamento deve essere partito davvero: `useRisorsa` lo avvia un tick dopo
  await act(() => new Promise((ok) => setTimeout(ok, 10)))
  expect(result.current.caricamento).toBe(true)
  await rerender({ chiave: 'veloce' })
  await waitFor(() => expect(result.current.dati).toBe('veloce'))

  // il caricamento di prima finisce adesso: è vecchio, e deve restare fuori
  await act(async () => lento.risolvi('lento'))

  expect(result.current.dati).toBe('veloce')
  expect(result.current.caricamento).toBe(false)
})
