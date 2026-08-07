/**
 * L'armadio, in tre viste.
 *
 * «Appeso» è quella predefinita, e non per vezzo: mostra i capi come stanno in
 * un armadio vero, e questo fa capire in mezzo secondo cos'è questa schermata.
 * Griglia ed elenco servono quando i capi sono cento e si cerca qualcosa di
 * preciso — allora il realismo diventa un ostacolo.
 */

import type { StatoCapo, TipoCapo } from '@wardrobe/contracts'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { useArmadio } from '../../src/dati/archivio'
import { ETICHETTE, colori, ombre, raggi, spazi } from '../../src/tema/tokens'
import { Bolla, Icona, Pillola, Segmenti, Toccabile, Vuoto } from '../../src/ui/base'
import { CapoAppeso, CapoInElenco, CapoInGriglia, INCLINAZIONI } from '../../src/ui/capi'
import { Corpo, Forte, Titolo } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

type Vista = 'appeso' | 'griglia' | 'elenco'

const VISTE = [
  { valore: 'appeso' as const, etichetta: 'Appeso' },
  { valore: 'griglia' as const, etichetta: 'Griglia' },
  { valore: 'elenco' as const, etichetta: 'Elenco' },
] as const

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

const ASTE: TipoCapo[] = ['capospalla', 'top', 'pantaloni', 'scarpe']

export default function Armadio() {
  const { capi, profilo } = useArmadio()
  const parametri = useLocalSearchParams<{ stato?: StatoCapo }>()
  const [vista, setVista] = useState<Vista>('appeso')
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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
          <Forte taglia={12.5} tono="tenue" style={{ flex: 1 }}>
            {mostrati.length === 1 ? '1 capo' : `${mostrati.length} capi`}
          </Forte>
          <View style={{ width: 230 }}>
            <Segmenti voci={VISTE} scelta={vista} onScegli={setVista} />
          </View>
        </View>

        {mostrati.length === 0 ? (
          <Vuoto
            titolo="Niente con questi filtri"
            spiegazione="Prova a togliere la ricerca, oppure aggiungi un capo con il «+» in basso."
          />
        ) : vista === 'appeso' ? (
          <View
            style={{
              borderRadius: raggi.grande - 2,
              overflow: 'hidden',
              paddingBottom: 14,
              ...ombre.alta,
            }}
          >
            <LinearGradient
              colors={[colori.armadioAlto, '#221E1B', colori.armadioBasso]}
              locations={[0, 0.58, 1]}
            >
              {ASTE.map((tipo) => {
                const dellAsta = mostrati.filter((capo) => capo.tipo === tipo)
                if (dellAsta.length === 0) return null
                return (
                  <View key={tipo} style={{ paddingTop: 20, paddingBottom: 8 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        gap: spazi.s,
                        paddingHorizontal: 18,
                        paddingBottom: 4,
                      }}
                    >
                      <Titolo taglia={16} colore="#F1E9DC">
                        {ETICHETTE.tipo[tipo]}
                      </Titolo>
                      <Forte taglia={11.5} colore="rgba(241,233,220,0.42)">
                        {dellAsta.length === 1 ? '1 capo' : `${dellAsta.length} capi`}
                      </Forte>
                    </View>

                    {/* L'asta: la barra metallica su cui poggiano le grucce. */}
                    <View style={{ height: 8, marginHorizontal: 14, marginTop: 6 }}>
                      <LinearGradient
                        colors={['#EDE6D8', colori.asta, '#6E6558']}
                        locations={[0, 0.45, 1]}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: 3,
                          height: 3,
                          borderRadius: 99,
                        }}
                      />
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 14, paddingHorizontal: 18, paddingBottom: 6 }}
                    >
                      {dellAsta.map((capo, indice) => (
                        <CapoAppeso
                          key={capo.id}
                          capo={capo}
                          inclinazione={INCLINAZIONI[indice % INCLINAZIONI.length]!}
                          onPress={() => router.push(`/capo/${capo.id}`)}
                        />
                      ))}
                      <Toccabile
                        onPress={() => router.push('/(tabs)/carica')}
                        scala={0.96}
                        style={{
                          width: 132,
                          height: 200,
                          marginTop: 17,
                          borderRadius: 18,
                          borderWidth: 1.5,
                          borderStyle: 'dashed',
                          borderColor: 'rgba(241,233,220,0.28)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: spazi.s,
                        }}
                      >
                        <Icona nome="piu" misura={20} colore="rgba(241,233,220,0.55)" />
                        <Forte taglia={11.5} colore="rgba(241,233,220,0.55)">
                          Aggiungi
                        </Forte>
                      </Toccabile>
                    </ScrollView>
                  </View>
                )
              })}
            </LinearGradient>
          </View>
        ) : vista === 'griglia' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.m }}>
            {mostrati.map((capo) => (
              <View key={capo.id} style={{ width: '47.5%' }}>
                <CapoInGriglia capo={capo} onPress={() => router.push(`/capo/${capo.id}`)} />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 9 }}>
            {mostrati.map((capo) => (
              <CapoInElenco key={capo.id} capo={capo} onPress={() => router.push(`/capo/${capo.id}`)} />
            ))}
          </View>
        )}

        {vista === 'appeso' ? (
          <Corpo taglia={11.5} tono="debole" style={{ textAlign: 'center' }}>
            Scorri le aste di lato · tocca un capo per aprirlo
          </Corpo>
        ) : null}

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
          <Icona nome="chevron" misura={16} colore={colori.citron} spessore={2.4} />
        </Toccabile>
      </ScrollView>
    </View>
  )
}
