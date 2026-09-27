/**
 * Dove supabase-js tiene la sessione, sul telefono: il portachiavi del sistema.
 *
 * È lo stesso posto dove stava il token del backend di prima, ed è una scelta:
 * le guide di Supabase per Expo propongono AsyncStorage o `expo-sqlite`, che
 * salvano **in chiaro** nella cartella dell'app. La sessione contiene il
 * refresh token, che vale quanto l'account, e il portachiavi lo cifra.
 *
 * Il prezzo, dichiarato: su iOS alcune versioni rifiutano valori sopra circa
 * 2 KB, e una sessione con l'identità Google li supera. Su Android Expo non
 * pone limiti, e oggi l'app è solo Android. Il giorno che arriva iOS la voce è
 * `T-63` in `docs/DA_FARE.md`.
 *
 * Sul web il portachiavi non c'è: `sessione-archivio.web.ts`.
 */

import * as SecureStore from 'expo-secure-store'

/**
 * Il token del backend di prima, ormai inutile: si toglie all'avvio. A ogni
 * avvio, non una volta sola — costa una chiamata al portachiavi, e ricordarsi
 * di averlo già fatto costerebbe una chiave in più.
 */
void SecureStore.deleteItemAsync('wardrobe.token').catch(() => undefined)

export const archiviazioneSessione = {
  getItem: (chiave: string) => SecureStore.getItemAsync(chiave),
  setItem: (chiave: string, valore: string) => SecureStore.setItemAsync(chiave, valore),
  removeItem: (chiave: string) => SecureStore.deleteItemAsync(chiave),
}
