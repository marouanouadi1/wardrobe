/**
 * Il meccanismo dell'ereditarietà del fondo, isolato dai componenti che lo usano.
 *
 * Vale la pena averlo a parte: `leggibilita.test.tsx` verifica il risultato
 * visibile (il colore di un testo), questo verifica la regola che lo produce.
 * Quando uno dei due fallisce da solo, si sa subito da che parte guardare.
 */

import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { Fondo, useFondo } from '../../src/ui/fondo'

/** Stampa il fondo che il contesto dichiara nel punto in cui è montata. */
function Sonda() {
  return <Text>{useFondo()}</Text>
}

describe('Fondo', () => {
  test('senza nessun provider il default è chiaro, e non lancia', async () => {
    // A differenza di `useSessione`/`useArmadio`, qui l'assenza non è un errore
    // di programmazione: è ciò che rende installabile il contesto senza muovere
    // un pixel finché nessuno dice 'scuro'.
    const vista = await render(<Sonda />)
    expect(vista.getByText('chiaro')).toBeTruthy()
  })

  test('dichiara il fondo per tutto ciò che sta dentro', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Sonda />
      </Fondo>,
    )
    expect(vista.getByText('scuro')).toBeTruthy()
  })

  test('un Fondo senza `su` eredita invece di reimpostare a chiaro', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Fondo>
          <Sonda />
        </Fondo>
      </Fondo>,
    )
    expect(vista.getByText('scuro')).toBeTruthy()
  })

  test('un Fondo annidato con `su` esplicito vince su quello che lo contiene', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Fondo su="chiaro">
          <Sonda />
        </Fondo>
      </Fondo>,
    )
    expect(vista.getByText('chiaro')).toBeTruthy()
  })

  test('tre livelli: scuro > chiaro > ereditato resta chiaro', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Fondo su="chiaro">
          <Fondo>
            <Sonda />
          </Fondo>
        </Fondo>
      </Fondo>,
    )
    expect(vista.getByText('chiaro')).toBeTruthy()
  })
})
