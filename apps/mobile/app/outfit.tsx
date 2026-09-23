/**
 * Gli outfit salvati: combinazioni che hanno già funzionato.
 *
 * Un outfit salvato vale più di un suggerimento nuovo — è già stato approvato
 * da chi lo indossa. Per questo la scheda mostra quante volte è stato messo:
 * è l'informazione che dice se fidarsi.
 *
 * **La lista non è qui**: sta in `ElencoOutfit` (`ui/capi.tsx`), perché nel
 * deck gli outfit sono un segmento dentro l'Armadio e questa rotta resta viva
 * accanto a quello — per il rimando dal Profilo e per i link diretti (scelta
 * dell'utente del 2026-09-22, `docs/QUESTIONI.md`). Due copie della stessa
 * lista divergono in silenzio: è la regola che questo repo racconta per le
 * enum, e vale uguale per una schermata.
 */

import { router } from 'expo-router'
import { useArmadio, useVestiEVai } from '../src/dati/archivio'
import { conta } from '../src/dati/formato'
import { ElencoOutfit } from '../src/ui/capi'
import { Schermata } from '../src/ui/guscio'
import { ScheletroSchedaOutfit } from '../src/ui/scheletri'

export default function Outfit() {
  const { outfit, indice, pronto } = useArmadio()
  const vestiEVai = useVestiEVai()

  return (
    <Schermata
      occhiello={pronto ? conta(outfit.length, 'salvato', 'salvati') : ''}
      titolo={pronto && outfit.length === 0 ? 'Ancora niente' : 'I tuoi outfit'}
      tavolozza="freddo"
      indietro
    >
      <ElencoOutfit
        outfit={outfit}
        indice={indice}
        pronto={pronto}
        // Prima, a caricamento in corso, «Ancora nessun outfit» compariva
        // anche a chi ne aveva già salvati — lo stesso `outfit: []`
        // temporaneo che l'archivio parte sempre con.
        scheletro={
          <>
            <ScheletroSchedaOutfit />
            <ScheletroSchedaOutfit />
          </>
        }
        onVesti={vestiEVai}
        onVediOggi={() => router.push('/(tabs)/oggi')}
      />
    </Schermata>
  )
}
