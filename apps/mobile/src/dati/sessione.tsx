/**
 * La sessione: chi è dentro, e come si entra/esce.
 *
 * Prima non esisteva: il login era attivo solo con un build EAS
 * (`EXPO_PUBLIC_API_URL` impostata), e in sviluppo l'app entrava con un
 * token finto (`'sviluppo-locale'`). Ora il backend non ha più un bypass —
 * serve sempre un JWT valido — e questo provider è l'unica fonte di verità
 * su token/stato di accesso per tutta l'app, `ArchivioProvider` compreso.
 */

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react'
import { caricaTokenSalvato, impostaToken, suTokenNonValido } from './api'

interface Sessione {
  token: string | null
  /** `false` finché non abbiamo ancora letto il portachiavi una volta: prima
   * di allora non si può decidere se mandare l'utente al login. */
  pronto: boolean
  /** Da chiamare con il token ricevuto da login o registrazione. */
  entra: (token: string) => void
  esci: () => void
}

const Contesto = createContext<Sessione | null>(null)

export function SessioneProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    caricaTokenSalvato()
      .then(setToken)
      .finally(() => setPronto(true))
  }, [])

  const entra = useCallback((nuovoToken: string) => {
    impostaToken(nuovoToken)
    setToken(nuovoToken)
  }, [])

  const esci = useCallback(() => {
    impostaToken(null)
    setToken(null)
  }, [])

  // Un 401 da qualunque richiesta (token scaduto o revocato) riporta al
  // login da solo, da qualunque schermata: senza questo, l'unico modo di
  // uscire da un token morto sarebbe disinstallare l'app.
  useEffect(() => {
    suTokenNonValido(esci)
    return () => suTokenNonValido(null)
  }, [esci])

  return <Contesto.Provider value={{ token, pronto, entra, esci }}>{children}</Contesto.Provider>
}

export function useSessione(): Sessione {
  const sessione = useContext(Contesto)
  if (!sessione) throw new Error('useSessione va usato dentro SessioneProvider')
  return sessione
}
