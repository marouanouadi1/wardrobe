/**
 * L'intro: due schermate, prima del login, nessuna chiamata di rete.
 *
 * Prima c'era un terzo passo qui — le preferenze di stile — ma salvarle
 * chiama `api.salvaProfilo`, che vuole un bearer token: senza un utente non
 * c'è dove appoggiare quel salvataggio. Quel passo vive ora in
 * `preferenze.tsx`, dopo il login. Qui restano solo le due schermate di puro
 * marketing: cosa fa l'app, e perché fotografare basta.
 */

import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colori, raggi, spazi } from '../src/tema/tokens'
import { BottonePrimario, Toccabile } from '../src/ui/base'
import { Corpo, Etichetta, Titolo } from '../src/ui/testo'

const PASSI = [
  {
    occhiello: 'benvenuto',
    titolo: 'Il tuo armadio, finalmente in ordine.',
    corpo:
      'Fotografi i vestiti una volta sola. Poi ogni mattina ti dico cosa mettere, con quello che hai già in casa.',
    azione: 'Come funziona',
    foto: 17745134,
  },
  {
    occhiello: 'come funziona',
    titolo: 'Fotografa. Non compilare niente.',
    corpo:
      'Un capo per foto. Il modello riconosce categoria, colore, tessuto, stagione e lavaggio. Tu correggi solo se sbaglia.',
    azione: 'Accedi o registrati',
    foto: 31064320,
  },
] as const

function foto(id: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900&h=1300&fit=crop`
}

export default function Intro() {
  const [passo, setPasso] = useState(0)
  const bordi = useSafeAreaInsets()
  const corrente = PASSI[passo]!
  const ultimo = passo === PASSI.length - 1

  return (
    <View style={{ flex: 1, backgroundColor: colori.sfondo }}>
      <Image
        source={{ uri: foto(corrente.foto) }}
        style={{ position: 'absolute', inset: 0 }}
        contentFit="cover"
        transition={300}
      />
      {/* La sfumatura non è decorazione: senza, il testo scuro su una foto
          qualunque diventa illeggibile. */}
      <LinearGradient
        colors={['rgba(242,238,231,0.1)', 'rgba(242,238,231,0.55)', 'rgba(242,238,231,0.97)']}
        locations={[0, 0.46, 1]}
        style={{ position: 'absolute', inset: 0 }}
      />

      <View
        style={{
          flex: 1,
          paddingTop: Math.max(bordi.top, 20) + 20,
          paddingBottom: Math.max(bordi.bottom, 20) + 10,
          paddingHorizontal: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Titolo taglia={22}>wardrobe</Titolo>
          <View
            style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: colori.ambra }}
          />
        </View>

        <View style={{ marginTop: 'auto', gap: spazi.m }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {PASSI.map((_, indice) => (
              <View
                key={indice}
                style={{
                  height: 3,
                  borderRadius: 99,
                  width: indice === passo ? 26 : 10,
                  backgroundColor: indice === passo ? colori.ambra : 'rgba(21,21,26,0.14)',
                }}
              />
            ))}
          </View>

          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingVertical: 6,
              paddingLeft: 8,
              paddingRight: 12,
              borderRadius: raggi.pillola,
              backgroundColor: 'rgba(21,21,26,0.06)',
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: colori.ambra }} />
            <Etichetta taglia={11}>{corrente.occhiello}</Etichetta>
          </View>

          <Titolo taglia={40} style={{ letterSpacing: -1.6 }}>
            {corrente.titolo}
          </Titolo>
          <Corpo taglia={15} tono="medio" style={{ maxWidth: 330 }}>
            {corrente.corpo}
          </Corpo>

          <BottonePrimario
            testo={corrente.azione}
            freccia
            style={{ marginTop: spazi.m }}
            onPress={() => (ultimo ? router.push('/accedi') : setPasso(passo + 1))}
          />

          <Toccabile
            onPress={() => router.push('/accedi')}
            scala={0}
            style={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <Corpo taglia={13.5} tono="tenue">
              Ho già un account
            </Corpo>
          </Toccabile>
        </View>
      </View>
    </View>
  )
}
