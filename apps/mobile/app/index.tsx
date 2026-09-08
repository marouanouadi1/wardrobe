/**
 * La porta d'ingresso.
 *
 * Senza un token si va all'intro (prima volta) o al login (le successive) —
 * l'intro è marketing puro, nessuna chiamata di rete, quindi può stare prima
 * dell'autenticazione. Con un token, alla prima apertura si passa dalle
 * preferenze di stile (salvano sul backend, serve un utente); dalla seconda
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
  const { token, pronto: sessionePronta } = useSessione()
  // `null` = non ancora letta: solo lo stato che dipende davvero da una
  // lettura asincrona vive in uno state — il resto della rotta (sessione
  // pronta o no, token presente o no) si decide direttamente al render.
  const [introVista, setIntroVista] = useState<boolean | null>(null)
  const [preferenzeViste, setPreferenzeViste] = useState<boolean | null>(null)

  useEffect(() => {
    if (!sessionePronta) return
    if (!token) {
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
  }, [sessionePronta, token])

  if (!sessionePronta) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
  // Aspetta che la sessione abbia letto il portachiavi prima di decidere: fin
  // lì `token` è sempre `null`, e manderebbe all'intro anche chi ha già una
  // sessione salvata.
  if (!token) {
    if (introVista === null) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
    return <Redirect href={introVista ? '/accedi' : '/intro'} />
  }
  if (preferenzeViste === null) return <View style={{ flex: 1, backgroundColor: colori.sfondo }} />
  return <Redirect href={preferenzeViste ? '/(tabs)/oggi' : '/preferenze'} />
}
