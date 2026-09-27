/**
 * Supabase, visto dall'app: l'unico modulo che conosce `@supabase/supabase-js`.
 *
 * Dal passaggio (ADR 0010) l'app legge e scrive da sé capi, outfit, profilo,
 * chat e segnalazioni, e carica le foto nello Storage. Quello che può vedere
 * lo decide l'RLS del database con il token della sessione, non questo file:
 * un filtro dimenticato qui non mostrerebbe i dati di un altro, li
 * troverebbe vuoti.
 *
 * Le schermate non importano il client: chiamano queste funzioni, e ricevono i
 * modelli di `@wardrobe/contracts` (`Capo`, `Profilo`…), come quando parlavano
 * con il backend. Le traduzioni fra righe e modelli stanno in `righe.ts`. Chiamate
 * supabase-js sparse nelle schermate sarebbero la «terza strada» che
 * `.claude/rules/react-native.md` vieta.
 *
 * Il backend dell'IA resta dietro `api.ts`: analisi, suggerimenti, chat ed
 * esportazione. Anche lui agisce come l'utente, con il token che gli dà
 * `tokenDiAccesso()` qui sotto.
 */

import { type AuthError, type PostgrestError, createClient } from '@supabase/supabase-js'
import type { Capo, Database, Outfit, OrigineOutfit, Profilo, Segnalazione, StatoSegnalazione, Tables, Vestizione } from '@wardrobe/contracts'
import Constants from 'expo-constants'
import { File } from 'expo-file-system'
import { Platform } from 'react-native'
import { ErroreDati } from './errori'
import { archiviazioneSessione } from './sessione-archivio'
import {
  type Firme,
  type ModificaCapo,
  aggiornamentoDiCapo,
  aggiornamentoDiProfilo,
  capoDaRiga,
  conFirme,
  conversazioneDaRiga,
  correzioneDiCapo,
  giornoLocale,
  messaggioDaRiga,
  outfitDaRiga,
  percorsiDaFirmare,
  percorsoNuovaFoto,
  profiloDaRiga,
  rigaDiNuovoOutfit,
  segnalazioneDaRiga,
} from './righe'

/** La porta dello stack locale della CLI (`npm run supabase:start`). */
const PORTA_SUPABASE_LOCALE = '54321'

/**
 * In sviluppo l'indirizzo si ricava come quello dell'API (`api.ts`): lo stesso
 * host da cui il telefono ha già scaricato il bundle, sulla porta dello stack
 * locale. Un build EAS lo riceve da `EXPO_PUBLIC_SUPABASE_URL`.
 */
function rilevaUrlSviluppo(): string | null {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null
    return `http://${window.location.hostname}:${PORTA_SUPABASE_LOCALE}`
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0]
  return host ? `http://${host}:${PORTA_SUPABASE_LOCALE}` : null
}

const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL ?? rilevaUrlSviluppo()
/** Pubblica per costruzione: identifica il progetto, non l'utente. */
const CHIAVE_PUBBLICA = process.env.EXPO_PUBLIC_SUPABASE_CHIAVE_PUBBLICA ?? ''

/** Le foto dei capi e dell'avatar, e gli zip di «Scarica i tuoi dati». */
const BUCKET_FOTO = 'foto'

/**
 * Quanto vale un indirizzo firmato di una foto. Un giorno: l'armadio si
 * rifirma a ogni caricamento, e un'app lasciata aperta una notte non deve
 * mostrare riquadri vuoti. Un indirizzo firmato vale come una chiave, per
 * quella foto sola: non si scrive nei log e non si esporta.
 */
const DURATA_FIRMA_S = 60 * 60 * 24

if (!URL_SUPABASE || !CHIAVE_PUBBLICA) {
  // Senza, ogni richiesta finisce su un indirizzo che non esiste e l'app dice
  // «non riesco a raggiungere il server»: qui si dice perché.
  console.error('Supabase non configurato: servono EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_CHIAVE_PUBBLICA.')
}

