/**
 * La porta d'ingresso.
 *
 * Alla prima apertura si passa dall'onboarding; dalla seconda si entra
 * direttamente nell'armadio. La differenza fra le due sta in una riga su disco,
 * perché la seconda apertura non deve chiedere niente a nessuno.
 *
 * Il login si aggiunge solo quando l'app punta a un indirizzo esplicito
 * (`EXPO_PUBLIC_API_URL`, una build EAS contro un server vero): in sviluppo
 * locale, dove il backend gira con `AUTH_APERTA=1` e non c'è nessun account
 * da creare, il login resterebbe solo un attrito senza motivo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { RICHIEDE_ACCESSO, caricaTokenSalvato } from '../src/dati/api'
import { colori } from '../src/tema/tokens'

const CHIAVE_INTRO = 'wardrobe.intro-vista'

type Destinazione = '/accedi' | '/onboarding' | '/(tabs)/oggi'

export default function Ingresso() {
  const [destinazione, setDestinazione] = useState<Destinazione | null>(null)

  useEffect(() => {
    Promise.all([
      RICHIEDE_ACCESSO ? caricaTokenSalvato() : Promise.resolve('sviluppo-locale'),
      AsyncStorage.getItem(CHIAVE_INTRO),
    ])
      .then(([token, introVista]) => {
        if (RICHIEDE_ACCESSO && !token) {
          setDestinazione('/accedi')
          return
        }
        setDestinazione(introVista === '1' ? '/(tabs)/oggi' : '/onboarding')
      })
      // Se lo storage non risponde, la scelta più sicura è quella che non
      // lascia entrare senza credenziali quando servono davvero.
      .catch(() => setDestinazione(RICHIEDE_ACCESSO ? '/accedi' : '/onboarding'))
  }, [])

  if (destinazione === null) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
  return <Redirect href={destinazione} />
}

export async function segnaIntroVista(): Promise<void> {
  await AsyncStorage.setItem(CHIAVE_INTRO, '1').catch(() => undefined)
}
