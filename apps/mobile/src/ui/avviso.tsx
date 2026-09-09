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

import { Modal, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottonePrimario, BottoneSecondario, Scheda, Toccabile } from './base'
import { Corpo, Titolo } from './testo'
import { colori, spazi, velo } from '../tema/tokens'
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
      {/* `sfondo`, non `style`: uno `style={{ backgroundColor }}` scavalca
          `Scheda` invece di passare per lei, e `su` non può osservare un
          pixel dipinto fuori dal suo stesso contratto. */}
      <Scheda imbottitura={spazi.m} sfondo={colori.coralloTenue}>
        <Corpo taglia={12.5}>{avviso}</Corpo>
      </Scheda>
    </Toccabile>
  )
}

/**
 * Il dialogo di conferma per un'azione distruttiva — uscire, eliminare una
 * conversazione. Sostituisce `Alert.alert`: nativo, senza i colori del
 * design (il pulsante non poteva essere corallo), e sul web con più di due
 * bottoni non fa proprio nulla — due schermate lo scoprivano a modo loro.
 *
 * Controllato dalla schermata (`visibile` + un `useState` locale), non
 * imperativo come `Alert.alert`: coerente con come il resto del design è
 * dichiarativo, e non serve un modulo separato solo per aprirlo.
 */
export function Conferma({
  visibile,
  titolo,
  messaggio,
  testoConferma = 'Conferma',
  onConferma,
  onAnnulla,
}: {
  visibile: boolean
  titolo: string
  messaggio: string
  testoConferma?: string
  onConferma: () => void
  onAnnulla: () => void
}) {
  return (
    <Modal visible={visibile} transparent animationType="fade" onRequestClose={onAnnulla}>
      <View
        style={{
          flex: 1,
          backgroundColor: velo(colori.inchiostro, 0.45),
          justifyContent: 'center',
          padding: spazi.xl,
        }}
      >
        <Scheda imbottitura={22} style={{ gap: spazi.m }}>
          <Titolo taglia={19}>{titolo}</Titolo>
          <Corpo taglia={13.5} tono="medio">
            {messaggio}
          </Corpo>
          <View style={{ flexDirection: 'row', gap: spazi.s, marginTop: spazi.s }}>
            <BottoneSecondario testo="Annulla" style={{ flex: 1 }} onPress={onAnnulla} />
            {/* Corallo, non l'inchiostro di default: è l'unico posto dove
                questo bottone parla, ed è per disfare qualcosa. */}
            <BottonePrimario
              testo={testoConferma}
              style={{ flex: 1, backgroundColor: colori.corallo }}
              onPress={onConferma}
            />
          </View>
        </Scheda>
      </View>
    </Modal>
  )
}
