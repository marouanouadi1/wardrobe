/**
 * Lo stato della chat con lo stilista: quale conversazione è aperta, i suoi
 * messaggi, e l'invio con eco immediato — il messaggio dell'utente appare
 * subito, non solo dopo che il modello ha risposto (era il difetto: vedi
 * `suggeritore.tsx`).
 *
 * `SceltaConversazione` è un'unione discriminata apposta, non un `id`
 * opzionale: `null` vorrebbe dire due cose incompatibili — «non specificata,
 * carica l'ultima» e «l'utente ha premuto Nuova, non caricare niente» — e
 * l'effetto di caricamento ripescherebbe l'ultima conversazione proprio nel
 * momento in cui l'utente ne vuole una vuota.
 */

import type { ConversazioneChat, MessaggioChat } from '@wardrobe/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, messaggioDiErrore } from './api'

/**
 * Chi chiama `useChat` deve tenere `scelta` in `useState`, non passare un
 * letterale inline: l'effetto di caricamento dipende dall'identità
 * dell'oggetto, non da un suo campo appiattito in stringa — è quello che
 * distingue due tocchi separati su «Nuova» (due letterali `{ tipo: 'nuova' }`
 * diversi, l'effetto deve ripartire) da un rerender qualunque (lo stesso
 * oggetto tenuto in stato, l'effetto non deve ripartire). Un letterale nuovo
 * a ogni render farebbe ripartire l'effetto a ogni render.
 */
export type SceltaConversazione = { tipo: 'ultima' } | { tipo: 'nuova' } | { tipo: 'id'; id: string }

interface StatoChat {
  messaggi: MessaggioChat[]
  conversazione: ConversazioneChat | null
  caricamento: boolean
  inAttesa: boolean
  bozza: string
  setBozza: (testo: string) => void
  /** Senza argomento invia `bozza`; con un testo esplicito (uno spunto
   * toccato, non digitato) invia quello — in entrambi i casi svuota il campo. */
  invia: (testoForzato?: string) => Promise<void>
}

let contatoreLocale = 0

export function useChat(scelta: SceltaConversazione, avvisa: (testo: string | null) => void): StatoChat {
  const [messaggi, setMessaggi] = useState<MessaggioChat[]>([])
  const [conversazione, setConversazione] = useState<ConversazioneChat | null>(null)
  const [caricamento, setCaricamento] = useState(scelta.tipo !== 'nuova')
  const [inAttesa, setInAttesa] = useState(false)
  const [bozza, setBozza] = useState('')

  // La conversazione può nascere durante la sessione — il primo messaggio di
  // «nuova» — e `invia` la deve rivedere subito, non al prossimo render:
  // un ref, non solo lo state, evita che due tocchi ravvicinati vedano
  // ancora `null` e aprano due conversazioni invece di continuarne una.
  const conversazioneRef = useRef<ConversazioneChat | null>(null)

  useEffect(() => {
    let attivo = true
    // Il `setTimeout` sposta ogni `setState` fuori dal corpo sincrono
    // dell'effetto — stessa regola di `src/dati/risorsa.ts`, e vale anche per
    // il ramo «nuova»: nessuna `setState` diretta qui dentro.
    const id = setTimeout(() => {
      if (!attivo) return
      if (scelta.tipo === 'nuova') {
        setMessaggi([])
        setConversazione(null)
        conversazioneRef.current = null
        setCaricamento(false)
        return
      }

      setCaricamento(true)
      const richiesta = scelta.tipo === 'ultima' ? api.chat.elenca() : api.chat.messaggi(scelta.id)
      void richiesta
        .then((risposta) => {
          if (!attivo) return
          setMessaggi(risposta.messaggi)
          const trovata = risposta.conversazione ?? null
          setConversazione(trovata)
          conversazioneRef.current = trovata
        })
        .catch((errore) => {
          if (!attivo) return
          avvisa(messaggioDiErrore(errore, 'Non riesco a leggere la chat.'))
        })
        .finally(() => {
          if (attivo) setCaricamento(false)
        })
    }, 0)

    return () => {
      attivo = false
      clearTimeout(id)
    }
    // La dipendenza è `scelta` per intero, non un suo campo appiattito in
    // stringa: due tocchi su «Nuova» passano due oggetti `{ tipo: 'nuova' }`
    // distinti (un nuovo letterale ogni volta, da `suggeritore.tsx`), e solo
    // l'identità dell'oggetto li distingue — una chiave tipo `scelta.tipo`
    // sarebbe rimasta `'nuova'` la seconda volta, e l'effetto non sarebbe
    // ripartito: il secondo tocco avrebbe continuato la conversazione appena
    // creata dal primo invece di aprirne una vuota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scelta])

  const invia = useCallback(
    async (testoForzato?: string) => {
      const testo = (testoForzato ?? bozza).trim()
      if (!testo || inAttesa) return

      const idLocale = `bozza-${(contatoreLocale += 1)}`
      const temporaneo: MessaggioChat = {
        id: idLocale,
        ruolo: 'utente',
        testo,
        suggerimenti: [],
        creato_il: new Date().toISOString(),
      }
      // Svuotare la bozza qui, non dopo l'attesa, è ciò che fa apparire il
      // messaggio subito: la conferma che il testo è partito. Se l'invio
      // fallisce (sotto) il testo torna nel campo — non è perso.
      setBozza('')
      setMessaggi((precedenti) => [...precedenti, temporaneo])
      setInAttesa(true)
      try {
        const risposta = await api.chat.invia({
          testo,
          conversazione_id: conversazioneRef.current?.id,
        })
        setConversazione(risposta.conversazione)
        conversazioneRef.current = risposta.conversazione
        setMessaggi((precedenti) => [
          ...precedenti.filter((messaggio) => messaggio.id !== idLocale),
          risposta.utente,
          risposta.wardrobe,
        ])
      } catch (errore) {
        // Il temporaneo non va mai in cache: un invio fallito non deve
        // lasciare un turno fantasma che ricompare al prossimo avvio.
        setMessaggi((precedenti) => precedenti.filter((messaggio) => messaggio.id !== idLocale))
        setBozza(testo)
        avvisa(messaggioDiErrore(errore, 'Il messaggio non è arrivato allo stilista'))
      } finally {
        setInAttesa(false)
      }
    },
    [bozza, inAttesa, avvisa],
  )

  return { messaggi, conversazione, caricamento, inAttesa, bozza, setBozza, invia }
}
