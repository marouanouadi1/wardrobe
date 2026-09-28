/**
 * Le due sequenze che portano una foto dal telefono allo Storage, e al modello.
 *
 * Erano scritte a mano in **tre** punti (`T-21`): due volte per intero in
 * `app/(tabs)/carica.tsx` — il percorso della foto singola e quello della coda,
 * identici riga per riga — e una terza a metà in `src/dati/archivio.tsx`
 * (`impostaFotoAvatar`), che della sequenza usa solo il caricamento.
 *
 * Sono funzioni, non un hook. La voce `T-21` in `docs/DA_FARE.md` aveva già
 * pesato le due strade e scartato `useAzione` con tre motivi concreti: il suo
 * `mappaErrore` non sa dire «non mostrare niente», che serve al ramo annullato;
 * il percorso della coda **ingoia di proposito** ogni errore e non ha bisogno
 * di uno stato d'errore; e un solo booleano `caricamento` verrebbe acceso e
 * spento N volte dentro il ciclo, mentre il segnale vero dell'interfaccia è lo
 * stato di ogni singola foto. Una funzione toglie le righe duplicate senza
 * aggiungere uno stato che nessuno dei due percorsi userebbe.
 */

import type { EsitoAnalisi } from '@wardrobe/contracts'
import { api } from './api'
import { caricaFoto, firmaCapo } from './supabase'

/**
 * Carica una foto e restituisce il suo percorso nello Storage. È la metà di
 * sequenza che serve anche a chi non deve analizzare niente — la foto
 * dell'avatar.
 */
export async function caricaUnaFoto(uri: string, cosa: 'capi' | 'avatar' = 'capi'): Promise<string> {
  return caricaFoto(uri, cosa)
}

/**
 * Analizza una foto **già caricata** e restituisce l'esito, con il capo pronto
 * da mostrare.
 *
 * Sta a sé perché è ciò che serve per **riprovare**: quando la lettura non
 * riesce, la foto è già nello Storage — è salita prima che il modello la
 * guardasse. Rimandarla sarebbe far pagare all'utente, in tempo e in dati, un
 * errore che non è suo.
 *
 * Il capo arriva dal backend senza gli indirizzi delle sue foto: quelli li
 * firma l'app con la propria sessione, prima di restituirlo.
 */
export async function analizzaCaricata(chiave: string, segnale?: AbortSignal): Promise<EsitoAnalisi> {
  const esito = await api.analizza(chiave, segnale)
  return esito.capo ? { ...esito, capo: await firmaCapo(esito.capo) } : esito
}

/**
 * La sequenza intera: carica, analizza.
 *
 * Restituisce **anche la chiave**, non solo l'esito: senza, chi vuole
 * riprovare dopo un fallimento non ha modo di sapere che la foto è già là, e
 * la ricaricherebbe da capo.
 *
 * **Il segnale copre solo la seconda metà, e questo non va nascosto.**
 * `caricaFoto` passa da `expo-file-system`, non da `fetch`, e non accetta
 * un `AbortSignal`: chi annulla mentre la foto sta salendo vede la schermata
 * cambiare subito, ma l'upload prosegue finché non finisce da solo. Solo
 * l'analisi si ferma davvero. Un'estrazione che facesse sembrare abortibile
 * tutta la sequenza sarebbe un regresso, non una semplificazione — è il
 * vincolo scritto in `T-21`.
 */
export async function analizzaFoto(
  uri: string,
  segnale?: AbortSignal,
): Promise<{ chiave: string; esito: EsitoAnalisi }> {
  const chiave = await caricaUnaFoto(uri)
  return { chiave, esito: await analizzaCaricata(chiave, segnale) }
}
