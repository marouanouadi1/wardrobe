/**
 * Il client dell'API. Tipizzato dai contratti generati dal backend.
 *
 * Nessun tipo scritto a mano qui dentro: `Capo`, `ElencoCapi`,
 * `RichiestaPlayground` e compagnia arrivano da `@wardrobe/contracts`, che è la
 * proiezione TypeScript dei modelli Pydantic. Se il backend rinomina un campo,
 * il rosso appare qui — al momento della build, non in produzione.
 */

import Constants from 'expo-constants'
import { File } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type {
  AggiornamentoCapo,
  AnalisiAvviata,
  Capo,
  ContestoSuggerimento,
  Credenziali,
  ElencoCapi,
  ElencoMessaggiChat,
  EsitoAnalisi,
  EsitoPlayground,
  ModelloDisponibile,
  NuovoCapoManuale,
  NuovoOutfit,
  Outfit,
  PresetPrompt,
  Profilo,
  Registrazione,
  RichiestaMessaggioChat,
  RichiestaPlayground,
  RichiestaRatingImmagine,
  RichiestaSuggerimenti,
  RiepilogoArmadio,
  RispostaChat,
  RispostaSuggerimenti,
  RispostaValutazioni,
  RispostaValutazioniImmagini,
  TokenAccesso,
  UploadFirmato,
} from '@wardrobe/contracts'

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

export class ErroreApi extends Error {
  constructor(
    readonly stato: number,
    readonly codice: string,
    messaggio: string,
  ) {
    super(messaggio)
  }
}

const CHIAVE_TOKEN = 'wardrobe.token'

let tokenCorrente: string | null = null

/**
 * Il token del login. Lo imposta la schermata `accedi`, e resta anche dopo
 * che l'app si riavvia — salvato nel portachiavi del sistema, non solo in
 * memoria. Sul web `expo-secure-store` non ha un'implementazione (il modulo
 * nativo non esiste): la sessione lì non sopravvive a un refresh, che per
 * l'uso da telefono di questa beta non è il caso che conta.
 */
export function impostaToken(token: string | null): void {
  tokenCorrente = token
  if (Platform.OS === 'web') return
  if (token) {
    SecureStore.setItemAsync(CHIAVE_TOKEN, token).catch(() => undefined)
  } else {
    SecureStore.deleteItemAsync(CHIAVE_TOKEN).catch(() => undefined)
  }
}

/** Da chiamare una volta all'avvio dell'app: rimette in memoria il token
 * dell'ultima sessione, se c'è. */
export async function caricaTokenSalvato(): Promise<string | null> {
  if (Platform.OS === 'web') return null
  const token = await SecureStore.getItemAsync(CHIAVE_TOKEN).catch(() => null)
  tokenCorrente = token
  return token
}

/**
 * Chiamata da `SessioneProvider` quando un 401 arriva da qualunque richiesta:
 * un token scaduto (dura 30 giorni, nessun refresh) o revocato deve riportare
 * al login da dove si trova l'utente, non restare a mostrare per sempre
 * «non riesco a raggiungere il server» per un problema che è invece «devi
 * rientrare». Un modulo qui non deve importare `sessione.tsx` (dipenderebbe
 * da React): la notifica passa da questa singola callback registrata.
 */
let alTokenNonValido: (() => void) | null = null

export function suTokenNonValido(gestore: (() => void) | null): void {
  alTokenNonValido = gestore
}

