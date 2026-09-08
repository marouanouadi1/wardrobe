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
  NuovoCapoManuale,
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
} from 'react'
import { ErroreApi, api } from './api'
import { perId, slotDiTipo } from './dominio'
import { useSessione } from './sessione'

interface Stato {
  pronto: boolean
  capi: Capo[]
  outfit: Outfit[]
  profilo: Profilo | null
  suggerimenti: Suggerimento[]
  /** Cosa indossa l'avatar in questo momento. Vive solo sul telefono. */
  vestizione: Vestizione
  /**
   * La foto a figura intera per l'avatar 2D, come URI sul dispositivo.
   *
   * Sta qui e non dentro `profilo` perché il contratto porta solo la chiave
   * dell'archivio foto (`avatar_foto_chiave`), non un URL da mostrare:
   * finché il backend non firmerà anche la lettura, la foto visibile è
   * quella scelta sul telefono.
   */
  fotoAvatar: string | null
  avviso: string | null
}

type Azione =
  | { tipo: 'inCaricamento' }
  | { tipo: 'caricato'; capi: Capo[]; outfit: Outfit[]; profilo: Profilo | null }
  | { tipo: 'capoAggiornato'; capo: Capo }
  | { tipo: 'capoCreato'; capo: Capo }
  | { tipo: 'outfitAggiunto'; outfit: Outfit }
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
  vestizione: {},
  fotoAvatar: null,
  avviso: null,
}

