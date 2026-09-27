/**
 * Lo stato dell'app: un context, un reducer, nessuna libreria.
 *
 * Un armadio è centinaia di capi, non milioni: tenerli in memoria e filtrarli
 * lì è più veloce di qualunque cache remota, e rende l'app usabile anche in
 * metropolitana. Le mutazioni sono ottimistiche — l'utente vede subito l'effetto
 * del tocco, e se la chiamata fallisce lo stato torna indietro con un avviso.
 */

import type {
  AttributoCapo,
  Capo,
  OrigineOutfit,
  Outfit,
  Profilo,
  Suggerimento,
  Vestizione,
} from '@wardrobe/contracts'
import { useRouter } from 'expo-router'
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { api } from './api'
import { capiDiVestizione, perId, slotDiTipo, slotMancanti } from './dominio'
import { caricaUnaFoto } from './foto'
import { giornoLocale } from './righe'
import { useSessione } from './sessione'
import {
  aggiornaCapo,
  correggiCapo,
  elencaCapi,
  elencaOutfit,
  leggiProfilo,
  salvaOutfit as salvaOutfitSu,
  salvaProfilo,
  segnaIndossato,
} from './supabase'

interface Stato {
  pronto: boolean
  capi: Capo[]
  outfit: Outfit[]
  profilo: Profilo | null
  suggerimenti: Suggerimento[]
  /**
   * Il modello sta componendo una proposta (`POST /suggerimenti`, una
   * chiamata LLM da secondi a decine di secondi). Senza questo flag uno
   * scheletro condizionato su `suggerimenti.length === 0` resterebbe acceso
   * per sempre a chiamata fallita — vedi il commento in `app/(tabs)/oggi.tsx`
   * su perché l'effetto lì non riparte da solo.
   */
  suggerimentiInCorso: boolean
  /**
   * Perché il caricamento iniziale (`carica()`) non è riuscito, se non è
   * riuscito. Distinto da `avviso`: quello è un coriandolo per un errore
   * transitorio, questo è lo stato persistente che una schermata legge per
   * non raccontare «l'armadio è vuoto» quando in realtà il server non ha
   * risposto — i due stati erano indistinguibili (`capi: []`, `pronto: true`
   * in entrambi i casi).
   */
  erroreCaricamento: string | null
  /** Cosa indossa l'avatar in questo momento. Vive solo sul telefono. */
  vestizione: Vestizione
  /**
   * La foto a figura intera per l'avatar 2D, come URI sul dispositivo.
   *
   * Sta qui e non dentro `profilo` perché il profilo porta solo il percorso
   * nello Storage (`avatar_foto_chiave`), non un URL da mostrare: la foto
   * visibile è quella scelta sul telefono.
   */
  fotoAvatar: string | null
  avviso: string | null
}

type Azione =
  | { tipo: 'inCaricamento'; altroUtente: boolean }
  | { tipo: 'azzerato' }
  | { tipo: 'caricato'; capi: Capo[]; outfit: Outfit[]; profilo: Profilo | null }
  | { tipo: 'erroreCaricamento'; testo: string }
  | { tipo: 'capoAggiornato'; capo: Capo }
  | { tipo: 'capoCreato'; capo: Capo }
  | { tipo: 'outfitAggiunto'; outfit: Outfit }
  | { tipo: 'suggerimentiInCorso'; inCorso: boolean }
  | { tipo: 'suggerimenti'; suggerimenti: Suggerimento[] }
  | { tipo: 'vestizione'; vestizione: Vestizione }
  | { tipo: 'fotoAvatar'; uri: string | null; chiave?: string }
  | { tipo: 'avviso'; testo: string | null }

const INIZIALE: Stato = {
  pronto: false,
  capi: [],
  outfit: [],
  profilo: null,
  suggerimenti: [],
  suggerimentiInCorso: false,
  erroreCaricamento: null,
  vestizione: {},
  fotoAvatar: null,
  avviso: null,
}

function altroUtente(stato: Stato, altro: boolean): Stato {
  return altro ? { ...INIZIALE, pronto: false } : { ...stato, pronto: false }
}

