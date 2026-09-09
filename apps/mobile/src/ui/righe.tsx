/**
 * La riga che torna identica in più schermate: la voce navigabile con icona e
 * chevron (Profilo, l'invito «Chiedi tu» dell'armadio).
 */

import { View } from 'react-native'
import { colori, linee, raggi, spazi } from '../tema/tokens'
import { Bolla, Scheda, type NomeIcona, Icona, Toccabile } from './base'
import { Corpo, Forte, Numero, Titolo } from './testo'

/**
 * Bolla + titolo + sottotitolo + chevron: la voce navigabile del design.
 * `su="scuro"` è la variante piena (bg inchiostro, chevron ambra) delle
 * scorciatoie in evidenza — «Chiedi tu a Wardrobe».
 */
export function RigaNavigabile({
  icona,
  titolo,
  sottotitolo,
  onPress,
  onPressaLungo,
  su = 'chiaro',
  bordo,
}: {
  icona: NomeIcona
  titolo: string
  sottotitolo: string
  onPress?: () => void
  /** Un'azione secondaria sulla stessa riga — es. eliminare, nell'elenco delle
   * conversazioni — senza aggiungere un'icona che non fa parte del set. */
  onPressaLungo?: () => void
  su?: 'chiaro' | 'scuro'
  /** Un bordo sottile invece del solo fondo — le righe «di servizio» di Profilo. */
  bordo?: boolean
}) {
  const scura = su === 'scuro'
  return (
    <Toccabile
      onPress={onPress}
      onLongPress={onPressaLungo}
      scala={0.98}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: spazi.xl - 4,
        borderRadius: raggi.medioAlto,
        backgroundColor: scura ? colori.inchiostro : colori.scheda,
        ...(bordo ? { borderWidth: 1, borderColor: linee.tenue } : {}),
      }}
    >
      {scura ? (
        <Bolla nome={icona} misura={40} />
      ) : (
        <Bolla nome={icona} misura={40} sfondo={linee.tenue} colore={colori.inchiostro} />
      )}
      <View style={{ flex: 1 }}>
        <Titolo taglia={17} su={su}>
          {titolo}
        </Titolo>
        <Corpo taglia={12} tono="tenue" su={su}>
          {sottotitolo}
        </Corpo>
      </View>
      <Icona nome="chevron" misura={17} colore={scura ? colori.ambra : linee.chevron} spessore={2.4} />
    </Toccabile>
  )
}

/**
 * La fila di due o tre numeri — Profilo, il calendario. Una tessera senza
 * `sfondo` è la card di sempre (`Scheda`, bianca, con la sua ombra); con
 * `sfondo` diventa una tinta piena e senza ombra, per il caso di Profilo dove
 * una delle tre («fermi») è volutamente inchiostro pieno.
 */
export function RigaStatistiche({
  voci,
}: {
  voci: readonly {
    numero: string
    etichetta: string
    sfondo?: string
    tinta?: string
  }[]
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 9 }}>
      {voci.map((voce) =>
        voce.sfondo ? (
          <View
            key={voce.etichetta}
            style={{ flex: 1, padding: 15, borderRadius: raggi.medio + 2, backgroundColor: voce.sfondo }}
          >
            <Numero taglia={24} colore={voce.tinta}>
              {voce.numero}
            </Numero>
            <Forte taglia={10.5} colore={voce.tinta} style={{ marginTop: 5, opacity: 0.6 }}>
              {voce.etichetta}
            </Forte>
          </View>
        ) : (
          <Scheda key={voce.etichetta} imbottitura={15} style={{ flex: 1 }}>
            <Numero taglia={26}>{voce.numero}</Numero>
            <Corpo taglia={10.5} tono="tenue" style={{ marginTop: 5 }}>
              {voce.etichetta}
            </Corpo>
          </Scheda>
        ),
      )}
    </View>
  )
}
