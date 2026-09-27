/**
 * Lo spazio che `Schermata` riserva in fondo deve contenere la barra intera.
 *
 * `altezzaBarra` rifaceva a mano il conto delle misure di `BarraSchede` e ne
 * perdeva un'imbottitura: l'ultimo elemento di ogni schermata di scheda
 * finiva 8pt sotto la pillola — sul profilo, «Esci» coperto a metà. Nessun
 * tipo lo vede, e nessun errore: si vede solo sul telefono.
 *
 * Non si confrontano due costanti fra loro — sarebbe verificare che il conto
 * è uguale a sé stesso. Si **disegna** la barra e si misura dove arriva la
 * sua cima, dagli stili che ha davvero, contro lo spazio dichiarato.
 */

import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { altezzaBarra, BarraSchede } from '../../src/ui/guscio'

jest.mock('expo-router', () => ({
  usePathname: () => '/profilo',
  router: { navigate: jest.fn() },
}))

function misure(bottom: number) {
  return {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom },
  }
}

describe('lo spazio in fondo contiene la barra delle schede', () => {
  // 0: Android con i tre tasti di navigazione; 34: iPhone con la barra gestuale.
  test.each([0, 24, 34])('con un bordo inferiore di %ipt', async (bordo) => {
    const vista = await render(
      <SafeAreaProvider initialMetrics={misure(bordo)}>
        <BarraSchede />
      </SafeAreaProvider>,
    )

    // L'albero disegnato: il provider, il contenitore ancorato in fondo, la
    // pillola, le voci.
    const provider = vista.toJSON()
    if (!provider || Array.isArray(provider)) throw new Error('la barra non si è disegnata')
    const radice = provider.children?.[0]
    if (!radice || typeof radice === 'string') throw new Error('la barra non si è disegnata')
    const pillola = radice.children?.[0]
    if (!pillola || typeof pillola === 'string') throw new Error('manca la pillola')
    const voci = (pillola.children ?? []).filter((v) => typeof v !== 'string')

    const esterna = StyleSheet.flatten(radice.props.style)
    const stilePillola = StyleSheet.flatten(pillola.props.style)
    const altezzaVoce = Math.max(...voci.map((v) => StyleSheet.flatten(v.props.style)?.height ?? 0))

    expect(typeof esterna?.bottom).toBe('number')
    expect(typeof stilePillola?.padding).toBe('number')
    expect(typeof altezzaVoce).toBe('number')

    const cima = (esterna!.bottom as number) + 2 * (stilePillola!.padding as number) + (altezzaVoce as number)
    expect(altezzaBarra(bordo)).toBeGreaterThan(cima)
  })
})
