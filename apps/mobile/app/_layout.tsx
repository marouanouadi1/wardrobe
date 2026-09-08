/**
 * La radice dell'app: caratteri, stato, aree sicure.
 *
 * I caratteri si caricano prima di mostrare qualunque cosa. È deliberato: con il
 * fallback di sistema la prima schermata apparirebbe con la tipografia
 * sbagliata e poi salterebbe, e quel salto è la prima impressione.
 */

import * as Sentry from '@sentry/react-native'
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque'
import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ArchivioProvider } from '../src/dati/archivio'
import { avviaSegnalazioni } from '../src/dati/segnalazioni'
import { SessioneProvider } from '../src/dati/sessione'
import { colori } from '../src/tema/tokens'
import { Avviso } from '../src/ui/avviso'

// Fuori dal componente apposta: `Sentry.init` vuole girare una volta sola,
// prima del primo render, non a ogni montaggio della radice.
avviaSegnalazioni()

function RadiceApp() {
  const [caratteriPronti] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_800ExtraBold,
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  })

  if (!caratteriPronti) return null

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colori.sfondo }}>
      <SafeAreaProvider>
        <SessioneProvider>
          <ArchivioProvider>
            <StatusBar style="dark" />
            <View style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colori.sfondo },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="accedi" options={{ animation: 'fade' }} />
                <Stack.Screen name="registrati" options={{ animation: 'fade' }} />
                <Stack.Screen name="intro" options={{ animation: 'fade' }} />
                <Stack.Screen name="preferenze" options={{ animation: 'fade' }} />
                <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                <Stack.Screen name="capo/[id]" />
                <Stack.Screen name="suggeritore" />
                <Stack.Screen name="outfit" />
                <Stack.Screen name="calendario" />
                <Stack.Screen name="segnalazioni" />
                <Stack.Screen name="dev/playground" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="dev/modelli" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="dev/valutazioni" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="dev/prova-3d" options={{ animation: 'slide_from_bottom' }} />
              </Stack>
              <Avviso />
            </View>
          </ArchivioProvider>
        </SessioneProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

// `Sentry.wrap` non è decorativo: è ciò che monta il modulo di segnalazione
// nell'albero. Senza, `showFeedbackWidget()` non ha nulla da mostrare e il
// tap sul pulsante nel profilo non apre niente.
export default Sentry.wrap(RadiceApp)
