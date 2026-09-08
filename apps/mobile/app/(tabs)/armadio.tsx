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
import { ScrollView, TextInput, View } from 'react-native'
import { useArmadio } from '../../src/dati/archivio'
import { ETICHETTE, colori, ombre, raggi, spazi } from '../../src/tema/tokens'
import { Bolla, Icona, Pillola, Toccabile, Vuoto } from '../../src/ui/base'
import { CapoInGriglia } from '../../src/ui/capi'
import { Corpo, Forte, Titolo } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

type Filtro = 'tutti' | TipoCapo | 'da_lavare' | 'preferiti'

const FILTRI: { valore: Filtro; etichetta: string }[] = [
  { valore: 'tutti', etichetta: 'Tutti' },
  { valore: 'top', etichetta: 'Top' },
  { valore: 'pantaloni', etichetta: 'Pantaloni' },
  { valore: 'scarpe', etichetta: 'Scarpe' },
  { valore: 'capospalla', etichetta: 'Capospalla' },
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

  const daLavare = capi.filter((capo) => capo.stato !== 'pulito').length

  return (
    <View style={{ flex: 1 }}>
      <Testata
        occhiello={`${capi.length} capi${daLavare ? ` · ${daLavare} in lavatrice` : ''}`}
        titolo="Il tuo armadio"
        fotoProfilo={profilo?.foto_url}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 130, gap: spazi.m }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spazi.s,
            paddingHorizontal: spazi.l,
            paddingVertical: 12,
            borderRadius: raggi.pillola,
            backgroundColor: colori.scheda,
            ...ombre.bassa,
          }}
        >
          <Icona nome="cerca" misura={17} colore="rgba(21,21,26,0.45)" spessore={2.2} />
          <TextInput
            value={ricerca}
            onChangeText={setRicerca}
            placeholder="lino, nero, giacca…"
            placeholderTextColor="rgba(21,21,26,0.4)"
            style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 14.5, color: colori.inchiostro }}
          />
        </View>

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
          {mostrati.length === 1 ? '1 capo' : `${mostrati.length} capi`}
        </Forte>

        {mostrati.length === 0 ? (
          <Vuoto
            titolo="Niente con questi filtri"
            spiegazione="Prova a togliere la ricerca, oppure aggiungi un capo con il «+» in basso."
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.m }}>
            {mostrati.map((capo) => (
              <View key={capo.id} style={{ width: '47.5%' }}>
                <CapoInGriglia capo={capo} onPress={() => router.push(`/capo/${capo.id}`)} />
              </View>
            ))}
          </View>
        )}

        <Toccabile
          onPress={() => router.push('/suggeritore')}
          scala={0.98}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            padding: 15,
            borderRadius: raggi.medio + 4,
            backgroundColor: colori.inchiostro,
          }}
        >
          <Bolla nome="scintilla" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Titolo taglia={15.5} colore={colori.scheda}>
              Chiedi tu a Wardrobe
            </Titolo>
            <Corpo taglia={11.5} colore="rgba(255,253,249,0.55)">
              «Ho una cena, voglio stare comodo»
            </Corpo>
          </View>
          <Icona nome="chevron" misura={16} colore={colori.ambra} spessore={2.4} />
        </Toccabile>
      </ScrollView>
    </View>
  )
}