function riduci(stato: Stato, azione: Azione): Stato {
  switch (azione.tipo) {
    case 'inCaricamento':
      return { ...stato, pronto: false }
    case 'caricato':
      return { ...stato, pronto: true, capi: azione.capi, outfit: azione.outfit, profilo: azione.profilo }
    case 'capoAggiornato':
      return {
        ...stato,
        capi: stato.capi.map((capo) => (capo.id === azione.capo.id ? azione.capo : capo)),
      }
    case 'capoCreato':
      return { ...stato, capi: [azione.capo, ...stato.capi] }
    case 'outfitAggiunto':
      return { ...stato, outfit: [azione.outfit, ...stato.outfit] }
    case 'suggerimenti':
      return { ...stato, suggerimenti: azione.suggerimenti }
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
  /** Un capo inserito a mano: nessuna analisi, entra subito in armadio. */
  creaCapoManuale: (nuovo: NuovoCapoManuale) => Promise<void>
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
  /** Da chiamare dopo un login riuscito: il caricamento iniziale, se non
   * c'era ancora un token, è partito vuoto di proposito. */
  ricarica: () => Promise<void>
}

const Contesto = createContext<Archivio | null>(null)

export function ArchivioProvider({ children }: { children: ReactNode }) {
  const [stato, invia] = useReducer(riduci, INIZIALE)
  const { token, pronto: sessionePronta } = useSessione()

  const carica = useCallback(async () => {
    // Senza token non c'è niente da caricare: è la schermata di accesso, che
    // l'utente sta già vedendo, non un errore di rete. Senza questo
    // controllo la richiesta partirebbe comunque senza Authorization e
    // fallirebbe con un 401 che rimanderebbe subito al login da solo — non
    // sbagliato, ma un giro a vuoto evitabile.
    if (!token) {
      invia({ tipo: 'caricato', capi: [], outfit: [], profilo: null })
      return
    }
    // `pronto` torna a `false` finché questo giro di rete non finisce: senza,
    // al login `pronto` restava `true` dal giro precedente (senza token,
    // partito subito con `capi: []`) e uno schermo con l'armadio pieno
    // mostrava per un attimo lo stato «armadio vuoto» — vedi la guardia in
    // `app/(tabs)/oggi.tsx`, che legge `pronto` per distinguere «vuoto per
    // davvero» da «ancora in caricamento».
    invia({ tipo: 'inCaricamento' })
    try {
      const [elenco, outfit, profilo] = await Promise.all([
        api.elencaCapi(),
        api.elencaOutfit(),
        api.profilo(),
      ])
      invia({ tipo: 'caricato', capi: elenco.capi, outfit: outfit.outfit, profilo })
    } catch (errore) {
      // Niente più fallback ai dati di esempio: con un backend vero un
      // errore di rete non deve mai far ricomparire l'armadio finto sopra
      // ai capi veri. Meglio un armadio vuoto con la causa in chiaro.
      invia({ tipo: 'caricato', capi: [], outfit: [], profilo: null })
      // Un 401 qui è un token scaduto: `suTokenNonValido` (vedi
      // `sessione.tsx`) sta già riportando al login, un avviso di «rete» lo
      // descriverebbe come il problema sbagliato.
      if (errore instanceof ErroreApi && errore.stato === 401) return
      invia({
        tipo: 'avviso',
        testo: `Non riesco a raggiungere il server. (${
          errore instanceof Error ? errore.message : 'errore sconosciuto'
        })`,
      })
    }
  }, [token])

  useEffect(() => {
    // Aspetta che la sessione abbia letto il portachiavi una volta: prima
    // di allora `token` è sempre `null`, e caricare partirebbe a vuoto.
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
      await applica(locale, () =>
        api.aggiornaCapo(capoId, { correzioni: { [attributo]: valore } as never }),
      )
    },
    [applica, indice],
  )

  const creaCapoManuale = useCallback<Archivio['creaCapoManuale']>(async (nuovo) => {
    // Nessun ottimismo qui: senza un id vero non c'è nulla da mostrare finché
    // il backend non risponde, a differenza di una correzione su un capo che
    // esiste già.
    const capo = await api.creaCapo(nuovo)
    invia({ tipo: 'capoCreato', capo })
  }, [])

  const registraCapo = useCallback<Archivio['registraCapo']>((capo) => {
    invia({ tipo: 'capoCreato', capo })
  }, [])

  const aggiornaEtichette = useCallback<Archivio['aggiornaEtichette']>(
    async (capoId, etichette) => {
      const capo = indice.get(capoId)
      if (!capo) return
      await applica({ ...capo, etichette }, () => api.aggiornaCapo(capoId, { etichette }))
    },
    [applica, indice],
  )

  const aggiornaAppunti = useCallback<Archivio['aggiornaAppunti']>(
    async (capoId, appunti) => {
      const capo = indice.get(capoId)
      if (!capo) return
      await applica({ ...capo, appunti }, () => api.aggiornaCapo(capoId, { appunti }))
    },
    [applica, indice],
  )

  const cambiaStato = useCallback<Archivio['cambiaStato']>(
    async (capoId, nuovo) => {
      const capo = indice.get(capoId)
      if (!capo) return
      await applica({ ...capo, stato: nuovo }, () => api.aggiornaCapo(capoId, { stato: nuovo }))
    },
    [applica, indice],
  )

  const cambiaPreferito = useCallback<Archivio['cambiaPreferito']>(
    async (capoId) => {
      const capo = indice.get(capoId)
      if (!capo) return
      const preferito = !capo.preferito
      await applica({ ...capo, preferito }, () => api.aggiornaCapo(capoId, { preferito }))
    },
    [applica, indice],
  )

  const indossaOggi = useCallback<Archivio['indossaOggi']>(
    async (capoId) => {
      const capo = indice.get(capoId)
      if (!capo) return
      const oggi = new Date().toISOString().slice(0, 10)
      await applica(
        {
          ...capo,
          ultimo_uso: oggi,
          volte_indossato: (capo.volte_indossato ?? 0) + 1,
          stato: 'da_lavare',
        },
        () => api.segnaIndossato(capoId),
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
        // Stessa strada delle foto dei capi: URL firmato e PUT diretta
        // all'archivio foto, la foto non passa dal nostro backend.
        const firma = await api.firmaUpload('image/jpeg')
        await api.caricaFoto(firma, uri)
        invia({ tipo: 'fotoAvatar', uri, chiave: firma.chiave })
        if (stato.profilo) {
          await api.salvaProfilo({ ...stato.profilo, avatar_foto_chiave: firma.chiave })
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
      try {
        invia({ tipo: 'outfitAggiunto', outfit: await api.salvaOutfit(nuovo) })
      } catch (errore) {
        invia({
          tipo: 'avviso',
          testo: errore instanceof Error ? errore.message : 'Outfit non salvato',
        })
      }
    },
    [stato.vestizione],
  )

  const chiediSuggerimenti = useCallback<Archivio['chiediSuggerimenti']>(async (richiesta) => {
    try {
      const risposta = await api.suggerimenti({
        richiesta_utente: richiesta,
        numero_proposte: 3,
      })
      invia({ tipo: 'suggerimenti', suggerimenti: risposta.suggerimenti })
      return risposta.suggerimenti
    } catch {
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
      creaCapoManuale,
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
      creaCapoManuale,
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
