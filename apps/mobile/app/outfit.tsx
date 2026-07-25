/**
 * Gli outfit salvati: combinazioni che hanno già funzionato.
 *
 * Un outfit salvato vale più di un suggerimento nuovo — è già stato approvato
 * da chi lo indossa. Per questo la scheda mostra quante volte è stato messo:
 * è l'informazione che dice se fidarsi.
 */

import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { useArmadio } from '../src/dati/archivio'
import { capiDiVestizione, quandoUsato } from '../src/dati/dominio'
import { colori, ombre, raggi, spazi } from '../src/tema/tokens'
import { Icona, Toccabile, Vuoto } from '../src/ui/base'
import { Corpo, Etichetta, Titolo } from '../src/ui/testo'
import { Testata } from '../src/ui/testata'

export default function Outfit() {
  const { outfit, indice, vesti } = useArmadio()

  return (
    <View style={{ flex: 1 }}>
      <Testata
        occhiello={outfit.length === 1 ? '1 salvato' : `${outfit.length} salvati`}
        titolo="I tuoi outfit"
        indietro
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 60, gap: spazi.l }}
        showsVerticalScrollIndicator={false}
      >
        {outfit.length === 0 ? (
          <Vuoto
            titolo="Ancora nessun outfit"
            spiegazione="Componine uno sull'avatar e salvalo: lo ritrovi qui, pronto per la prossima volta."
          />
        ) : null}

        {outfit.map((salvato) => {
          const capi = capiDiVestizione(salvato.vestizione, indice)
          const copertina = capi[0]
          return (
            <View
              key={salvato.id}
              style={{
                borderRadius: raggi.grande - 2,
                overflow: 'hidden',
                backgroundColor: colori.scheda,
                ...ombre.scheda,
              }}
            >
              <View style={{ flexDirection: 'row', height: 250 }}>
                {capi.slice(0, 4).map((capo) => (
                  <Image
                    key={capo.id}
                    source={{ uri: capo.foto.url ?? undefined }}
                    style={{ flex: 1, backgroundColor: capo.colore.hex }}
                    contentFit="cover"
                    contentPosition={{ top: '25%', left: '50%' }}
                  />
                ))}
                {!copertina ? <View style={{ flex: 1, backgroundColor: colori.sfondo }} /> : null}

                {salvato.occasione ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: raggi.pillola,
                      backgroundColor: 'rgba(255,253,249,0.9)',
                    }}
                  >
                    <Etichetta taglia={11}>{salvato.occasione}</Etichetta>
                  </View>
                ) : null}
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spazi.m,
                  paddingHorizontal: 16,
                  paddingVertical: 15,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Titolo taglia={19}>{salvato.nome}</Titolo>
                  <Corpo taglia={12} tono="tenue">
                    {salvato.volte_indossato
                      ? `Indossato ${salvato.volte_indossato} volte · ultima ${quandoUsato(salvato.ultimo_uso)}`
                      : 'Mai indossato'}
                    {salvato.origine === 'ia' ? ' · proposto da Tela' : ''}
                  </Corpo>
                </View>
                <Toccabile
                  onPress={() => {
                    vesti(salvato.vestizione)
                    router.push('/(tabs)/avatar')
                  }}
                  scala={0.92}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: raggi.pillola,
                    backgroundColor: colori.inchiostro,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icona nome="freccia" misura={18} colore={colori.crema} spessore={2.2} />
                </Toccabile>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