async function chiama<T>(
  percorso: string,
  opzioni: { metodo?: string; corpo?: unknown; intestazioni?: Record<string, string> } = {},
): Promise<T> {
  if (!URL_API) {
    throw new ErroreApi(
      0,
      'api_non_configurata',
      'Non riesco a determinare l\'indirizzo dell\'API: imposta EXPO_PUBLIC_API_URL.',
    )
  }

  const risposta = await fetch(`${URL_API}${percorso}`, {
    method: opzioni.metodo ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(tokenCorrente ? { authorization: `Bearer ${tokenCorrente}` } : {}),
      ...opzioni.intestazioni,
    },
    body: opzioni.corpo === undefined ? undefined : JSON.stringify(opzioni.corpo),
  })

  if (!risposta.ok) {
    if (risposta.status === 401) alTokenNonValido?.()

    // Il backend risponde sempre con { errore, messaggio }: lo rispettiamo
    // invece di inventare un messaggio nostro.
    const dettaglio = await risposta.json().catch(() => ({}))
    throw new ErroreApi(
      risposta.status,
      String(dettaglio.errore ?? 'errore_sconosciuto'),
      String(dettaglio.messaggio ?? `L'API ha risposto ${risposta.status}`),
    )
  }

  if (risposta.status === 204) return undefined as T
  return (await risposta.json()) as T
}

