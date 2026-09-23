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
import { BottonePrimario, BottoneSecondario, Icona, type NomeIcona, Scheda, Toccabile } from './base'
import { Corpo, Forte, Titolo } from './testo'
import { colori, linee, spazi, testoSu, velo } from '../tema/tokens'
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
      {/* Opaco, non velato: questo overlay non sa su che schermata si posa. */}
      <Scheda imbottitura={spazi.m} su="chiaro" sfondo={colori.pericoloTenue}>
        <Corpo taglia={12.5}>{avviso}</Corpo>
      </Scheda>
    </Toccabile>
  )
}

/**
 * Il dialogo di conferma per un'azione distruttiva — uscire, eliminare una
 * conversazione. Sostituisce `Alert.alert`: nativo, senza i colori del
 * design (il pulsante non poteva essere in pericolo), e sul web con più di due
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
                questo bottone parla, ed è per disfare qualcosa. La variante
                `pericolo` invece di un `backgroundColor` da qui: così il colore
                del testo si calcola insieme al fondo. */}
            <BottonePrimario
              testo={testoConferma}
              pericolo
              style={{ flex: 1 }}
              onPress={onConferma}
            />
          </View>
        </Scheda>
      </View>
    </Modal>
  )
}

/**
 * Il foglio che sale dal basso: il menu «···» del dettaglio di un capo.
 *
 * Sta qui accanto a `Conferma` perché è la stessa cosa in un'altra posa — un
 * `Modal` trasparente, un velo d'inchiostro sopra la schermata, e una
 * superficie che porta le scelte. Cambia dove si posa (in fondo invece che al
 * centro) e cosa contiene (un elenco invece di due bottoni).
 *
 * **Una voce senza `onPress` è disegnata spenta, con il suo `perche` sotto**, e
 * non viene omessa. È una scelta: un menu che nasconde ciò che non sa ancora
 * fare insegna che quella cosa non esiste; un menu che la mostra spenta e dice
 * perché insegna che non esiste *ancora*. Tre voci del deck stanno così, e la
 * riga sotto ciascuna dice cosa manca.
 */
export function Foglio({
  visibile,
  titolo,
  sottotitolo,
  voci,
  onChiudi,
}: {
  visibile: boolean
  titolo: string
  sottotitolo?: string
  voci: {
    etichetta: string
    icona: NomeIcona
    /** Assente: la voce è spenta, e `perche` dice cosa manca. */
    onPress?: () => void
    /** Un'azione che disfa: si scrive in pericolo. */
    pericolo?: boolean
    perche?: string
  }[]
  onChiudi: () => void
}) {
  const bordi = useSafeAreaInsets()
  return (
    <Modal visible={visibile} transparent animationType="slide" onRequestClose={onChiudi}>
      {/* Il velo è toccabile: fuori dal foglio si chiude, come ci si aspetta
          da un foglio. `scala={0}` perché un velo a tutto schermo che si
          rimpicciolisce al tocco è un difetto, non un feedback. */}
      <Toccabile
        onPress={onChiudi}
        scala={0}
        style={{ flex: 1, backgroundColor: velo(colori.inchiostro, 0.45), justifyContent: 'flex-end' }}
      >
        <View style={{ padding: spazi.m, paddingBottom: Math.max(bordi.bottom, spazi.m), gap: spazi.s }}>
          <Scheda imbottitura={spazi.s}>
            <View style={{ paddingHorizontal: spazi.m, paddingTop: spazi.s, paddingBottom: spazi.m }}>
              <Forte taglia="guida" numberOfLines={1}>
                {titolo}
              </Forte>
              {sottotitolo ? (
                <Corpo taglia="minuto" tono="tenue" numberOfLines={1}>
                  {sottotitolo}
                </Corpo>
              ) : null}
            </View>

            {voci.map((voce, indice) => {
              const spenta = !voce.onPress
              const tinta = spenta
                ? testoSu.chiaro.debole
                : voce.pericolo
                  ? colori.pericolo
                  : colori.inchiostro
              return (
                <Toccabile
                  key={voce.etichetta}
                  onPress={voce.onPress}
                  scala={voce.onPress ? 0.98 : 0}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spazi.m,
                    paddingHorizontal: spazi.m,
                    paddingVertical: 13,
                    borderTopWidth: indice === 0 ? 0 : 1,
                    borderTopColor: linee.tenue,
                  }}
                >
                  <Icona nome={voce.icona} misura={18} colore={tinta} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Corpo taglia="corpo" colore={tinta}>
                      {voce.etichetta}
                    </Corpo>
                    {/* `tenue`, non `debole`: l'etichetta spenta può stare a
                        0.45 — è interfaccia inattiva — ma questa riga è **il
                        motivo per cui la voce esiste spenta**, cioè l'unica
                        cosa che va letta. A 11px e 0.45 starebbe intorno a
                        3:1. È lo stesso tono del sottotitolo qui sopra. */}
                    {spenta && voce.perche ? (
                      <Corpo taglia="micro" tono="tenue">
                        {voce.perche}
                      </Corpo>
                    ) : null}
                  </View>
                </Toccabile>
              )
            })}
          </Scheda>

          <BottonePrimario testo="Annulla" chiaro onPress={onChiudi} />
        </View>
      </Toccabile>
    </Modal>
  )
}
