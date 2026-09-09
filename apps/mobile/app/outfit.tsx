/**
 * Gli outfit salvati: combinazioni che hanno già funzionato.
 *
 * Un outfit salvato vale più di un suggerimento nuovo — è già stato approvato
 * da chi lo indossa. Per questo la scheda mostra quante volte è stato messo:
 * è l'informazione che dice se fidarsi.
 */

import { Image } from 'expo-image'
import { View } from 'react-native'
import { useArmadio, useVestiEVai } from '../src/dati/archivio'
import { capiDiVestizione, quandoUsato } from '../src/dati/dominio'
import { conta } from '../src/dati/formato'
import { colori, ombre, raggi, spazi, velo } from '../src/tema/tokens'
import { Badge, BottoneTondo } from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { Vuoto } from '../src/ui/stati'
import { Corpo, Titolo } from '../src/ui/testo'

export default function Outfit() {
  const { outfit, indice } = useArmadio()
  const vestiEVai = useVestiEVai()

  return (
    <Schermata occhiello={conta(outfit.length, 'salvato', 'salvati')} titolo="I tuoi outfit" indietro>
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
                  style={{ flex: 1, backgroundColor: colori.fondoFoto }}
                  contentFit="cover"
                  contentPosition={{ top: '25%', left: '50%' }}
                />
              ))}
              {!copertina ? <View style={{ flex: 1, backgroundColor: colori.sfondo }} /> : null}

              {salvato.occasione ? (
                <View style={{ position: 'absolute', top: 12, left: 12 }}>
                  <Badge testo={salvato.occasione} sfondo={velo(colori.scheda, 0.9)} colore={colori.inchiostro} />
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
                  {salvato.origine === 'ia' ? ' · proposto da Wardrobe' : ''}
                </Corpo>
              </View>
              <BottoneTondo
                nome="freccia"
                colore={colori.crema}
                sfondo={colori.inchiostro}
                misura={46}
                misuraIcona={18}
                onPress={() => vestiEVai(salvato.vestizione)}
              />
            </View>
          </View>
        )
      })}
    </Schermata>
  )
}
