/**
 * L'intro: due schermate, prima del login, nessuna chiamata di rete.
 *
 * Prima c'era un terzo passo qui — le preferenze di stile — ma salvarle
 * chiama `api.salvaProfilo`, che vuole un bearer token: senza un utente non
 * c'è dove appoggiare quel salvataggio. Quel passo vive ora in
 * `preferenze.tsx`, dopo il login. Qui restano solo le due schermate di puro
 * marketing: cosa fa l'app, e perché fotografare basta.
 *
 * Le due foto di sfondo erano caricate da Pexels a ogni apertura — la prima
 * impressione dell'app dipendeva dalla rete. Ora sono nel bundle
 * (`assets/intro-passo-*.jpg`, foto Pexels 17745134 e 31064320, licenza
 * Pexels: nessuna attribuzione richiesta).
 */

import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { BackHandler, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { segnaIntroVista } from '../src/dati/intro'
import { colori, linee, raggi, spazi } from '../src/tema/tokens'
import { BottoneIndietro, BottonePrimario, LinkTesto, Toccabile } from '../src/ui/base'
import { Corpo, Etichetta, Titolo } from '../src/ui/testo'

const PASSI = [
  {
    occhiello: 'benvenuto',
    titolo: 'Il tuo armadio, finalmente in ordine.',
    corpo:
      'Fotografi i vestiti una volta sola. Poi ogni mattina ti dico cosa mettere, con quello che hai già in casa.',
    azione: 'Come funziona',
    foto: require('../assets/intro-passo-1.jpg') as number,
  },
  {
    occhiello: 'come funziona',
    titolo: 'Fotografa. Non compilare niente.',
    corpo:
      'Un capo per foto. Il modello riconosce categoria, colore, tessuto, stagione e lavaggio. Tu correggi solo se sbaglia.',
    azione: 'Accedi o registrati',
    foto: require('../assets/intro-passo-2.jpg') as number,
  },
] as const

export default function Intro() {
  const [passo, setPasso] = useState(0)
  const bordi = useSafeAreaInsets()
  const corrente = PASSI[passo]!
  const ultimo = passo === PASSI.length - 1

  // Il tasto indietro hardware di Android: senza questo, al secondo passo
  // esce dall'app invece di tornare al primo — non c'è un gesto predittivo
  // a cui appoggiarsi (`app.json` ha `predictiveBackGestureEnabled: false`).
  useEffect(() => {
    if (passo === 0) return
    const sottoscrizione = BackHandler.addEventListener('hardwareBackPress', () => {
      setPasso((precedente) => Math.max(0, precedente - 1))
      return true
    })
    return () => sottoscrizione.remove()
  }, [passo])

  function entra() {
    // Segna l'intro come vista prima di entrare, in entrambe le uscite:
    // senza, `index.tsx` la rimostra a ogni apertura senza token.
    void segnaIntroVista()
    router.push('/accedi')
  }

  return (
    <View style={{ flex: 1, backgroundColor: colori.sfondo }}>
      <Image source={corrente.foto} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
          {passo > 0 ? <BottoneIndietro onPress={() => setPasso(passo - 1)} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Titolo taglia={22}>wardrobe</Titolo>
            <View
              style={{ width: 6, height: 6, borderRadius: raggi.pillola, backgroundColor: colori.ambra }}
            />
          </View>
        </View>

        <View style={{ marginTop: 'auto', gap: spazi.m }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {PASSI.map((_, indice) => (
              <Toccabile
                key={indice}
                scala={0}
                haptic={false}
                hitSlop={8}
                onPress={indice < passo ? () => setPasso(indice) : undefined}
                style={{
                  height: 3,
                  borderRadius: raggi.pillola,
                  width: indice === passo ? 26 : 10,
                  backgroundColor: indice === passo ? colori.ambra : linee.chiara,
                }}
              >
                <View />
              </Toccabile>
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
              backgroundColor: linee.tenue,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: raggi.pillola, backgroundColor: colori.ambra }} />
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
            onPress={() => (ultimo ? entra() : setPasso(passo + 1))}
          />

          <LinkTesto onPress={entra}>Ho già un account</LinkTesto>
        </View>
      </View>
    </View>
  )
}
