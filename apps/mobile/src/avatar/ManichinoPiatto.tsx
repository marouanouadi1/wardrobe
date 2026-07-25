/**
 * Il manichino 2D: una silhouette in SVG, tinta con i colori dell'outfit.
 *
 * Non è un ripiego di serie B, è la garanzia: gira su qualunque telefono, non
 * usa WebGL, non ha dipendenze native, e mostra esattamente l'informazione che
 * conta — come stanno insieme quei colori. Il 3D aggiunge il piacere di girarci
 * intorno; questo assicura che la funzione ci sia sempre.
 *
 * Le proporzioni sono quelle del manichino 3D del design, appiattite.
 */

import { View } from 'react-native'
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg'
import { colori as tinte } from '../tema/tokens'
import type { PropsRenderer } from './renderer'

const PELLE = '#D6D2CE'
const OMBRA = 'rgba(21,21,26,0.10)'

export function ManichinoPiatto({ colori }: PropsRenderer) {
  const sopra = colori.dress ?? colori.top
  const sotto = colori.dress ? null : colori.bottom

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width="100%" height="100%" viewBox="0 0 200 400" preserveAspectRatio="xMidYMid meet">
        {/* l'ombra a terra: dà peso alla figura */}
        <Ellipse cx="100" cy="376" rx="52" ry="8" fill={OMBRA} />

        <G>
          {/* corpo */}
          <Ellipse cx="100" cy="42" rx="23" ry="26" fill={PELLE} />
          <Rect x="93" y="64" width="14" height="16" rx="6" fill={PELLE} />
          <Path d="M70 84 Q100 74 130 84 L136 190 Q100 200 64 190 Z" fill={PELLE} />
          <Rect x="52" y="92" width="17" height="120" rx="8" fill={PELLE} />
          <Rect x="131" y="92" width="17" height="120" rx="8" fill={PELLE} />
          <Rect x="78" y="196" width="19" height="150" rx="9" fill={PELLE} />
          <Rect x="103" y="196" width="19" height="150" rx="9" fill={PELLE} />

          {/* sotto: pantaloni o gonna */}
          {sotto ? (
            <>
              <Path d="M68 186 L132 186 L134 246 L66 246 Z" fill={sotto} />
              <Rect x="76" y="240" width="23" height="108" rx="10" fill={sotto} />
              <Rect x="101" y="240" width="23" height="108" rx="10" fill={sotto} />
            </>
          ) : null}

          {/* sopra: maglia, camicia o abito */}
          {sopra ? (
            colori.dress ? (
              <Path d="M67 82 Q100 72 133 82 L152 288 Q100 302 48 288 Z" fill={sopra} />
            ) : (
              <>
                <Path d="M67 82 Q100 72 133 82 L138 194 Q100 204 62 194 Z" fill={sopra} />
                <Rect x="50" y="88" width="21" height="76" rx="10" fill={sopra} />
                <Rect x="129" y="88" width="21" height="76" rx="10" fill={sopra} />
              </>
            )
          ) : null}

          {/* fuori: capospalla aperto, si vede quello che c'è sotto */}
          {colori.outer ? (
            <>
              <Path d="M62 84 Q76 74 92 80 L92 210 L56 214 Z" fill={colori.outer} />
              <Path d="M138 84 Q124 74 108 80 L108 210 L144 214 Z" fill={colori.outer} />
              <Rect x="44" y="88" width="24" height="118" rx="11" fill={colori.outer} />
              <Rect x="132" y="88" width="24" height="118" rx="11" fill={colori.outer} />
            </>
          ) : null}

          {/* scarpe */}
          {colori.shoes ? (
            <>
              <Path d="M74 340 L100 340 L102 362 Q88 368 72 362 Z" fill={colori.shoes} />
              <Path d="M100 340 L126 340 L128 362 Q112 368 98 362 Z" fill={colori.shoes} />
            </>
          ) : null}
        </G>

        {/* un velo di luce da sinistra, come nel design */}
        <Path d="M0 0 L200 0 L200 400 L0 400 Z" fill="url(#luce)" opacity={0} />
      </Svg>
    </View>
  )
}

/** Quando manca tutto: una silhouette spenta invece di uno spazio bianco. */
export function ManichinoSpento() {
  return <ManichinoPiatto colori={{ top: tinte.sfondo, bottom: '#DAD5CC', shoes: null, outer: null, dress: null }} />
}
