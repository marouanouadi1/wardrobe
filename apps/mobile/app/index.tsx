/**
 * La porta d'ingresso.
 *
 * Senza un token si va al login, sempre: non c'è più una modalità di
 * sviluppo che lo salta. Con un token, alla prima apertura si passa
 * dall'onboarding; dalla seconda si entra direttamente nell'armadio — la
 * differenza sta in una riga su disco, perché la seconda apertura non deve
 * chiedere niente a nessuno.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useSessione } from '../src/dati/sessione'
import { colori } from '../src/tema/tokens'

const CHIAVE_INTRO = 'wardrobe.intro-vista'

export default function Ingresso() {
  const { token, pronto: sessionePronta } = useSessione()
  // `null` = non ancora letta: solo lo stato che dipende davvero da una
  // lettura asincrona vive in uno state — il resto della rotta (sessione
  // pronta o no, token presente o no) si decide direttamente al render.
  const [introVista, setIntroVista] = useState<boolean | null>(null)

  useEffect(() => {
    if (!sessionePronta || !token) return
    AsyncStorage.getItem(CHIAVE_INTRO)
      .then((valore) => setIntroVista(valore === '1'))
      // Se lo storage non risponde, l'onboarding è la scelta più sicura:
      // al più si rivede un'intro già vista, non si perde l'accesso.
      .catch(() => setIntroVista(false))
  }, [sessionePronta, token])

  if (!sessionePronta) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
  // Aspetta che la sessione abbia letto il portachiavi prima di decidere: fin
  // lì `token` è sempre `null`, e manderebbe al login anche chi ha già una
  // sessione salvata.
  if (!token) return <Redirect href="/accedi" />
  if (introVista === null) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
  return <Redirect href={introVista ? '/(tabs)/oggi' : '/onboarding'} />
}

export async function segnaIntroVista(): Promise<void> {
  await AsyncStorage.setItem(CHIAVE_INTRO, '1').catch(() => undefined)
}
