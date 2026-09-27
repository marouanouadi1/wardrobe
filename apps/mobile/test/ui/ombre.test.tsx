/**
 * Un fondo traslucido non porta un'ombra nativa.
 *
 * L'ombra di React Native — `elevation` su Android, `shadow*` su iOS — non sta
 * solo fuori dal bordo come il `box-shadow` del CSS: si disegna anche *sotto*
 * la vista. Su un fondo opaco non si vede; su un vetro al 60% sì, e la scheda
 * diventa grigia ai bordi con un riquadro più chiaro in mezzo. È successo alle
 * schede di `impostazioni.tsx` (una segnalazione da Sentry, dal telefono), e
 * la stessa coppia stava sulle tessere dell'armadio.
 *
 * Né `tsc` né un'occhiata al web lo vedono: in React Native Web l'ombra
 * diventa un `box-shadow`, che resta fuori. Per questo il test non guarda le
 * prop della primitiva ma ogni vista che finisce davvero nell'albero.
 */

import { render, type RenderResult } from '@testing-library/react-native'
import { StyleSheet, type ViewStyle } from 'react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'
import type { Capo } from '@wardrobe/contracts'
import { Scheda } from '../../src/ui/base'
import { CapoInGriglia } from '../../src/ui/capi'
import { Corpo } from '../../src/ui/testo'

/** L'alfa di un `rgba(…)`; 1 per tutto il resto (esadecimali, nomi). */
function alfa(colore: unknown): number {
  if (typeof colore !== 'string') return 1
  const trovato = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/.exec(colore)
  return trovato ? Number(trovato[1]) : 1
}

function haOmbra(stile: ViewStyle): boolean {
  return Number(stile.elevation ?? 0) > 0 || Number(stile.shadowOpacity ?? 0) > 0
}

/** Lo stile risolto di ogni vista nativa dell'albero reso. */
function stiliDelleViste(vista: RenderResult): ViewStyle[] {
  const stili: ViewStyle[] = []
  const visita = (nodo: ReactTestRendererJSON | string | null): void => {
    if (!nodo || typeof nodo === 'string') return
    if (nodo.type === 'View') {
      const stile = StyleSheet.flatten(nodo.props.style) as ViewStyle | undefined
      if (stile) stili.push(stile)
    }
    nodo.children?.forEach(visita)
  }
  const radice = vista.toJSON()
  ;(Array.isArray(radice) ? radice : [radice]).forEach(visita)
  return stili
}

/** Le viste con un fondo traslucido e un'ombra: devono essere zero. */
function vetriConOmbra(vista: RenderResult): ViewStyle[] {
  return stiliDelleViste(vista).filter((stile) => alfa(stile.backgroundColor) < 1 && haOmbra(stile))
}

const CAPO: Capo = {
  id: 'c1',
  nome: 'Felpa blu',
  tipo: 'top',
  slot: 'top',
  colore: { nome: 'blu', hex: '#1F3A93' },
  foto: { chiave: 'felpa.png', url: 'https://esempio.test/felpa.png' },
  creato_il: '2026-09-25T00:00:00Z',
  aggiornato_il: '2026-09-25T00:00:00Z',
}

describe('un fondo traslucido non porta ombra', () => {
  test('la Scheda di vetro', async () => {
    const vista = await render(
      <Scheda vetro>
        <Corpo>dentro il vetro</Corpo>
      </Scheda>,
    )
    expect(vetriConOmbra(vista)).toEqual([])
  })

  test('la tessera d’armadio', async () => {
    const vista = await render(<CapoInGriglia capo={CAPO} onPress={() => {}} />)
    expect(vetriConOmbra(vista)).toEqual([])
  })

  test('la Scheda opaca l’ombra la tiene: il test distingue, non spegne tutto', async () => {
    const vista = await render(
      <Scheda>
        <Corpo>opaca</Corpo>
      </Scheda>,
    )
    expect(stiliDelleViste(vista).filter(haOmbra).length).toBeGreaterThan(0)
  })
})
