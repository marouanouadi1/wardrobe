/**
 * La riga che torna identica in più schermate: la voce navigabile con icona e
 * chevron (Profilo, l'invito «Chiedi tu» dell'armadio).
 */

import { View } from 'react-native'
import { colori, linee, raggi, spazi, testoSu } from '../tema/tokens'
import { Bolla, Scheda, type NomeIcona, Icona, Toccabile } from './base'
import { useFondo, type Su } from './fondo'
import { Corpo, Forte, Numero, Titolo } from './testo'

/**
 * Bolla + titolo + sottotitolo + chevron: la voce navigabile del design.
 * `su="scuro"` è la variante piena (bg inchiostro, chevron chiaro) delle
 * scorciatoie in evidenza — «Chiedi tu ad Aura».
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
      <Icona nome="chevron" misura={17} colore={scura ? testoSu.scuro.tenue : linee.chevron} spessore={2.4} />
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

/**
 * Una riga di impostazione: etichetta a sinistra, valore a destra, chevron se
 * porta da qualche parte.
 *
 * **Senza `onPress` la riga è spenta e la sua `nota` dice cosa manca**, invece
 * di sparire: stessa scelta di `Foglio` (`ui/avviso.tsx`), stessa ragione —
 * un'impostazione nascosta insegna che quella cosa non esiste, una spenta che
 * dice cosa manca insegna che non esiste *ancora*.
 *
 * La `nota` sta a `tenue` e non a `debole`: l'etichetta spenta può stare al
 * tono dell'interfaccia inattiva, ma la riga che spiega è **la cosa da
 * leggere**, e a 11px il 45% d'inchiostro sta intorno a 3:1.
 */
export function RigaImpostazione({
  etichetta,
  valore,
  onPress,
  nota,
  pericolo,
  primo,
}: {
  etichetta: string
  valore?: string
  /** Assente: la riga è **spenta**, e `nota` dice cosa manca. */
  onPress?: () => void
  /**
   * La riga sotto l'etichetta. Su una riga spenta è il motivo per cui lo è; su
   * una accesa è quello che il tocco sta per fare — «apre il browser», «cambia
   * dove finiscono le foto». Una prop sola e non due che disegnano la stessa
   * riga: cambia il testo, non il posto.
   *
   * Si scrive per chi tiene il telefono, mai per chi legge `DA_FARE.md`: «un
   * capo non si può ancora eliminare», non «manca la rotta DELETE».
   */
  nota?: string
  pericolo?: boolean
  primo?: boolean
}) {
  // Non dipinge niente: sta dentro la `Scheda` di chi la chiama, e da lì
  // eredita. Ma i tre colori che compone a mano — il testo spento, la linea di
  // separazione, il chevron — erano fissi su `chiaro`: dentro una scheda scura
  // sarebbero spariti. È la forma esatta della regressione di PR #4, e `tsc`
  // non la vede perché sono tutti `string`.
  const fondo = useFondo()
  const spenta = !onPress
  const tinta = spenta ? testoSu[fondo].debole : pericolo ? colori.pericolo : testoSu[fondo].forte
  return (
    <Toccabile
      onPress={onPress}
      scala={0}
      style={{
        paddingHorizontal: 17,
        paddingVertical: 14,
        gap: 4,
        borderTopWidth: primo ? 0 : 1,
        borderTopColor: fondo === 'scuro' ? linee.scura : linee.tenue,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.m }}>
        <Corpo taglia={14.5} colore={tinta} style={{ flex: 1 }}>
          {etichetta}
        </Corpo>
        {valore ? (
          <Corpo taglia={13} tono="tenue" numberOfLines={1}>
            {valore}
          </Corpo>
        ) : null}
        {onPress ? (
          <Icona nome="chevron" misura={15} colore={testoSu[fondo].debole} spessore={2.4} />
        ) : null}
      </View>
      {nota ? (
        <Corpo taglia="micro" tono="tenue">
          {nota}
        </Corpo>
      ) : null}
    </Toccabile>
  )
}
