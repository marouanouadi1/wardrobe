/**
 * La riga che torna identica in più schermate: la voce navigabile con icona e
 * chevron (Profilo, l'invito «Chiedi tu» dell'armadio).
 */

import { View } from 'react-native'
import { colori, linee, raggi, spazi } from '../tema/tokens'
import { Bolla, type NomeIcona, Icona, Toccabile } from './base'
import { Corpo, Titolo } from './testo'

/**
 * Bolla + titolo + sottotitolo + chevron: la voce navigabile del design.
 * `su="scuro"` è la variante piena (bg inchiostro, chevron ambra) delle
 * scorciatoie in evidenza — «Chiedi tu a Wardrobe», «Modelli in uso».
 */
export function RigaNavigabile({
  icona,
  titolo,
  sottotitolo,
  onPress,
  su = 'chiaro',
  bordo,
}: {
  icona: NomeIcona
  titolo: string
  sottotitolo: string
  onPress?: () => void
  su?: 'chiaro' | 'scuro'
  /** Un bordo sottile invece del solo fondo — le righe «di servizio» di Profilo. */
  bordo?: boolean
}) {
  const scura = su === 'scuro'
  return (
    <Toccabile
      onPress={onPress}
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
      <Icona nome="chevron" misura={17} colore={scura ? colori.ambra : 'rgba(21,21,26,0.3)'} spessore={2.4} />
    </Toccabile>
  )
}
