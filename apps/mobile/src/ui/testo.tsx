/**
 * La tipografia, in cinque componenti.
 *
 * Esistono per non ripetere `fontFamily` e `letterSpacing` in trenta schermate,
 * e perché la coppia display/testo è metà dell'identità del prodotto: il
 * display stretto con letterspacing negativo sui titoli, Manrope compatto su
 * tutto il resto.
 */

import type { ReactNode } from 'react'
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native'
import { caratteri, colori, testoSu, tipografia } from '../tema/tokens'
import { useFondo, type Su } from './fondo'

type Tono = 'forte' | 'medio' | 'tenue' | 'debole'

/** Un numero esatto, o una chiave di `tipografia` (`tema/tokens.ts`) —
 * `taglia="sezione"` invece di ridigitare `19`. */
export type Taglia = number | keyof typeof tipografia

interface Props extends TextProps {
  children?: ReactNode
  /** Su che fondo si posa: su `'scuro'` i toni si invertono. Di norma non
   * serve scriverlo — si eredita dal `<Fondo>` più vicino (`ui/fondo.tsx`);
   * questa prop resta come override esplicito, con la stessa precedenza di
   * `colore`. */
  su?: Su
  tono?: Tono
  colore?: string
  taglia?: Taglia
}

function useColore(props: Props): string {
  const fondo = useFondo()
  if (props.colore) return props.colore
  const scala = (props.su ?? fondo) === 'scuro' ? testoSu.scuro : testoSu.chiaro
  return scala[props.tono ?? 'forte']
}

/** Risolve una `taglia` — numero o chiave di `tipografia` — nel numero vero. */
function risolviTaglia(taglia: number | keyof typeof tipografia): number {
  return typeof taglia === 'number' ? taglia : tipografia[taglia]
}

/** Titolo display. Le taglie del design: `eroe` (onboarding), `testata`, `sezione` — vedi `tipografia`. */
export function Titolo({ taglia = 'testata', style, ...props }: Props) {
  const numero = risolviTaglia(taglia)
  return (
    <Text
      {...props}
      style={[
        stili.display,
        { fontSize: numero, lineHeight: numero * 1.1, color: useColore(props) },
        style,
      ]}
    />
  )
}

/** Numero grande: statistiche, contatori. */
export function Numero({ taglia = 'testata', style, ...props }: Props) {
  const numero = risolviTaglia(taglia)
  return (
    <Text
      {...props}
      style={[
        stili.display,
        { fontSize: numero, lineHeight: numero, letterSpacing: -numero * 0.04, color: useColore(props) },
        style,
      ]}
    />
  )
}

export function Corpo({ taglia = 'corpo', style, ...props }: Props) {
  const numero = risolviTaglia(taglia)
  return (
    <Text
      {...props}
      style={[
        stili.testo,
        { fontSize: numero, lineHeight: numero * 1.5, color: useColore(props) },
        style,
      ]}
    />
  )
}

export function Forte({ taglia = 'corpo', style, ...props }: Props) {
  const numero = risolviTaglia(taglia)
  return (
    <Text
      {...props}
      style={[
        stili.forte,
        { fontSize: numero, lineHeight: numero * 1.3, color: useColore(props) },
        style,
      ]}
    />
  )
}

/**
 * Un messaggio d'errore in linea — di validazione, o quello di
 * `GuscioAutenticazione` (`ui/guscio.tsx`). Due schermate scrivevano a mano
 * lo stesso `style={{ color: colori.corallo }}` su un `Corpo`.
 */
export function TestoErrore({ taglia = 'minuto', style, ...props }: Props) {
  return <Corpo taglia={taglia} colore={colori.corallo} style={style} {...props} />
}

/** Maiuscoletto spaziato: le etichette di sezione del design. */
export function Etichetta({ taglia = 'micro', style, ...props }: Props) {
  const numero = risolviTaglia(taglia)
  return (
    <Text
      {...props}
      style={[stili.etichetta, { fontSize: numero, color: useColore(props) }, style]}
    />
  )
}

const stili = StyleSheet.create({
  display: {
    fontFamily: caratteri.display,
    letterSpacing: -0.9,
  } as TextStyle,
  testo: { fontFamily: caratteri.testo },
  forte: { fontFamily: caratteri.testoForte },
  etichetta: {
    fontFamily: caratteri.testoNero,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  } as TextStyle,
})
