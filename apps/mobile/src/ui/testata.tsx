/**
 * La testata comune: occhiello, titolo display, ritorno, ritratto.
 *
 * Sta in un componente perché è l'elemento che compare in tutte e undici le
 * schermate, e perché la coppia occhiello + titolo è il modo in cui l'app dice
 * dove sei senza una barra di navigazione tradizionale.
 */

import { router } from 'expo-router'
import { Image } from 'expo-image'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colori, raggi, spazi } from '../tema/tokens'
import { Corpo, Titolo } from './testo'
import { Icona, Toccabile } from './base'

export function Testata({
  occhiello,
  titolo,
  indietro,
  fotoProfilo,
  scura,
}: {
  occhiello: string
  titolo: string
  indietro?: boolean
  fotoProfilo?: string | null
  scura?: boolean
}) {
  const bordi = useSafeAreaInsets()

  return (
    <View
      style={{
        paddingTop: Math.max(bordi.top, 14) + 8,
        paddingHorizontal: spazi.xl,
        paddingBottom: spazi.s,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spazi.m,
      }}
    >
      {indietro ? (
        <Toccabile
          onPress={() => router.back()}
          scala={0.92}
          style={{
            width: 38,
            height: 38,
            borderRadius: raggi.pillola,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: scura ? 'rgba(247,244,239,0.1)' : 'rgba(21,21,26,0.06)',
          }}
        >
          <Icona nome="indietro" misura={17} colore={scura ? colori.crema : colori.inchiostro} spessore={2.2} />
        </Toccabile>
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Corpo taglia={11.5} tono="tenue" scuro={scura}>
          {occhiello}
        </Corpo>
        <Titolo taglia={27} scuro={scura} style={{ marginTop: 1 }}>
          {titolo}
        </Titolo>
      </View>

      {fotoProfilo !== undefined ? (
        <Toccabile
          onPress={() => router.push('/(tabs)/profilo')}
          scala={0.92}
          style={{
            width: 42,
            height: 42,
            borderRadius: raggi.pillola,
            overflow: 'hidden',
            backgroundColor: 'rgba(21,21,26,0.06)',
          }}
        >
          {fotoProfilo ? (
            <Image source={{ uri: fotoProfilo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icona nome="utente" misura={20} colore="rgba(21,21,26,0.5)" />
            </View>
          )}
        </Toccabile>
      ) : null}
    </View>
  )
}
