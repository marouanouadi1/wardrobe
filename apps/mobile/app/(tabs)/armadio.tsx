/**
 * L'armadio, in griglia.
 *
 * C'erano tre viste (appeso, griglia, elenco): la griglia di foto è quella
 * più luminosa e ariosa delle tre, ed è l'unica rimasta — niente selettore
 * da mostrare quando c'è una sola opzione.
 */

import type { StatoCapo, TipoCapo } from '@wardrobe/contracts'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useArmadio } from '../../src/dati/archivio'
import { conta } from '../../src/dati/formato'
import { ETICHETTE, griglie, spazi } from '../../src/tema/tokens'
import { BarraChiedi, Pillola } from '../../src/ui/base'
import { CapoInGriglia } from '../../src/ui/capi'
import { Vuoto } from '../../src/ui/stati'
import { Forte } from '../../src/ui/testo'
import { RigaNavigabile } from '../../src/ui/righe'
import { Schermata } from '../../src/ui/guscio'

type Filtro = 'tutti' | TipoCapo | 'da_lavare' | 'preferiti'

const FILTRI: { valore: Filtro; etichetta: string }[] = [
  { valore: 'tutti', etichetta: 'Tutti' },
  { valore: 'top', etichetta: ETICHETTE.tipo.top },
  { valore: 'pantaloni', etichetta: ETICHETTE.tipo.pantaloni },
  { valore: 'scarpe', etichetta: ETICHETTE.tipo.scarpe },
  { valore: 'capospalla', etichetta: ETICHETTE.tipo.capospalla },
  { valore: 'da_lavare', etichetta: 'Da lavare' },
  { valore: 'preferiti', etichetta: 'Preferiti' },
]

export default function Armadio() {
  const { capi, profilo } = useArmadio()
  const parametri = useLocalSearchParams<{ stato?: StatoCapo }>()
  const [filtro, setFiltro] = useState<Filtro>(parametri.stato === 'da_lavare' ? 'da_lavare' : 'tutti')
  const [ricerca, setRicerca] = useState('')

  const mostrati = useMemo(() => {
    const testo = ricerca.trim().toLowerCase()
    return capi.filter((capo) => {
      const passaFiltro =
        filtro === 'tutti'
          ? true
          : filtro === 'da_lavare'
            ? capo.stato !== 'pulito'
            : filtro === 'preferiti'
              ? capo.preferito
              : capo.tipo === filtro
      if (!passaFiltro) return false
      if (!testo) return true
      // La ricerca guarda anche materiale e brand: chi cerca «lino» vuole la
      // camicia, e «lino» non è nel suo nome.
      return [capo.nome, capo.colore.nome, capo.materiale, capo.brand, ETICHETTE.tipo[capo.tipo]]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(testo)
    })
  }, [capi, filtro, ricerca])

  const inLavatrice = capi.filter((capo) => capo.stato !== 'pulito').length

  return (
    <Schermata
      occhiello={`${capi.length} capi${inLavatrice ? ` · ${inLavatrice} in lavatrice` : ''}`}
      titolo="Il tuo armadio"
      fotoProfilo={profilo?.foto_url}
      tab
      contentStyle={{ gap: spazi.m }}
    >
      <BarraChiedi valore={ricerca} onCambia={setRicerca} placeholder="lino, nero, giacca…" icona="cerca" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
        {FILTRI.map((voce) => (
          <Pillola
            key={voce.valore}
            testo={voce.etichetta}
            attiva={filtro === voce.valore}
            onPress={() => setFiltro(voce.valore)}
          />
        ))}
      </ScrollView>

      <Forte taglia={12.5} tono="tenue">
        {conta(mostrati.length, 'capo', 'capi')}
      </Forte>

      {mostrati.length === 0 ? (
        <Vuoto
          titolo="Niente con questi filtri"
          spiegazione="Prova a togliere la ricerca, oppure aggiungi un capo con il «+» in basso."
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: griglie.armadio.distanza }}>
          {mostrati.map((capo) => (
            <View key={capo.id} style={{ width: griglie.armadio.colonna }}>
              <CapoInGriglia capo={capo} onPress={() => router.push(`/capo/${capo.id}`)} />
            </View>
          ))}
        </View>
      )}

      <RigaNavigabile
        icona="scintilla"
        titolo="Chiedi tu a Wardrobe"
        sottotitolo="«Ho una cena, voglio stare comodo»"
        su="scuro"
        onPress={() => router.push('/suggeritore')}
      />
    </Schermata>
  )
}