export const api = {
  salute: () => chiama<{ stato: string; versione: string }>('/salute'),

  // ── accesso ──────────────────────────────────────────────────────────────
  auth: {
    accedi: (credenziali: Credenziali) =>
      chiama<TokenAccesso>('/auth/accedi', { metodo: 'POST', corpo: credenziali }),
    /** L'email deve essere nell'allowlist del server (`EMAIL_AMMESSE`):
     * senza, il backend risponde 403, allowlist vuota compresa. */
    registrati: (registrazione: Registrazione) =>
      chiama<TokenAccesso>('/auth/registrati', { metodo: 'POST', corpo: registrazione }),
  },

  // ── armadio ──────────────────────────────────────────────────────────────
  elencaCapi: (filtro?: { tipo?: string; stato?: string; testo?: string; preferiti?: boolean }) => {
    const parametri = new URLSearchParams()
    if (filtro?.tipo) parametri.set('tipo', filtro.tipo)
    if (filtro?.stato) parametri.set('stato', filtro.stato)
    if (filtro?.testo) parametri.set('testo', filtro.testo)
    if (filtro?.preferiti) parametri.set('preferiti', '1')
    const query = parametri.toString()
    return chiama<ElencoCapi>(`/capi${query ? `?${query}` : ''}`)
  },
  leggiCapo: (id: string) => chiama<Capo>(`/capi/${id}`),
  /** Un capo inserito a mano: nessuna analisi, nessuna pipeline asincrona. */
  creaCapo: (nuovo: NuovoCapoManuale) =>
    chiama<Capo>('/capi', { metodo: 'POST', corpo: nuovo }),
  aggiornaCapo: (id: string, modifica: AggiornamentoCapo) =>
    chiama<Capo>(`/capi/${id}`, { metodo: 'PATCH', corpo: modifica }),
  segnaIndossato: (id: string) => chiama<Capo>(`/capi/${id}/indossato`, { metodo: 'POST' }),
  riepilogo: () => chiama<RiepilogoArmadio>('/armadio/riepilogo'),

  // ── caricamento e analisi ────────────────────────────────────────────────
  firmaUpload: (contentType: string) =>
    chiama<UploadFirmato>('/foto/upload', { metodo: 'POST', corpo: { content_type: contentType } }),
  /**
   * La PUT va diretta all'archivio foto: la foto non passa dal nostro backend.
   *
   * Il caricamento legge `uri` con `expo-file-system`, non con `fetch(uri).arrayBuffer()`:
   * su Android quest'ultimo può restituire in silenzio un corpo 404 "File not found" al
   * posto dei byte della foto (bug noto del fetch WinterCG di Expo con gli URI `file://`
   * del selettore immagini), che finiva caricato come se fosse la foto.
   */
  caricaFoto: async (firma: UploadFirmato, uri: string) => {
    const esito = await new File(uri).upload(firma.url, {
      httpMethod: (firma.metodo as 'PUT' | 'POST' | 'PATCH' | undefined) ?? 'PUT',
      headers: firma.intestazioni ?? {},
    })
    if (esito.status < 200 || esito.status >= 300) {
      throw new ErroreApi(esito.status, 'upload_fallito', 'Caricamento della foto non riuscito')
    }
    return firma.chiave
  },
  /**
   * `scelta` viene da «Profilo → Sviluppo → Modelli in uso»; `undefined` (il
   * predefinito) lascia decidere al backend, cioè `PROVIDER_VISIONE` /
   * `MODELLO_VISIONE` nel `.env`.
   */
  avviaAnalisi: (chiaveFoto: string, scelta?: { provider?: string; modello?: string } | null) =>
    chiama<AnalisiAvviata>('/capi/analisi', {
      metodo: 'POST',
      corpo: { chiave_foto: chiaveFoto, provider: scelta?.provider, modello: scelta?.modello },
    }),
  statoAnalisi: (esecuzioneId: string) =>
    chiama<EsitoAnalisi>(`/capi/analisi/${encodeURIComponent(esecuzioneId)}`),

  // ── suggerimenti e outfit ───────────────────────────────────────────────
  suggerimenti: (richiesta: RichiestaSuggerimenti) =>
    chiama<RispostaSuggerimenti>('/suggerimenti', { metodo: 'POST', corpo: richiesta }),

  // ── chat continua ────────────────────────────────────────────────────────
  chat: {
    elenca: () => chiama<ElencoMessaggiChat>('/chat'),
    invia: (richiesta: RichiestaMessaggioChat) =>
      chiama<RispostaChat>('/chat', { metodo: 'POST', corpo: richiesta }),
  },

  elencaOutfit: () => chiama<{ outfit: Outfit[] }>('/outfit'),
  salvaOutfit: (nuovo: NuovoOutfit) => chiama<Outfit>('/outfit', { metodo: 'POST', corpo: nuovo }),

  // ── profilo ─────────────────────────────────────────────────────────────
  profilo: () => chiama<Profilo>('/profilo'),
  salvaProfilo: (profilo: Profilo) => chiama<Profilo>('/profilo', { metodo: 'PUT', corpo: profilo }),

  // ── playground, solo interno ────────────────────────────────────────────
  dev: {
    modelli: () => chiama<ModelloDisponibile[]>('/dev/modelli'),
    preset: () => chiama<PresetPrompt[]>('/dev/preset'),
    salvaPreset: (preset: PresetPrompt) =>
      chiama<PresetPrompt>('/dev/preset', { metodo: 'POST', corpo: preset }),
    contesto: () => chiama<ContestoSuggerimento>('/dev/contesto'),
    storico: () => chiama<import('@wardrobe/contracts').EsecuzionePlayground[]>('/dev/playground/storico'),
    esegui: (richiesta: RichiestaPlayground, chiaveProvider?: string) =>
      chiama<EsitoPlayground>('/dev/playground', {
        metodo: 'POST',
        corpo: richiesta,
        // Solo in sviluppo: permette di provare un provider senza aspettare
        // un riavvio del server con la chiave nell'ambiente.
        intestazioni: chiaveProvider ? { 'x-provider-key': chiaveProvider } : undefined,
      }),
    valutazioni: (run?: string) => {
      const parametri = new URLSearchParams()
      if (run) parametri.set('run', run)
      const query = parametri.toString()
      return chiama<RispostaValutazioni>(`/dev/valutazioni${query ? `?${query}` : ''}`)
    },
    immagini: (run?: string) => {
      const parametri = new URLSearchParams()
      if (run) parametri.set('run', run)
      const query = parametri.toString()
      return chiama<RispostaValutazioniImmagini>(`/dev/immagini${query ? `?${query}` : ''}`)
    },
    votaImmagine: (richiesta: RichiestaRatingImmagine) =>
      chiama<import('@wardrobe/contracts').ValutazioneImmagine>('/dev/immagini', {
        metodo: 'POST',
        corpo: richiesta,
      }),
  },
}
