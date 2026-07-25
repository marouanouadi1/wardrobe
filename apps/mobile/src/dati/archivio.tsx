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
  Outfit,
  Profilo,
  Suggerimento,
  Vestizione,
} from '@wardrobe/contracts'
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'
import { MODALITA_DEMO, api } from './api'
import { perId, slotDiTipo } from './dominio'
import { CAPI_DEMO, OUTFIT_DEMO, PROFILO_DEMO, SUGGERIMENTI_DEMO } from './seed'

interface Stato {
  pronto: boolean
  capi: Capo[]
  outfit: Outfit[]
  profilo: Profilo | null
  suggerimenti: Suggerimento[]
  /** Cosa indossa l'avatar in questo momento. Vive solo sul telefono. */
  vestizione: Vestizione
  avviso: string | null
}

type Azione =
  | { tipo: 'caricato'; capi: Capo[]; outfit: Outfit[]; profilo: Profilo | null }
  | { tipo: 'capoAggiornato'; capo: Capo }
  | { tipo: 'outfitAggiunto'; outfit: Outfit }
  | { tipo: 'suggerimenti'; suggerimenti: Suggerimento[] }
  | { tipo: 'vestizione'; vestizione: Vestizione }
  | { tipo: 'avviso'; testo: string | null }

const INIZIALE: Stato = {
  pronto: false,
  capi: [],
  outfit: [],
  profilo: null,
  suggerimenti: [],
  vestizione: {},
  avviso: null,
}

function riduci(stato: Stato, azione: Azione): Stato {
  switch (azione.tipo) {
    case 'caricato':
      return { ...stato, pronto: true, capi: azione.capi, outfit: azione.outfit, profilo: azione.profilo }
    case 'capoAggiornato':
      return {
        ...stato,
        capi: stato.capi.map((capo) => (capo.id === azione.capo.id ? azione.capo : capo)),
      }
    case 'outfitAggiunto':
      return { ...stato, outfit: [azione.outfit, ...stato.outfit] }
    case 'suggerimenti':
      return { ...stato, suggerimenti: azione.suggerimenti }
    case 'vestizione':
      return { ...stato, vestizione: azione.vestizione }
    case 'avviso':
      return { ...stato, avviso: azione.testo }
  }
}

interface Archivio extends Stato {
  indice: Map<string, Capo>
  correggi: (capoId: string, attributo: AttributoCapo, valore: unknown) => Promise<void>
  cambiaStato: (capoId: string, stato: Capo['stato']) => Promise<void>
  cambiaPreferito: (capoId: string) => Promise<void>
  indossaOggi: (capoId: string) => Promise<void>
  vesti: (vestizione: Vestizione) => void
  vestiSlot: (capoId: string) => void
  svestiSlot: (slot: keyof Vestizione) => void
  mescola: () => void
  salvaOutfit: (nome: string, occasione?: string) => Promise<void>
  chiediSuggerimenti: (richiesta?: string) => Promise<void>
  avvisa: (testo: string | null) => void
}

const Contesto = createContext<Archivio | null>(null)

export function ArchivioProvider({ children }: { children: ReactNode }) {
  const [stato, invia] = useReducer(riduci, INIZIALE)

  useEffect(() => {
    let annullato = false

    async function carica() {
      if (MODALITA_DEMO) {
        invia({ tipo: 'caricato', capi: CAPI_DEMO, outfit: OUTFIT_DEMO, profilo: PROFILO_DEMO })
        invia({ tipo: 'suggerimenti', suggerimenti: SUGGERIMENTI_DEMO })
        invia({ tipo: 'vestizione', vestizione: SUGGERIMENTI_DEMO[0]!.vestizione })
        return
      }
      try {
        const [elenco, outfit, profilo] = await Promise.all([
          api.elencaCapi(),
          api.elencaOutfit(),
          api.profilo(),
        ])
        if (annullato) return
        invia({ tipo: 'caricato', capi: elenco.capi, outfit: outfit.outfit, profilo })
      } catch (errore) {
        if (annullato) return
        // Il fallimento non lascia l'app bianca: mostriamo l'armadio di esempio
        // e lo diciamo. Un'app vuota senza spiegazioni è il peggior esito.
        invia({ tipo: 'caricato', capi: CAPI_DEMO, outfit: OUTFIT_DEMO, profilo: PROFILO_DEMO })
        invia({
          tipo: 'avviso',
          testo: `Non riesco a raggiungere il server: sto mostrando l'armadio di esempio. (${
            errore instanceof Error ? errore.message : 'errore sconosciuto'
          })`,
        })
      }
    }

    void carica()
    return () => {
      annullato = true
    }
  }, [])

  const indice = useMemo(() => perId(stato.capi), [stato.capi])

  const applica = useCallback(
    async (capo: Capo, modifica: () => Promise<Capo>) => {
      // Ottimistico: prima l'interfaccia, poi la rete.
      invia({ tipo: 'capoAggiornato', capo })
      if (MODALITA_DEMO) return
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
    async (nome, occasione) => {
      const nuovo = { nome, occasione, vestizione: stato.vestizione, origine: 'manuale' as const }
      if (MODALITA_DEMO) {
        invia({
          tipo: 'outfitAggiunto',
          outfit: {
            ...nuovo,
            id: `locale-${Date.now()}`,
            occasione: occasione ?? null,
            volte_indossato: 0,
            ultimo_uso: null,
            creato_il: new Date().toISOString(),
          },
        })
        return
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
    if (MODALITA_DEMO) {
      invia({ tipo: 'suggerimenti', suggerimenti: SUGGERIMENTI_DEMO })
      return
    }
    try {
      const risposta = await api.suggerimenti({ richiesta_utente: richiesta, numero_proposte: 3 })
      invia({ tipo: 'suggerimenti', suggerimenti: risposta.suggerimenti })
    } catch (errore) {
      invia({
        tipo: 'avviso',
        testo: errore instanceof Error ? errore.message : 'Nessun suggerimento disponibile',
      })
    }
  }, [])

  const avvisa = useCallback((testo: string | null) => invia({ tipo: 'avviso', testo }), [])

  const valore = useMemo<Archivio>(
    () => ({
      ...stato,
      indice,
      correggi,
      cambiaStato,
      cambiaPreferito,
      indossaOggi,
      vesti,
      vestiSlot,
      svestiSlot,
      mescola,
      salvaOutfit,
      chiediSuggerimenti,
      avvisa,
    }),
    [
      stato,
      indice,
      correggi,
      cambiaStato,
      cambiaPreferito,
      indossaOggi,
      vesti,
      vestiSlot,
      svestiSlot,
      mescola,
      salvaOutfit,
      chiediSuggerimenti,
      avvisa,
    ],
  )

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useArmadio(): Archivio {
  const archivio = useContext(Contesto)
  if (!archivio) throw new Error('useArmadio va usato dentro ArchivioProvider')
  return archivio
}
