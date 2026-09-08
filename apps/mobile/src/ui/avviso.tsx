/**
 * L'avviso globale: errori di rete, upload falliti, analisi non riuscite.
 *
 * Viveva solo dentro «Oggi»: ogni altra schermata che chiamava `avvisa()` (in
 * primis «Aggiungi», e il suggeritore quando un messaggio non arrivava)
 * restava muta — l'utente vedeva la vista tornare indietro senza sapere
 * perché. Montato una volta sola nella radice (`app/_layout.tsx`), come un
 * overlay che galleggia sopra qualunque schermata sia aperta, così l'avviso
 * arriva sempre, non solo da chi si è ricordato di importarlo.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Scheda, Toccabile } from './base'
import { Corpo } from './testo'
import { colori, spazi } from '../tema/tokens'
import { useArmadio } from '../dati/archivio'

export function Avviso() {
  const { avviso, avvisa } = useArmadio()
  const bordi = useSafeAreaInsets()
  if (!avviso) return null

  return (
    <Toccabile
      onPress={() => avvisa(null)}
      scala={0}
      style={{
        position: 'absolute',
        left: spazi.l,
        right: spazi.l,
        top: Math.max(bordi.top, 14) + 8,
        zIndex: 100,
      }}
    >
      <Scheda imbottitura={spazi.m} style={{ backgroundColor: colori.coralloTenue }}>
        <Corpo taglia={12.5}>{avviso}</Corpo>
      </Scheda>
    </Toccabile>
  )
}
