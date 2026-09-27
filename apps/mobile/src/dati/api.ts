/**
 * Il client del backend dell'IA: analisi delle foto, suggerimenti, chat,
 * esportazione. Tipizzato dai contratti generati dal backend.
 *
 * Il resto — capi, outfit, profilo, storico della chat, segnalazioni — l'app
 * lo legge e lo scrive da sé su Supabase (`supabase.ts`, ADR 0010). Il backend
 * riceve il token della sessione di Supabase e agisce **come l'utente**: vede
 * solo quello che vede lui.
 *
 * Nessun tipo scritto a mano qui dentro: arrivano da `@wardrobe/contracts`, che
 * è la proiezione TypeScript dei modelli Pydantic. Se il backend rinomina un
 * campo, il rosso appare qui — al momento della build, non in produzione.
 */

import type {
  EsitoAnalisi,
  EsportazionePronta,
  RichiestaMessaggioChat,
  RichiestaSuggerimenti,
  RispostaChat,
  RispostaSuggerimenti,
} from '@wardrobe/contracts'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { ErroreDati } from './errori'
import { rinnovaSessione, tokenDiAccesso } from './supabase'

/** La porta di `npm run api:local` (default di `services/api`). */
const PORTA_API_LOCALE = '8787'

/**
 * In sviluppo (Expo Go o dev client), niente da scrivere a mano: si ricava
 * dallo stesso host a cui il telefono si è già collegato per il bundle JS —
 * lo stesso IP del QR code — assumendo che l'API giri sulla stessa macchina.
 * Non è affidabile su un build EAS: lì non c'è un Metro a cui appoggiarsi, ed
 * `EXPO_PUBLIC_API_URL` (sotto) prende sempre la precedenza.
 *
 * Sul web `Constants.expoConfig.hostUri` non esiste (non c'è un manifest
 * scaricato da un Metro remoto): l'host giusto è quello con cui il browser ha
 * già raggiunto la pagina, `window.location.hostname`.
 */
function rilevaUrlSviluppo(): string | null {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null
    return `http://${window.location.hostname}:${PORTA_API_LOCALE}`
  }
  const hostUri = Constants.expoConfig?.hostUri
  const host = hostUri?.split(':')[0]
  return host ? `http://${host}:${PORTA_API_LOCALE}` : null
}

/**
 * L'indirizzo dell'API. `EXPO_PUBLIC_API_URL` sovrascrive il rilevamento
 * automatico — serve per un build EAS (backend in cloud) o quando l'euristica
 * indovina l'host sbagliato (più schede di rete).
 */
export const URL_API = process.env.EXPO_PUBLIC_API_URL ?? rilevaUrlSviluppo()

async function una(
  percorso: string,
  token: string | null,
  opzioni: { metodo?: string; corpo?: unknown; segnale?: AbortSignal },
): Promise<Response> {
  return fetch(`${URL_API}${percorso}`, {
    method: opzioni.metodo ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opzioni.corpo === undefined ? undefined : JSON.stringify(opzioni.corpo),
    signal: opzioni.segnale,
  })
}

async function chiama<T>(
  percorso: string,
  opzioni: {
    metodo?: string
    corpo?: unknown
    /** Per abortire una richiesta lunga (l'analisi di una foto) da un
     * timeout o da un tocco su «Annulla» — vedi `carica.tsx`. */
    segnale?: AbortSignal
  } = {},
): Promise<T> {
  if (!URL_API) {
    throw new ErroreDati(
      'api_non_configurata',
      'Non riesco a determinare l\'indirizzo dell\'API: imposta EXPO_PUBLIC_API_URL.',
    )
  }

  let risposta = await una(percorso, await tokenDiAccesso(), opzioni)

  // Un 401 non vuol dire «sei fuori». Il backend lo dà anche a un token che
  // scade fra pochi minuti prima di un lavoro lungo come l'analisi: si
  // rinnova la sessione e si riprova, **una volta**. E il backend non chiude
  // mai una sessione di Supabase: un 401 che resta è un errore di questa
  // richiesta. Se il refresh token non vale più, supabase-js toglie la
  // sessione da sé e `sessione.tsx` lo sente (`SIGNED_OUT`).
  if (risposta.status === 401) {
    const rinnovato = await rinnovaSessione()
    if (rinnovato) risposta = await una(percorso, rinnovato, opzioni)
  }

  if (!risposta.ok) {
    // Il backend risponde sempre con { errore, messaggio }: lo rispettiamo
    // invece di inventare un messaggio nostro.
    const dettaglio = await risposta.json().catch(() => ({}))
    throw new ErroreDati(
      String(dettaglio.errore ?? 'errore_sconosciuto'),
      String(dettaglio.messaggio ?? `L'API ha risposto ${risposta.status}`),
      risposta.status,
    )
  }

  if (risposta.status === 204) return undefined as T
  return (await risposta.json()) as T
}

export const api = {
  salute: () => chiama<{ stato: string; versione: string }>('/salute'),

  /**
   * Legge una foto già nello Storage e crea il capo. La risposta arriva a
   * lavoro finito ed è l'esito intero: lo stato, il capo — **senza gli
   * indirizzi delle foto**, che firma l'app (`firmaCapo`) — o il motivo.
   */
  analizza: (chiaveFoto: string, segnale?: AbortSignal) =>
    chiama<EsitoAnalisi>('/capi/analisi', {
      metodo: 'POST',
      corpo: { chiave_foto: chiaveFoto },
      segnale,
    }),

  suggerimenti: (richiesta: RichiestaSuggerimenti) =>
    chiama<RispostaSuggerimenti>('/suggerimenti', { metodo: 'POST', corpo: richiesta }),

  /** Un messaggio allo stilista. Lo storico lo si legge da Supabase (`supabase.ts`). */
  inviaChat: (richiesta: RichiestaMessaggioChat) =>
    chiama<RispostaChat>('/chat', { metodo: 'POST', corpo: richiesta }),

  /**
   * Chiede un indirizzo firmato da cui scaricare l'archivio, **non i dati**.
   *
   * Un'app React Native non ha un «scarica»: il file lo prende il browser di
   * sistema, che non ha il nostro token — da qui la firma, che vale pochi
   * minuti. Chi lo riceve lo apre con `Linking.openURL`, e da lì è il sistema
   * operativo a occuparsene.
   */
  esportazione: () => chiama<EsportazionePronta>('/esportazione', { metodo: 'POST' }),
}
