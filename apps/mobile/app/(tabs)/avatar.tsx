/**
 * «Come mi sta»: il manichino a primitive tinte, non l'avatar vero.
 *
 * È un ripiego dichiarato (`docs/adr/0004`): tinge una sagoma coi colori letti
 * dalle foto dei capi (`coloriDiVestizione`), non mostra le fotografie vere.
 * Resta finché scontorno e texture non sono pronti — a quel punto il capo si
 * vedrà dalla sua foto, non da un colore.
 */

import { View } from 'react-native'
import Svg, { Ellipse, Path } from 'react-native-svg'
import { useArmadio } from '../../src/dati/archivio'
import { coloriDiVestizione } from '../../src/dati/dominio'
import { spazi } from '../../src/tema/tokens'
import { BadgeIa, Vuoto } from '../../src/ui/base'
import { Testata } from '../../src/ui/testata'

const PELLE = '#E7DFD2'
const NON_SCELTO = 'rgba(21,21,26,0.08)'

export default function SchermataAvatar() {
  const { profilo, vestizione, indice } = useArmadio()
  const c = coloriDiVestizione(vestizione, indice)
  const vuoto = !c.top && !c.bottom && !c.outer && !c.dress && !c.shoes

  return (
    <View style={{ flex: 1 }}>
      <Testata occhiello="Prova virtuale" titolo="Come mi sta" fotoProfilo={profilo?.foto_url} />
      <View style={{ flex: 1, paddingHorizontal: spazi.xl, alignItems: 'center', justifyContent: 'center', gap: spazi.l }}>
        {vuoto ? (
          <Vuoto
            titolo="Ancora nessun outfit"
            spiegazione={'Scegline uno da «Oggi» o dal suggeritore, e lo vedi qui addosso.'}
          />
        ) : (
          <>
            <Svg width={180} height={360} viewBox="0 0 180 360">
              <Ellipse cx={90} cy={38} rx={26} ry={30} fill={PELLE} />
              {c.dress ? (
                <>
                  <Path d="M60 72c0-8 13-14 30-14s30 6 30 14v168c0 10-8 16-8 16H68s-8-6-8-16z" fill={c.dress} />
                  <Path d="M45 88l15-12v58l-14 20-16-10z" fill={c.dress} />
                  <Path d="M135 88l-15-12v58l14 20 16-10z" fill={c.dress} />
                </>
              ) : (
                <>
                  <Path
                    d="M60 72c0-8 13-14 30-14s30 6 30 14v50c0 10-8 16-8 16H68s-8-6-8-16z"
                    fill={c.outer ?? c.top ?? NON_SCELTO}
                  />
                  <Path d="M45 88l15-12v58l-14 20-16-10z" fill={c.outer ?? c.top ?? NON_SCELTO} />
                  <Path d="M135 88l-15-12v58l14 20 16-10z" fill={c.outer ?? c.top ?? NON_SCELTO} />
                  <Path d="M64 136h52l6 96H58z" fill={c.bottom ?? NON_SCELTO} />
                  <Path d="M60 232h26l-2 96H54z" fill={c.bottom ?? NON_SCELTO} />
                  <Path d="M94 232h26l6 96H92z" fill={c.bottom ?? NON_SCELTO} />
                </>
              )}
              <Ellipse cx={66} cy={336} rx={20} ry={10} fill={c.shoes ?? NON_SCELTO} />
              <Ellipse cx={116} cy={336} rx={20} ry={10} fill={c.shoes ?? NON_SCELTO} />
            </Svg>
            <BadgeIa testo="colori letti dalle foto" tenue />
          </>
        )}
      </View>
    </View>
  )
}