const client = createClient<Database>(URL_SUPABASE ?? 'http://supabase.non.configurato', CHIAVE_PUBBLICA || 'mancante', {
  auth: {
    storage: archiviazioneSessione,
    autoRefreshToken: true,
    persistSession: true,
    // In un'app non c'è una barra degli indirizzi da cui leggere la sessione:
    // i codici delle email si scrivono a mano (`verifyOtp`), niente link.
    detectSessionInUrl: false,
  },
})

export type { Session } from '@supabase/supabase-js'

/** Il client per `sessione.tsx` e `accesso.ts`, che stanno in questa stessa cartella. Le schermate no. */
export const clientAuth = client.auth

// ── errori ──────────────────────────────────────────────────────────────────

/**
 * Un errore di Supabase diventa un `ErroreDati` con un testo per chi usa
 * l'app. Il testo di Supabase è inglese e tecnico, e va nei log; la schermata
 * discrimina sul codice, mai sul messaggio.
 */
function errore(cosa: string, problema: PostgrestError | AuthError | Error | null): ErroreDati {
  const codice = (problema && 'code' in problema && problema.code) || 'errore_sconosciuto'
  console.warn(`Supabase: ${cosa} non riuscita (${codice})`, problema?.message)
  if (codice === '42501' || codice === 'PGRST301') {
    return new ErroreDati(String(codice), 'Non hai il permesso di farlo, o la sessione è scaduta.')
  }
  if (problema instanceof TypeError || /network|fetch/i.test(problema?.message ?? '')) {
    return new ErroreDati('rete', 'Non riesco a raggiungere il server.')
  }
  return new ErroreDati(String(codice), `Non sono riuscito a completare: ${cosa}.`)
}

/** Il `{ data, error }` di supabase-js, come un valore o un'eccezione. */
function valore<T>(cosa: string, risposta: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (risposta.error) throw errore(cosa, risposta.error)
  if (risposta.data === null || risposta.data === undefined) {
    throw new ErroreDati('vuoto', `Non ho trovato niente: ${cosa}.`)
  }
  return risposta.data as NonNullable<T>
}

async function utenteId(): Promise<string> {
  const { data } = await client.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ErroreDati('non_autenticato', 'Devi rientrare.')
  return id
}

// ── sessione, per il backend dell'IA ────────────────────────────────────────

/** Il token con cui il backend agisce come l'utente. `getSession` lo rinnova da sé se è scaduto. */
export async function tokenDiAccesso(): Promise<string | null> {
  const { data } = await client.auth.getSession()
  return data.session?.access_token ?? null
}

/** Un rinnovo esplicito: il backend risponde 401 a un token che scade prima di un lavoro lungo. */
export async function rinnovaSessione(): Promise<string | null> {
  const { data, error } = await client.auth.refreshSession()
  if (error) return null
  return data.session?.access_token ?? null
}

// ── foto ────────────────────────────────────────────────────────────────────

/** Firma in blocco: una richiesta per tutto l'armadio, non una per foto. */
async function firma(percorsi: string[]): Promise<Firme> {
  const unici = [...new Set(percorsi)]
  if (unici.length === 0) return new Map()
  const { data, error } = await client.storage.from(BUCKET_FOTO).createSignedUrls(unici, DURATA_FIRMA_S)
  if (error || !data) {
    // Senza firme l'armadio si vede lo stesso, con le foto vuote: meglio che
    // un armadio che non si apre per una foto sola.
    console.warn('Supabase: firma delle foto non riuscita', error?.message)
    return new Map()
  }
  return new Map(
    data.flatMap((voce) => (voce.path && voce.signedUrl ? [[voce.path, voce.signedUrl] as const] : [])),
  )
}

/** Un capo con gli indirizzi delle sue foto: quello che arriva dall'analisi nasce senza. */
export async function firmaCapo(capo: Capo): Promise<Capo> {
  return conFirme(capo, await firma(percorsiDaFirmare(capo)))
}

