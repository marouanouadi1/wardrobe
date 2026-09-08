/**
 * I tre stati di una risorsa remota: caricamento, errore, vuoto.
 *
 * Prima ognuno li riscriveva a mano — uno spinner con un `color` scelto lì
 * per lì, un `Vuoto` usato per l'errore con la stessa frase copiata in due
 * file (`segnalazioni.tsx`, `dev/valutazioni.tsx`). `StatoRisorsa` li mette
 * in un posto solo, sul modello di `useRisorsa` (`src/dati/risorsa.ts`).
 */

import type { ReactNode } from 'react'
import { ActivityIndicator } from 'react-native'
import { colori, spazi } from '../tema/tokens'
import { Scheda } from './base'
import { Corpo, Forte } from './testo'

export function Caricamento({ su }: { su?: 'chiaro' | 'scuro' }) {
  return (
    <ActivityIndicator
      color={su === 'scuro' ? colori.ambra : colori.inchiostro}
      style={{ marginTop: spazi.xl }}
    />
  )
}

export function Vuoto({
  titolo,
  spiegazione,
  su,
}: {
  titolo: string
  spiegazione: string
  su?: 'chiaro' | 'scuro'
}) {
  return (
    <Scheda su={su} imbottitura={spazi.xl} style={{ alignItems: 'center', gap: spazi.s }}>
      <Forte taglia={15} su={su}>
        {titolo}
      </Forte>
      <Corpo taglia={13} tono="tenue" su={su} style={{ textAlign: 'center' }}>
        {spiegazione}
      </Corpo>
    </Scheda>
  )
}

/** Lo stesso testo di `Vuoto`, per un errore invece che per un vuoto vero. */
export function Errore({
  titolo,
  spiegazione,
  su,
}: {
  titolo: string
  spiegazione: string
  su?: 'chiaro' | 'scuro'
}) {
  return <Vuoto titolo={titolo} spiegazione={spiegazione} su={su} />
}

/**
 * I tre stati in un posto solo: mentre `caricamento` uno spinner, se `errore`
 * una scheda con un messaggio fisso (non il testo tecnico dell'eccezione —
 * non è mai stato mostrato prima, e un errore di rete non è un contenuto per
 * l'utente), altrimenti — se `vuoto` — lo stato vuoto, altrimenti i `children`.
 */
export function StatoRisorsa({
  caricamento,
  errore,
  vuoto,
  titoloVuoto,
  spiegazioneVuoto,
  titoloErrore = 'Non riesco a leggerli',
  spiegazioneErrore = 'Controlla che il backend sia raggiungibile e riprova.',
  su,
  children,
}: {
  caricamento: boolean
  errore: boolean
  vuoto: boolean
  titoloVuoto: string
  spiegazioneVuoto: string
  titoloErrore?: string
  spiegazioneErrore?: string
  su?: 'chiaro' | 'scuro'
  children: ReactNode
}) {
  if (caricamento) return <Caricamento su={su} />
  if (errore) return <Errore titolo={titoloErrore} spiegazione={spiegazioneErrore} su={su} />
  if (vuoto) return <Vuoto titolo={titoloVuoto} spiegazione={spiegazioneVuoto} su={su} />
  return <>{children}</>
}
