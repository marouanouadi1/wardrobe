/**
 * La riga che torna identica in più schermate: la voce navigabile con icona e
 * chevron (Profilo, l'invito «Chiedi tu» dell'armadio).
 */

import { View } from 'react-native'
import { colori, linee, raggi, spazi } from '../tema/tokens'
import { Bolla, Scheda, type NomeIcona, Icona, Toccabile } from './base'
import { useFondo, type Su } from './fondo'
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
  su,
  bordo,
}: {
  icona: NomeIcona
  titolo: string
  sottotitolo: string
  onPress?: () => void
  /** Un'azione secondaria sulla stessa riga — es. eliminare, nell'elenco delle
   * conversazioni — senza aggiungere un'icona che non fa parte del set. */
  onPressaLungo?: () => void
  su?: Su
  /** Un bordo sottile invece del solo fondo — le righe «di servizio» di Profilo. */
  bordo?: boolean
}) {
  const ereditato = useFondo()
  const fondo = su ?? ereditato
  const scura = fondo === 'scuro'
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
        <Titolo taglia="guida" su={fondo}>
          {titolo}
        </Titolo>
        <Corpo taglia="micro" tono="tenue" su={fondo}>
          {sottotitolo}
        </Corpo>
      </View>
      <Icona nome="chevron" misura={17} colore={scura ? colori.ambra : linee.chevron} spessore={2.4} />
    </Toccabile>
  )
}

/**
 * La fila di due o tre numeri — Profilo, il calendario. Una tessera con `su`
 * è la card di sempre (`Scheda`, bianca, con la sua ombra); `su="scuro"` la
 * dipinge d'inchiostro pieno e senza ombra, per il caso di Profilo dove una
 * delle tre («fermi») lo è.
 *
 * Prima la voce portava `sfondo`/`tinta` come due campi separati — accoppiati
 * solo per convenzione, non dal tipo: nulla obbligava a passarli insieme.
 * `su` è un solo interruttore, e la tessera ricava il resto da sé.
 */
export function RigaStatistiche({
  voci,
}: {
  voci: readonly {
    numero: string
    etichetta: string
    su?: Su
  }[]
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 9 }}>
      {voci.map((voce) =>
        voce.su === 'scuro' ? (
          <Scheda key={voce.etichetta} su="scuro" sfondo={colori.inchiostro} imbottitura={15} style={{ flex: 1 }}>
            <Numero>{voce.numero}</Numero>
            <Forte taglia="nano" tono="medio" style={{ marginTop: 5 }}>
              {voce.etichetta}
            </Forte>
          </Scheda>
        ) : (
          <Scheda key={voce.etichetta} imbottitura={15} style={{ flex: 1 }}>
            <Numero>{voce.numero}</Numero>
            <Corpo taglia="nano" tono="tenue" style={{ marginTop: 5 }}>
              {voce.etichetta}
            </Corpo>
          </Scheda>
        ),
      )}
    </View>
  )
}