function riduci(stato: Stato, azione: Azione): Stato {
  switch (azione.tipo) {
    case 'inCaricamento':
      // Un altro utente non eredita niente di chi c'era: né le proposte — che
      // descrivono i vestiti dell'altro —, né la vestizione, né un avviso.
      return altroUtente(stato, azione.altroUtente)
    case 'azzerato':
      return { ...INIZIALE, pronto: true }
    case 'caricato':
      return {
        ...stato,
        pronto: true,
        capi: azione.capi,
        outfit: azione.outfit,
        profilo: azione.profilo,
        // Un caricamento riuscito cancella l'errore del giro precedente: è
        // lo stesso posto dove `ricarica()` deve poter tornare a uno stato
        // pulito dopo che il server torna raggiungibile.
        erroreCaricamento: null,
      }
    case 'erroreCaricamento':
      // Stesso «armadio vuoto» di sempre — niente dati finti sopra ai capi
      // veri, vedi il commento in `carica()` — ma con la causa in chiaro
      // invece che indistinguibile da un armadio davvero vuoto.
      return { ...stato, pronto: true, capi: [], outfit: [], profilo: null, erroreCaricamento: azione.testo }
    case 'capoAggiornato':
      return {
        ...stato,
        capi: stato.capi.map((capo) => (capo.id === azione.capo.id ? azione.capo : capo)),
      }
    case 'capoCreato':
      return { ...stato, capi: [azione.capo, ...stato.capi] }
    case 'outfitAggiunto':
      return { ...stato, outfit: [azione.outfit, ...stato.outfit] }
    case 'suggerimentiInCorso':
      return { ...stato, suggerimentiInCorso: azione.inCorso }
    case 'suggerimenti':
      return { ...stato, suggerimenti: azione.suggerimenti, suggerimentiInCorso: false }
    case 'vestizione':
      return { ...stato, vestizione: azione.vestizione }
    case 'fotoAvatar':
      return {
        ...stato,
        fotoAvatar: azione.uri,
        profilo:
          stato.profilo && azione.chiave
            ? { ...stato.profilo, avatar_foto_chiave: azione.chiave }
            : stato.profilo,
      }
    case 'avviso':
      return { ...stato, avviso: azione.testo }
  }
}

interface Archivio extends Stato {
  indice: Map<string, Capo>
  correggi: (capoId: string, attributo: AttributoCapo, valore: unknown) => Promise<void>
  /** Un capo già creato dal backend (es. da un'analisi completata): lo mette
   * subito in armadio, senza rifare la richiesta che l'ha prodotto. */
  registraCapo: (capo: Capo) => void
  /** `undefined` lascia il campo com'è; una lista/stringa lo sostituisce. */
  aggiornaEtichette: (capoId: string, etichette: string[]) => Promise<void>
  aggiornaAppunti: (capoId: string, appunti: string) => Promise<void>
  cambiaStato: (capoId: string, stato: Capo['stato']) => Promise<void>
  cambiaPreferito: (capoId: string) => Promise<void>
  indossaOggi: (capoId: string) => Promise<void>
  vesti: (vestizione: Vestizione) => void
  vestiSlot: (capoId: string) => void
  svestiSlot: (slot: keyof Vestizione) => void
  /** La foto a figura intera scelta dalla galleria: si vede subito, si carica dopo. */
  impostaFotoAvatar: (uri: string) => Promise<void>
  mescola: () => void
  /**
   * Salva un outfit. Senza `vestizione` salva quello che l'avatar indossa in
   * questo momento; passandola si salva una proposta dell'IA senza doverla
   * prima infilare all'avatar.
   */
  salvaOutfit: (
    nome: string,
    dettagli?: { occasione?: string; vestizione?: Vestizione; origine?: OrigineOutfit },
  ) => Promise<void>
  chiediSuggerimenti: (richiesta?: string) => Promise<Suggerimento[]>
  avvisa: (testo: string | null) => void
  /** Rilegge tutto: dopo uno svuotamento, o quando il server torna raggiungibile. */
  ricarica: () => Promise<void>
}

const Contesto = createContext<Archivio | null>(null)

