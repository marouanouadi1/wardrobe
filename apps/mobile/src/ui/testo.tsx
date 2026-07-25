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
import { caratteri, testoSu } from '../tema/tokens'

type Tono = 'forte' | 'medio' | 'tenue' | 'debole'

interface Props extends TextProps {
  children?: ReactNode
  /** Su fondo scuro i toni si invertono. */
  scuro?: boolean
  tono?: Tono
  colore?: string
  taglia?: number
}

function colore(props: Props): string {
  if (props.colore) return props.colore
  const scala = props.scuro ? testoSu.scuro : testoSu.chiaro
  return scala[props.tono ?? 'forte']
}

/** Titolo display. Le taglie del design: 40 (onboarding), 27 (testata), 19 (sezione). */
export function Titolo({ taglia = 27, style, ...props }: Props) {
  return (
    <Text
      {...props}
      style={[
        stili.display,
        { fontSize: taglia, lineHeight: taglia * 1.1, color: colore(props) },
        style,
      ]}
    />
  )
}

/** Numero grande: statistiche, contatori. */
export function Numero({ taglia = 26, style, ...props }: Props) {
  return (
    <Text
      {...props}
      style={[
        stili.display,
        { fontSize: taglia, lineHeight: taglia, letterSpacing: -taglia * 0.04, color: colore(props) },
        style,
      ]}
    />
  )
}

export function Corpo({ taglia = 14, style, ...props }: Props) {
  return (
    <Text
      {...props}
      style={[
        stili.testo,
        { fontSize: taglia, lineHeight: taglia * 1.5, color: colore(props) },
        style,
      ]}
    />
  )
}

export function Forte({ taglia = 14, style, ...props }: Props) {
  return (
    <Text
      {...props}
      style={[
        stili.forte,
        { fontSize: taglia, lineHeight: taglia * 1.3, color: colore(props) },
        style,
      ]}
    />
  )
}

/** Maiuscoletto spaziato: le etichette di sezione del design. */
export function Etichetta({ taglia = 11, style, ...props }: Props) {
  return (
    <Text
      {...props}
      style={[stili.etichetta, { fontSize: taglia, color: colore(props) }, style]}
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
