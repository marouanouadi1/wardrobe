/**
 * I due passaggi del primo ingresso, letti da AsyncStorage.
 *
 * Sono due chiavi separate perché sono due schermate separate: l'intro (prima
 * del login, marketing puro) e le preferenze di stile (dopo, quando esiste già
 * un utente a cui appoggiare il salvataggio via API). `index.tsx`, `intro.tsx`
 * e `preferenze.tsx` leggono e scrivono da qui, mai da un file di rotta.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const CHIAVE_INTRO = 'wardrobe.intro-vista'
const CHIAVE_PREFERENZE = 'wardrobe.preferenze-viste'

export async function introGiaVista(): Promise<boolean> {
  return (await AsyncStorage.getItem(CHIAVE_INTRO)) === '1'
}

export async function segnaIntroVista(): Promise<void> {
  await AsyncStorage.setItem(CHIAVE_INTRO, '1').catch(() => undefined)
}

export async function preferenzeGiaViste(): Promise<boolean> {
  return (await AsyncStorage.getItem(CHIAVE_PREFERENZE)) === '1'
}

export async function segnaPreferenzeViste(): Promise<void> {
  await AsyncStorage.setItem(CHIAVE_PREFERENZE, '1').catch(() => undefined)
}