export function ArchivioProvider({ children }: { children: ReactNode }) {
  const [stato, invia] = useReducer(riduci, INIZIALE)
  const { utente, pronto: sessionePronta } = useSessione()
  // L'id, non il token: il token cambia a ogni rinnovo (ogni ora), e
  // ricaricare l'armadio a ogni rinnovo sarebbe un giro di rete per niente.
  // Cambia l'utente, si ricarica.
  const utenteId = utente?.id ?? null
  // Per chi è stato caricato lo store, e quale giro è l'ultimo: un caricamento
  // di chi è appena uscito può arrivare dopo l'ingresso del prossimo, e non deve
  // finirgli davanti.
  const caricatoPer = useRef<string | null>(null)
  const giro = useRef(0)

  const carica = useCallback(async () => {
    const questo = (giro.current += 1)
    const altro = caricatoPer.current !== utenteId
    caricatoPer.current = utenteId
    // Senza una sessione non c'è niente da caricare: è la schermata di
    // accesso, che l'utente sta già vedendo, non un errore di rete.
    if (!utenteId) {
      invia({ tipo: 'azzerato' })
      return
    }
    // `pronto` torna a `false` finché questo giro di rete non finisce: senza,
    // al login `pronto` restava `true` dal giro precedente (senza sessione,
    // partito subito con `capi: []`) e uno schermo con l'armadio pieno
    // mostrava per un attimo lo stato «armadio vuoto» — vedi la guardia in
    // `app/(tabs)/oggi.tsx`, che legge `pronto` per distinguere «vuoto per
    // davvero» da «ancora in caricamento».
    invia({ tipo: 'inCaricamento', altroUtente: altro })
    try {
      const [capi, outfit, profilo] = await Promise.all([elencaCapi(), elencaOutfit(), leggiProfilo()])
      if (questo !== giro.current) return
      invia({ tipo: 'caricato', capi, outfit, profilo })
    } catch (errore) {
      if (questo !== giro.current) return
      // Niente dati di esempio: un errore di rete non deve mai far comparire
      // un armadio finto — resta un armadio vuoto, con la causa in chiaro
      // (`erroreCaricamento`), distinguibile da un armadio davvero vuoto. È
      // anche quello che si vede quando il progetto Supabase è in pausa
      // (piano Free, dopo sette giorni senza richieste): «non ti raggiungo»,
      // non «non hai niente».
      invia({
        tipo: 'erroreCaricamento',
        testo: `Non riesco a raggiungere il server. (${
          errore instanceof Error ? errore.message : 'errore sconosciuto'
        })`,
      })
    }
  }, [utenteId])

  useEffect(() => {
    // Aspetta che la sessione sia stata letta una volta: prima di allora
    // `utente` è sempre `null`, e caricare partirebbe a vuoto.
    if (!sessionePronta) return
    void carica()
  }, [sessionePronta, carica])

  const indice = useMemo(() => perId(stato.capi), [stato.capi])

  const applica = useCallback(
    async (capo: Capo, modifica: () => Promise<Capo>) => {
      // Ottimistico: prima l'interfaccia, poi la rete.
      invia({ tipo: 'capoAggiornato', capo })
      try {
        invia({ tipo: 'capoAggiornato', capo: await modifica() })
      } catch (errore) {
        invia({
          tipo: 'avviso',
          testo: errore instanceof Error ? errore.message : 'Modifica non salvata',
        })
      }
    },
    [],
  )

  const correggi = useCallback<Archivio['correggi']>(
    async (capoId, attributo, valore) => {
      const capo = indice.get(capoId)
      if (!capo) return
      const locale: Capo = {
        ...capo,
        [attributo]: valore,
        ...(attributo === 'tipo' ? { slot: slotDiTipo(valore as Capo['tipo']) } : {}),
        analisi: capo.analisi
          ? {
              ...capo.analisi,
              confidenze: { ...capo.analisi.confidenze, [attributo]: 100 },
              corretti_a_mano: [...(capo.analisi.corretti_a_mano ?? []), attributo],
            }
          : capo.analisi,
      } as Capo
      await applica(locale, () => correggiCapo(capo, attributo, { [attributo]: valore } as never))
    },
    [applica, indice],
  )

  const registraCapo = useCallback<Archivio['registraCapo']>((capo) => {
    invia({ tipo: 'capoCreato', capo })
  }, [])

  const aggiornaEtichette = useCallback<Archivio['aggiornaEtichette']>(
    async (capoId, etichette) => {
      const capo = indice.get(capoId)
      if (!capo) return
      await applica({ ...capo, etichette }, () => aggiornaCapo(capo, { etichette }))
    },
    [applica, indice],
  )

  const aggiornaAppunti = useCallback<Archivio['aggiornaAppunti']>(
    async (capoId, appunti) => {
      const capo = indice.get(capoId)
      if (!capo) return
      await applica({ ...capo, appunti }, () => aggiornaCapo(capo, { appunti }))
    },
    [applica, indice],
  )

  const cambiaStato = useCallback<Archivio['cambiaStato']>(
    async (capoId, nuovo) => {
      const capo = indice.get(capoId)
      if (!capo) return
      await applica({ ...capo, stato: nuovo }, () => aggiornaCapo(capo, { stato: nuovo }))
    },
    [applica, indice],
  )

  const cambiaPreferito = useCallback<Archivio['cambiaPreferito']>(
    async (capoId) => {
      const capo = indice.get(capoId)
      if (!capo) return
      const preferito = !capo.preferito
      await applica({ ...capo, preferito }, () => aggiornaCapo(capo, { preferito }))
    },
    [applica, indice],
  )

  const indossaOggi = useCallback<Archivio['indossaOggi']>(
    async (capoId) => {
      const capo = indice.get(capoId)
      if (!capo) return
      // Il giorno locale, come quello che scrive `segna_indossato`.
      const oggi = giornoLocale()
      await applica(
        {
          ...capo,
          ultimo_uso: oggi,
          volte_indossato: (capo.volte_indossato ?? 0) + 1,
          stato: 'da_lavare',
        },
        () => segnaIndossato(capo),
      )
    },
    [applica, indice],
  )

  const vesti = useCallback((vestizione: Vestizione) => invia({ tipo: 'vestizione', vestizione }), [])

  const vestiSlot = useCallback<Archivio['vestiSlot']>(
    (capoId) => {
      const capo = indice.get(capoId)
      if (!capo) return
      invia({
        tipo: 'vestizione',
        vestizione: { ...stato.vestizione, [capo.slot]: capoId },
      })
    },
    [indice, stato.vestizione],
  )

  const svestiSlot = useCallback<Archivio['svestiSlot']>(
    (slot) => invia({ tipo: 'vestizione', vestizione: { ...stato.vestizione, [slot]: null } }),
    [stato.vestizione],
  )

  const impostaFotoAvatar = useCallback<Archivio['impostaFotoAvatar']>(
    async (uri) => {
      invia({ tipo: 'fotoAvatar', uri })
      try {
        // Stessa strada delle foto dei capi — letteralmente la stessa
        // funzione: dritta nello Storage, nella cartella dell'utente.
        const chiave = await caricaUnaFoto(uri, 'avatar')
        invia({ tipo: 'fotoAvatar', uri, chiave })
        if (stato.profilo) {
          await salvaProfilo({ ...stato.profilo, avatar_foto_chiave: chiave })
        }
      } catch (errore) {
        invia({
          tipo: 'avviso',
          testo: `La foto si vede sul telefono ma non è stata salvata: ${
            errore instanceof Error ? errore.message : 'caricamento non riuscito'
          }`,
        })
      }
    },
    [stato.profilo],
  )

  const mescola = useCallback(() => {
    const scegli = (slot: Capo['slot']) => {
      const candidati = stato.capi.filter((capo) => capo.slot === slot && capo.stato === 'pulito')
      if (candidati.length === 0) return null
      return candidati[Math.floor(Math.random() * candidati.length)]!.id
    }
    invia({
      tipo: 'vestizione',
      vestizione: {
        top: scegli('top'),
        bottom: scegli('bottom'),
        shoes: scegli('shoes'),
        outer: Math.random() > 0.4 ? scegli('outer') : null,
      },
    })
  }, [stato.capi])

  const salvaOutfit = useCallback<Archivio['salvaOutfit']>(
    async (nome, dettagli) => {
      const nuovo = {
        nome,
        occasione: dettagli?.occasione,
        vestizione: dettagli?.vestizione ?? stato.vestizione,
        origine: dettagli?.origine ?? ('manuale' as const),
      }
      // Il database lo rifiuterebbe comunque (il vincolo `outfit_indossabile`),
      // ma con un errore che qui arriverebbe generico: il motivo lo si sa prima.
      if (slotMancanti(capiDiVestizione(nuovo.vestizione, indice)).length > 0) {
        invia({ tipo: 'avviso', testo: 'Un outfit ha bisogno di un abito, oppure di un sopra e un sotto.' })
        return
      }
      try {
        invia({ tipo: 'outfitAggiunto', outfit: await salvaOutfitSu(nuovo) })
      } catch (errore) {
        invia({
          tipo: 'avviso',
          testo: errore instanceof Error ? errore.message : 'Outfit non salvato',
        })
      }
    },
    [stato.vestizione, indice],
  )

  const chiediSuggerimenti = useCallback<Archivio['chiediSuggerimenti']>(async (richiesta) => {
    invia({ tipo: 'suggerimentiInCorso', inCorso: true })
    try {
      const risposta = await api.suggerimenti({
        richiesta_utente: richiesta,
        numero_proposte: 3,
      })
      // Il caso 'suggerimenti' del reducer spegne anche `suggerimentiInCorso`:
      // non serve un'azione separata sul ramo riuscito.
      invia({ tipo: 'suggerimenti', suggerimenti: risposta.suggerimenti })
      return risposta.suggerimenti
    } catch {
      // Va spento anche sul fallimento, o uno scheletro/spinner condizionato
      // su questo flag resterebbe acceso per sempre — `suggerimenti` non
      // cambia mai in questo ramo.
      invia({ tipo: 'suggerimentiInCorso', inCorso: false })
      // Non il testo tecnico dell'eccezione (`suggerimento_non_valido` e simili
      // sono un dettaglio di dominio, non un contenuto per l'utente — stessa
      // regola di `src/ui/stati.tsx`): una frase fissa, sempre.
      invia({ tipo: 'avviso', testo: 'Non riesco a proporti nulla adesso. Riprova tra poco.' })
      return []
    }
  }, [])

  const avvisa = useCallback((testo: string | null) => invia({ tipo: 'avviso', testo }), [])

  const valore = useMemo<Archivio>(
    () => ({
      ...stato,
      indice,
      correggi,
      registraCapo,
      aggiornaEtichette,
      aggiornaAppunti,
      cambiaStato,
      cambiaPreferito,
      indossaOggi,
      vesti,
      vestiSlot,
      svestiSlot,
      impostaFotoAvatar,
      mescola,
      salvaOutfit,
      chiediSuggerimenti,
      avvisa,
      ricarica: carica,
    }),
    [
      stato,
      indice,
      correggi,
      registraCapo,
      aggiornaEtichette,
      aggiornaAppunti,
      cambiaStato,
      cambiaPreferito,
      indossaOggi,
      vesti,
      vestiSlot,
      svestiSlot,
      impostaFotoAvatar,
      mescola,
      salvaOutfit,
      chiediSuggerimenti,
      avvisa,
      carica,
    ],
  )

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useArmadio(): Archivio {
  const archivio = useContext(Contesto)
  if (!archivio) throw new Error('useArmadio va usato dentro ArchivioProvider')
  return archivio
}

/**
 * «Vestila e vai»: infila una vestizione nell'avatar e apre la sua schermata.
 * Le sei chiamate `vesti(...) + router.push('/(tabs)/avatar')` (Oggi, il
 * suggeritore, gli outfit salvati) erano la stessa coppia di righe, sempre
 * insieme.
 */
export function useVestiEVai(): (vestizione: Vestizione) => void {
  const { vesti } = useArmadio()
  const router = useRouter()
  return useCallback(
    (vestizione: Vestizione) => {
      vesti(vestizione)
      router.push('/(tabs)/avatar')
    },
    [vesti, router],
  )
}
