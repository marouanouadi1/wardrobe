/**
 * L'avviso globale: errori di rete, upload falliti, analisi non riuscite.
 *
 * Prima viveva solo dentro «Oggi» — ogni altra schermata che chiamava
 * `avvisa()` (in primis «Aggiungi») restava muta: l'utente vedeva la vista
 * tornare indietro senza sapere perché. Un componente unico, in ogni
 * schermata che genera avvisi, evita che si ripeta.
 */

import { Scheda, Toccabile } from './base'
import { Corpo } from './testo'
import { colori, spazi } from '../tema/tokens'
import { useArmadio } from '../dati/archivio'

export function Avviso() {
  const { avviso, avvisa } = useArmadio()
  if (!avviso) return null

  return (
    <Toccabile onPress={() => avvisa(null)} scala={0}>
      <Scheda imbottitura={spazi.m} style={{ backgroundColor: colori.coralloTenue }}>
        <Corpo taglia={12.5}>{avviso}</Corpo>
      </Scheda>
    </Toccabile>
  )
}
