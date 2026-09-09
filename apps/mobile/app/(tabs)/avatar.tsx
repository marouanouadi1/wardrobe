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
import { SLOT_ORDINATI, coloriDiVestizione } from '../../src/dati/dominio'
import { colori, ETICHETTE, linee, spazi } from '../../src/tema/tokens'
import { BadgeIa, BottonePrimario, BottoneSecondario, Pillola } from '../../src/ui/base'
import { Schermata } from '../../src/ui/guscio'
import { Vuoto } from '../../src/ui/stati'

const NON_SCELTO = linee.media
const SLOT_CON_ABITO = [...SLOT_ORDINATI, 'dress'] as const

export default function SchermataAvatar() {
  const { profilo, vestizione, indice, mescola, svestiSlot, salvaOutfit } = useArmadio()
  const c = coloriDiVestizione(vestizione, indice)
  const vuoto = !c.top && !c.bottom && !c.outer && !c.dress && !c.shoes
  const indossati = SLOT_CON_ABITO.filter((slot) => vestizione[slot])

  return (
    <Schermata
      occhiello="Prova virtuale"
      titolo="Come mi sta"
      fotoProfilo={profilo?.foto_url}
      tab
      contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spazi.l }}
    >
      {vuoto ? (
        <Vuoto
          titolo="Ancora nessun outfit"
          spiegazione={'Scegline uno da «Oggi» o dal suggeritore, e lo vedi qui addosso.'}
        />
      ) : (
        <>
          <Svg width={180} height={360} viewBox="0 0 180 360">
            <Ellipse cx={90} cy={38} rx={26} ry={30} fill={colori.pelle} />
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

          {/* Prima questa schermata era solo da guardare: `svestiSlot`,
              `mescola` e `salvaOutfit()` esistevano già nell'archivio e
              nessuna vista li chiamava. Una pillola per slot indossato, con
              la ‹×› per toglierlo — non un tocco sulla sagoma stessa, le sue
              forme non sono rettangoli su cui puntare in modo affidabile. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s, justifyContent: 'center' }}>
            {indossati.map((slot) => {
              const capo = indice.get(vestizione[slot]!)
              if (!capo) return null
              return (
                <Pillola
                  key={slot}
                  testo={`${ETICHETTE.slot[slot]}: ${capo.nome} ×`}
                  attiva
                  onPress={() => svestiSlot(slot)}
                />
              )
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: spazi.s, width: '100%', paddingHorizontal: spazi.xl }}>
            <BottoneSecondario testo="Mescola" icona="mescola" style={{ flex: 1 }} onPress={mescola} />
            <BottonePrimario
              testo="Salva outfit"
              style={{ flex: 1 }}
              onPress={() => void salvaOutfit('Outfit di oggi')}
            />
          </View>
        </>
      )}
    </Schermata>
  )
}
