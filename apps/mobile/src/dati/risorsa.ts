/**
 * Lo stato di una richiesta asincrona: caricamento, errore, ricarica. Sul
 * modello di `services/api/src/handlers/_http.py` — un solo posto che sa come
 * si racconta un fallimento, invece di un `useState` a coppie ripetuto in
 * ogni schermata (`accedi`, `registrati`, `segnalazioni`, `dev/valutazioni` lo
 * scrivevano ciascuna a modo suo, e due schermate di `src/dev/` ingoiavano
 * l'errore in un `catch {}` vuoto perché non avevano dove metterlo).
 *
 * Due forme, per due usi diversi:
 * - `useRisorsa` carica da sola al montaggio (una lista, un banco di prova);
 * - `useAzione` aspetta un tocco (un login, un salvataggio).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { messaggioDiErrore } from './api'

interface StatoRisorsa<T> {
  dati: T | null
  caricamento: boolean
  errore: string | null
  ricarica: () => Promise<void>
}

export function useRisorsa<T>(carica: () => Promise<T>, deps: readonly unknown[] = []): StatoRisorsa<T> {
  const [dati, setDati] = useState<T | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  // Un ref invece di mettere `carica` tra le dipendenze: la funzione passata è
  // quasi sempre una chiusura nuova a ogni render, e la useCallback esterna
  // duplicherebbe qui la lista di dipendenze che il chiamante già controlla
  // con `deps`. Aggiornato in un effetto proprio, mai durante il render:
  // scrivere un ref mentre si renderizza è esattamente il caso che
  // `react-hooks/refs` segnala.
  const caricaRef = useRef(carica)
  useEffect(() => {
    caricaRef.current = carica
  })

  const esegui = useCallback(async () => {
    setCaricamento(true)
    setErrore(null)
    try {
      setDati(await caricaRef.current())
    } catch (e) {
      setErrore(messaggioDiErrore(e, 'Non riesco a contattare il server.'))
    } finally {
      setCaricamento(false)
    }
  }, [])

  useEffect(() => {
    // Un `setTimeout` invece di chiamare `esegui` in linea: sposta le sue
    // `setState` fuori dal corpo sincrono dell'effetto — la stessa scelta di
    // `app/suggeritore.tsx`, per la stessa regola (`react-hooks/set-state-in-effect`).
    const id = setTimeout(() => void esegui(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { dati, caricamento, errore, ricarica: esegui }
}

interface StatoAzione<T> {
  caricamento: boolean
  errore: string | null
  pulisciErrore: () => void
  /** `mappaErrore` copre i casi come `registrati.tsx`, dove un codice
   * particolare (`email_gia_registrata`…) vuole un messaggio diverso dal
   * `.message` grezzo dell'eccezione. */
  esegui: (azione: () => Promise<T>, mappaErrore?: (errore: unknown) => string) => Promise<T | undefined>
}

export function useAzione<T = void>(): StatoAzione<T> {
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const esegui = useCallback(async (azione: () => Promise<T>, mappaErrore?: (errore: unknown) => string) => {
    setErrore(null)
    setCaricamento(true)
    try {
      return await azione()
    } catch (e) {
      setErrore(mappaErrore ? mappaErrore(e) : messaggioDiErrore(e, 'Impossibile contattare il server.'))
      return undefined
    } finally {
      setCaricamento(false)
    }
  }, [])

  return { caricamento, errore, pulisciErrore: () => setErrore(null), esegui }
}
