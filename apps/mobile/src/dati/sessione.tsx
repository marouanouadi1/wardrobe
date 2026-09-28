/**
 * La sessione: chi è dentro.
 *
 * Dal passaggio a Supabase (ADR 0010) non è più l'app a tenere un token: lo
 * tiene supabase-js, che lo salva (`sessione-archivio.ts`), lo rinnova prima che
 * scada e annuncia ogni cambio. Questo provider ascolta quegli annunci ed è
 * l'unica fonte di verità su «c'è qualcuno?» per tutta l'app,
 * `ArchivioProvider` compreso. Entrare, uscire, recuperare la password sono in
 * `accesso.ts`: qui si guarda il risultato.
 */

import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { esci as esciDaSupabase } from './accesso'
import { type Session, clientAuth } from './supabase'

export interface Utente {
  id: string
  email: string | null
  /**
   * Dal ruolo in `app_metadata`, che l'utente non può scriversi da sé — lo
   * stesso che legge `privato.e_amministratore()` nel database. Serve solo a
   * decidere cosa mostrare: cosa si può fare lo decide l'RLS.
   */
  amministratore: boolean
}

interface Sessione {
  utente: Utente | null
  /** `false` finché supabase-js non ha letto la sessione salvata una volta:
   * prima di allora non si può decidere se mandare l'utente al login. */
  pronto: boolean
  esci: () => Promise<void>
}

const Contesto = createContext<Sessione | null>(null)

function utenteDi(sessione: Session | null): Utente | null {
  const utente = sessione?.user
  if (!utente) return null
  return {
    id: utente.id,
    email: utente.email ?? null,
    amministratore: utente.app_metadata?.ruolo === 'amministratore',
  }
}

export function SessioneProvider({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<Utente | null>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    // Il primo annuncio (`INITIAL_SESSION`) arriva appena letta la sessione
    // salvata: è lui a dire «pronto». Dentro la callback solo `setState`: la
    // documentazione di supabase-js avverte che chiamarci dentro un'altra
    // funzione di Supabase può bloccare il client.
    const { data } = clientAuth.onAuthStateChange((_evento, sessione) => {
      setUtente((prima) => {
        const dopo = utenteDi(sessione)
        // Un rinnovo del token non cambia la persona: si tiene lo stesso
        // oggetto, così chi dipende da `utente` non riparte a ogni ora.
        return prima && dopo && prima.id === dopo.id && prima.amministratore === dopo.amministratore
          ? prima
          : dopo
      })
      setPronto(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Il rinnovo automatico gira solo con l'app in primo piano: in background
    // i timer di JavaScript non sono affidabili, e al ritorno si riparte. Solo
    // sul telefono: sul web il client segue da sé la visibilità della pagina,
    // e `startAutoRefresh` toglierebbe proprio quella.
    if (Platform.OS === 'web') return
    const iscrizione = AppState.addEventListener('change', (stato) => {
      if (stato === 'active') void clientAuth.startAutoRefresh()
      else void clientAuth.stopAutoRefresh()
    })
    return () => iscrizione.remove()
  }, [])

  return <Contesto.Provider value={{ utente, pronto, esci: esciDaSupabase }}>{children}</Contesto.Provider>
}

export function useSessione(): Sessione {
  const sessione = useContext(Contesto)
  if (!sessione) throw new Error('useSessione va usato dentro SessioneProvider')
  return sessione
}
