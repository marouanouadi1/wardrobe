/**
 * Il gruppo delle schede, e il cancello che lo protegge.
 *
 * **La barra non si disegna più qui.** Stava nella prop `tabBar` di `<Tabs>`,
 * e per questo esisteva solo dentro questo gruppo: sul dettaglio di un capo,
 * in chat, sul calendario semplicemente non c'era. Ora è `BarraSchede`
 * (`src/ui/guscio.tsx`), montata una volta sola in `app/_layout.tsx` sopra
 * tutto, e la scheda accesa si deduce dal percorso (`Q-11`, 2026-09-23).
 *
 * `tabBar={() => null}` e non l'assenza della prop: senza, il navigatore
 * disegnerebbe la sua barra di sistema sotto la nostra.
 */

import { Redirect, Tabs } from 'expo-router'
import { useSessione } from '../../src/dati/sessione'
import { colori } from '../../src/tema/tokens'

export default function DisposizioneSchede() {
  const { token, pronto } = useSessione()

  // `index.tsx` manda già al login chi non ha un token, ma questo layout
  // resta il vero cancello: uno schema `wardrobe://` (`app.json`) può portare
  // qui direttamente, scavalcando quel redirect. Non decide finché la
  // sessione non ha letto il portachiavi almeno una volta.
  if (pronto && !token) return <Redirect href="/accedi" />

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colori.sfondo } }}
      tabBar={() => null}
    >
      <Tabs.Screen name="oggi" />
      <Tabs.Screen name="armadio" />
      <Tabs.Screen name="carica" />
      <Tabs.Screen name="avatar" />
      <Tabs.Screen name="profilo" />
    </Tabs>
  )
}