/**
 * Carica una foto nella cartella dell'utente e restituisce il suo percorso.
 *
 * Passa da `expo-file-system`, non da `fetch(uri)`: su Android quest'ultimo può
 * restituire in silenzio un corpo «File not found» al posto dei byte della
 * foto (il fetch WinterCG di Expo con gli URI `file://` del selettore), che
 * finirebbe caricato come se fosse la foto. `File.upload` manda i byte grezzi in
 * POST, che è esattamente quello che vuole l'endpoint dello Storage.
 */
export async function caricaFoto(uri: string, cosa: 'capi' | 'avatar'): Promise<string> {
  const { data } = await client.auth.getSession()
  const sessione = data.session
  if (!sessione || !URL_SUPABASE) throw new ErroreDati('non_autenticato', 'Devi rientrare.')
  const percorso = percorsoNuovaFoto(sessione.user.id, cosa, idCasuale())
  const esito = await new File(uri).upload(
    `${URL_SUPABASE}/storage/v1/object/${BUCKET_FOTO}/${percorso}`,
    {
      httpMethod: 'POST',
      headers: {
        apikey: CHIAVE_PUBBLICA,
        authorization: `Bearer ${sessione.access_token}`,
        'content-type': 'image/jpeg',
      },
    },
  )
  if (esito.status < 200 || esito.status >= 300) {
    console.warn('Supabase: caricamento della foto non riuscito', esito.status, esito.body.slice(0, 200))
    throw new ErroreDati('upload_fallito', 'Caricamento della foto non riuscito.')
  }
  return percorso
}

