/**
 * La porta d'ingresso.
 *
 * Alla prima apertura si passa dall'onboarding; dalla seconda si entra
 * direttamente nell'armadio. La differenza fra le due sta in una riga su disco,
 * perché la seconda apertura non deve chiedere niente a nessuno.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { colori } from '../src/tema/tokens'

const CHIAVE_INTRO = 'tela.intro-vista'

export default function Ingresso() {
  const [introVista, setIntroVista] = useState<boolean | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(CHIAVE_INTRO)
      .then((valore) => setIntroVista(valore === '1'))
      // Se lo storage non risponde, mostrare l'intro è il male minore:
      // rivederla costa tre tocchi, non vedere nulla costa l'app.
      .catch(() => setIntroVista(false))
  }, [])

  if (introVista === null) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
  return <Redirect href={introVista ? '/(tabs)/oggi' : '/onboarding'} />
}

export async function segnaIntroVista(): Promise<void> {
  await AsyncStorage.setItem(CHIAVE_INTRO, '1').catch(() => undefined)
}
