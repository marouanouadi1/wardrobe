/**
 * La porta d'ingresso.
 *
 * Senza una sessione si va all'intro (prima volta) o al login (le successive) —
 * l'intro è marketing puro, nessuna chiamata di rete, quindi può stare prima
 * dell'autenticazione. Con una sessione, alla prima apertura si passa dalle
 * preferenze di stile (salvano il profilo, serve un utente); dalla seconda
 * si entra direttamente nell'armadio — la differenza sta in una riga su
 * disco, perché la seconda apertura non deve chiedere niente a nessuno.
 */

import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { introGiaVista, preferenzeGiaViste } from '../src/dati/intro'
import { useSessione } from '../src/dati/sessione'
import { colori } from '../src/tema/tokens'

export default function Ingresso() {
  const { utente, pronto: sessionePronta } = useSessione()
  const dentro = utente !== null
  // `null` = non ancora letta: solo lo stato che dipende davvero da una
  // lettura asincrona vive in uno state — il resto della rotta (sessione
  // pronta o no, qualcuno dentro o no) si decide direttamente al render.
  const [introVista, setIntroVista] = useState<boolean | null>(null)
  const [preferenzeViste, setPreferenzeViste] = useState<boolean | null>(null)

  useEffect(() => {
    if (!sessionePronta) return
    if (!dentro) {
      // Se lo storage non risponde, l'intro è la scelta più sicura: al più
      // si rivede un'intro già vista, non si perde l'accesso.
      introGiaVista()
        .then(setIntroVista)
        .catch(() => setIntroVista(false))
    } else {
      preferenzeGiaViste()
        .then(setPreferenzeViste)
        .catch(() => setPreferenzeViste(false))
    }
  }, [sessionePronta, dentro])

  if (!sessionePronta) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
  // Aspetta che la sessione salvata sia stata letta prima di decidere: fin
  // lì `utente` è sempre `null`, e manderebbe all'intro anche chi ha già una
  // sessione salvata.
  if (!dentro) {
    if (introVista === null) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
    return <Redirect href={introVista ? '/accedi' : '/intro'} />
  }
  if (preferenzeViste === null) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
  // Il primo accesso fa i tre passi del deck: account → misure → stile.
  // Il segnale resta uno solo (`preferenzeViste`), perché è l'ultimo passo a
  // chiuderli tutti: chi salta le misure arriva comunque a `preferenze`, e
  // dare a ciascun passo il suo flag vorrebbe dire poterli lasciare a metà in
  // combinazioni che nessuno ha pensato.
  return <Redirect href={preferenzeViste ? '/(tabs)/oggi' : '/misure?onboarding=1'} />
}