function idCasuale(): string {
  // `crypto.randomUUID` c'è in Hermes e nei browser; il ripiego serve ai test.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return c?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ── capi ────────────────────────────────────────────────────────────────────

export async function elencaCapi(): Promise<Capo[]> {
  const righe = valore(
    'la lettura dell’armadio',
    await client.from('capi').select('*').order('creato_il', { ascending: false }),
  )
  const firme = await firma(righe.flatMap((riga) => [riga.foto_percorso, riga.foto_scontornata_percorso ?? '']).filter(Boolean))
  return righe.map((riga) => capoDaRiga(riga, firme))
}

/** Le firme che un capo ha già: una modifica non cambia le foto, e non serve rifirmarle. */
function firmeDi(capo: Capo): Firme {
  const firme = new Map<string, string>()
  if (capo.foto.url) firme.set(capo.foto.chiave, capo.foto.url)
  if (capo.foto.chiave_scontornata && capo.foto.url_scontornata) {
    firme.set(capo.foto.chiave_scontornata, capo.foto.url_scontornata)
  }
  return firme
}

async function aggiornaRiga(capo: Capo, aggiornamento: Database['public']['Tables']['capi']['Update']): Promise<Capo> {
  const riga = valore(
    'la modifica del capo',
    await client.from('capi').update(aggiornamento).eq('id', capo.id).select().single(),
  )
  return capoDaRiga(riga, firmeDi(capo))
}

export function aggiornaCapo(capo: Capo, modifica: ModificaCapo): Promise<Capo> {
  return aggiornaRiga(capo, aggiornamentoDiCapo(modifica))
}

/** Correggere o confermare un attributo letto dal modello: vedi `correzioneDiCapo`. */
export function correggiCapo(
  capo: Capo,
  attributo: Parameters<typeof correzioneDiCapo>[1],
  modifica: ModificaCapo,
): Promise<Capo> {
  return aggiornaRiga(capo, correzioneDiCapo(capo, attributo, modifica))
}

/** «L'ho messo oggi»: ultimo uso, conteggio, stato e diario in una transazione (`segna_indossato`). */
export async function segnaIndossato(capo: Capo): Promise<Capo> {
  const riga = valore(
    'il segno «indossato»',
    await client.rpc('segna_indossato', { capo: capo.id, giorno: giornoLocale() }).single(),
  )
  return capoDaRiga(riga, firmeDi(capo))
}

// ── outfit ──────────────────────────────────────────────────────────────────

export async function elencaOutfit(): Promise<Outfit[]> {
  const righe = valore(
    'la lettura degli outfit',
    await client.from('outfit').select('*').order('creato_il', { ascending: false }),
  )
  return righe.map(outfitDaRiga)
}

export async function salvaOutfit(nuovo: {
  nome: string
  vestizione: Vestizione
  occasione?: string | null
  origine?: OrigineOutfit
}): Promise<Outfit> {
  const riga = valore(
    'il salvataggio dell’outfit',
    await client.from('outfit').insert(rigaDiNuovoOutfit(nuovo)).select().single(),
  )
  return outfitDaRiga(riga)
}

// ── profilo ─────────────────────────────────────────────────────────────────

/** Il profilo nasce con l'account (un trigger, `crea_profilo`): `null` solo se qualcosa è andato storto. */
export async function leggiProfilo(): Promise<Profilo | null> {
  const { data, error } = await client.from('profili').select('*').maybeSingle()
  if (error) throw errore('la lettura del profilo', error)
  return data ? profiloDaRiga(data) : null
}

export async function salvaProfilo(profilo: Profilo): Promise<Profilo> {
  const riga = valore(
    'il salvataggio del profilo',
    await client.from('profili').update(aggiornamentoDiProfilo(profilo)).eq('id', await utenteId()).select().single(),
  )
  return profiloDaRiga(riga)
}

// ── chat ────────────────────────────────────────────────────────────────────

/** Una conversazione nell'elenco: la conversazione, più ciò che la vista calcola. */
export interface VoceConversazione {
  conversazione: ReturnType<typeof conversazioneDaRiga>
  turni: number
  anteprima: string
}

export async function elencaConversazioni(): Promise<VoceConversazione[]> {
  const righe = valore(
    'la lettura delle conversazioni',
    await client.from('conversazioni_elenco').select('*').order('ultimo_turno_il', { ascending: false }),
  )
  return righe.flatMap((riga) =>
    riga.id && riga.titolo && riga.creata_il && riga.ultimo_turno_il
      ? [
          {
            conversazione: conversazioneDaRiga({
              id: riga.id,
              titolo: riga.titolo,
              creata_il: riga.creata_il,
              ultimo_turno_il: riga.ultimo_turno_il,
            }),
            turni: riga.turni ?? 0,
            anteprima: riga.anteprima ?? '',
          },
        ]
      : [],
  )
}

/** Gli ultimi turni di una conversazione, in ordine cronologico. Duecento, come il backend. */
export async function messaggiDi(conversazioneId: string) {
  const righe = valore(
    'la lettura della conversazione',
    await client
      .from('messaggi_chat')
      .select('*')
      .eq('conversazione_id', conversazioneId)
      .order('creato_il', { ascending: false })
      .limit(200),
  )
  return righe.reverse().map(messaggioDaRiga)
}

async function conMessaggi(riga: Tables<'conversazioni_chat'> | undefined | null) {
  if (!riga) return { conversazione: null, messaggi: [] }
  return { conversazione: conversazioneDaRiga(riga), messaggi: await messaggiDi(riga.id) }
}

/** L'ultima conversazione con i suoi messaggi, o niente se non ce n'è ancora una. */
export async function ultimaConversazione() {
  const righe = valore(
    'la lettura della chat',
    await client.from('conversazioni_chat').select('*').order('ultimo_turno_il', { ascending: false }).limit(1),
  )
  return conMessaggi(righe[0])
}

/** Una conversazione scelta dall'elenco, con i suoi messaggi; niente se non c'è più. */
export async function apriConversazione(conversazioneId: string) {
  const righe = valore(
    'la lettura della conversazione',
    await client.from('conversazioni_chat').select('*').eq('id', conversazioneId).limit(1),
  )
  return conMessaggi(righe[0])
}

/** I messaggi spariscono con lei (`on delete cascade`). */
export async function eliminaConversazione(conversazioneId: string): Promise<void> {
  const { error } = await client.from('conversazioni_chat').delete().eq('id', conversazioneId)
  if (error) throw errore('la cancellazione della conversazione', error)
}

// ── segnalazioni ────────────────────────────────────────────────────────────

/**
 * La copia di una segnalazione già inviata a Sentry (`dati/segnalazioni.ts`).
 * L'amministratore, che l'RLS lascia leggere tutte, le vede tutte: è la
 * schermata con cui le lavora.
 */
export async function creaSegnalazione(testo: string): Promise<Segnalazione> {
  const riga = valore(
    'la copia della segnalazione',
    await client.from('segnalazioni').insert({ testo }).select().single(),
  )
  return segnalazioneDaRiga(riga)
}

export async function elencaSegnalazioni(): Promise<Segnalazione[]> {
  const righe = valore(
    'la lettura delle segnalazioni',
    await client.from('segnalazioni').select('*').order('creata_il', { ascending: false }),
  )
  return righe.map(segnalazioneDaRiga)
}

/** Solo l'amministratore: per chiunque altro l'RLS non trova la riga, e l'errore lo dice. */
export async function aggiornaSegnalazione(id: string, stato: StatoSegnalazione): Promise<Segnalazione> {
  const riga = valore(
    'il cambio di stato della segnalazione',
    await client.from('segnalazioni').update({ stato }).eq('id', id).select().single(),
  )
  return segnalazioneDaRiga(riga)
}

// ── svuotamento ─────────────────────────────────────────────────────────────

export type ContoSvuotamento = Database['public']['Functions']['svuota_armadio']['Returns'][number] & {
  /** Le foto che lo Storage non ha tolto: si ritentano rilanciando lo svuotamento. */
  foto_rimaste: number
}

/** Tutti i file sotto una cartella dello Storage. Le cartelle, che non hanno un `id`, si attraversano. */
async function fileSotto(cartella: string): Promise<string[]> {
  const trovati: string[] = []
  for (let da = 0; ; da += 100) {
    const { data, error } = await client.storage.from(BUCKET_FOTO).list(cartella, { limit: 100, offset: da })
    if (error) throw errore('la lettura delle foto', error)
    for (const voce of data) {
      const percorso = `${cartella}/${voce.name}`
      if (voce.id === null) trovati.push(...(await fileSotto(percorso)))
      else trovati.push(percorso)
    }
    if (data.length < 100) return trovati
  }
}

/**
 * Svuota l'armadio: le righe in una transazione (`svuota_armadio`), poi le foto
 * dei capi dallo Storage, che è un altro servizio e non entra in quella
 * transazione.
 *
 * Le foto si prendono **per cartella** (`{utente}/capi/`), non dalle righe: ci
 * sono anche quelle caricate e mai diventate capo — un'analisi fallita tiene la
 * sua foto per riprovare — che nessuna riga ricorda. E l'ordine non è
 * indifferente: prima le righe e poi i file lascia al più dei file che nessuno
 * vede, mai dei capi con la foto sparita; e rilanciare lo svuotamento finisce
 * il lavoro, perché la seconda volta la funzione non trova righe e la cartella
 * si ripulisce. Resta la foto dell'avatar, perché il profilo resta
 * (`app/svuota.tsx` lo dice), e lo zip dell'esportazione: `Q-15`.
 */
export async function svuotaArmadio(): Promise<ContoSvuotamento> {
  const conto = valore(
    'lo svuotamento',
    await client.rpc('svuota_armadio', { conferma: 'SVUOTA' }).single(),
  )
  const percorsi = await fileSotto(`${await utenteId()}/capi`)
  let rimaste = 0
  for (let i = 0; i < percorsi.length; i += 100) {
    const gruppo = percorsi.slice(i, i + 100)
    const { error } = await client.storage.from(BUCKET_FOTO).remove(gruppo)
    if (error) {
      console.warn('Supabase: foto non tolte dopo lo svuotamento', error.message)
      rimaste += gruppo.length
    }
  }
  return { ...conto, foto_rimaste: rimaste }
}
