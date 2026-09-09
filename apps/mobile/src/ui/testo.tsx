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

type Tono = 'forte' | 'medio' | 'tenue' | 'debole'

interface Props extends TextProps {
  children?: ReactNode
  /** Su che fondo si posa: su `'scuro'` i toni si invertono. */
  su?: 'chiaro' | 'scuro'
  tono?: Tono
  colore?: string
  /** Un numero esatto, o una chiave di `tipografia` (`tema/tokens.ts`) —
   * `taglia="sezione"` invece di ridigitare `19`. */
  taglia?: number | keyof typeof tipografia
}

function colore(props: Props): string {
  if (props.colore) return props.colore
  const scala = props.su === 'scuro' ? testoSu.scuro : testoSu.chiaro
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
        { fontSize: numero, lineHeight: numero * 1.1, color: colore(props) },
        style,
      ]}
    />
  )
}

/** Numero grande: statistiche, contatori. */
export function Numero({ taglia = 26, style, ...props }: Props) {
  const numero = risolviTaglia(taglia)
  return (
    <Text
      {...props}
      style={[
        stili.display,
        { fontSize: numero, lineHeight: numero, letterSpacing: -numero * 0.04, color: colore(props) },
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
        { fontSize: numero, lineHeight: numero * 1.5, color: colore(props) },
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
        { fontSize: numero, lineHeight: numero * 1.3, color: colore(props) },
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
      style={[stili.etichetta, { fontSize: numero, color: colore(props) }, style]}
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
