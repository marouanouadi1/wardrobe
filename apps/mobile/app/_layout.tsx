/**
 * La radice dell'app: caratteri, stato, aree sicure.
 *
 * I caratteri si caricano prima di mostrare qualunque cosa. È deliberato: con il
 * fallback di sistema la prima schermata apparirebbe con la tipografia
 * sbagliata e poi salterebbe, e quel salto è la prima impressione.
 */

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
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ArchivioProvider } from '../src/dati/archivio'
import { colori } from '../src/tema/tokens'

export default function RadiceApp() {
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
        <ArchivioProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colori.sfondo },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="accedi" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="capo/[id]" />
            <Stack.Screen name="suggeritore" />
            <Stack.Screen name="outfit" />
            <Stack.Screen name="calendario" />
            <Stack.Screen name="dev/playground" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="dev/modelli" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
        </ArchivioProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
