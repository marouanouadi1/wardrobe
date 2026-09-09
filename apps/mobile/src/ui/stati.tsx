/**
 * I tre stati di una risorsa remota: caricamento, errore, vuoto.
 *
 * Prima ognuno li riscriveva a mano — uno spinner con un `color` scelto lì
 * per lì, un `Vuoto` usato per l'errore con la stessa frase copiata in due
 * file (`segnalazioni.tsx`, `dev/valutazioni.tsx`). `StatoRisorsa` li mette
 * in un posto solo, sul modello di `useRisorsa` (`src/dati/risorsa.ts`).
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Animated, View } from 'react-native'
import { colori, curve, durate, linee, raggi, spazi } from '../tema/tokens'
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

/**
 * I messaggi di `/suggerimenti` — lo stilista, non l'analisi di una foto.
 * Tipicamente più corta (nessuno scontorno prima), da qui le soglie più
 * ravvicinate rispetto a `carica.tsx`. Condivisi da `app/(tabs)/oggi.tsx`
 * (la prima attesa) e `app/suggeritore.tsx` (la stessa chiamata, un'altra
 * schermata): stanno qui e non in un file di rotta, perché è `AttesaLunga`
 * a consumarli.
 */
export const MESSAGGI_SUGGERIMENTI = [
  { dopoMs: 0, testo: 'Guardo cosa hai pulito e cosa hai messo di recente.' },
  { dopoMs: 4000, testo: 'Sto confrontando le combinazioni migliori.' },
  { dopoMs: 10000, testo: 'Ci vuole ancora qualche secondo.' },
] as const

/**
 * Un'attesa lunga e indeterminata — l'analisi di una foto, 20-40 secondi.
 * Onesta sul fatto che non ci sono fasi osservabili da mostrare: una singola
 * chiamata al modello di visione (`services/api/src/handlers/analisi.py`
 * la esegue in linea, senza checkpoint intermedi), non cinque passi separati.
 * Una barra che scorre senza mai fermarsi, e un messaggio che avanza a
 * soglie di tempo crescenti invece di una percentuale finta.
 */
export function AttesaLunga({
  messaggi,
  su,
}: {
  /** In ordine di soglia crescente: il primo è quello iniziale (`dopoMs: 0`),
   * l'ultimo resta finché l'attesa non finisce. */
  messaggi: readonly { dopoMs: number; testo: string }[]
  su?: 'chiaro' | 'scuro'
}) {
  const [larghezza, setLarghezza] = useState(0)
  const [messaggio, setMessaggio] = useState(messaggi[0]?.testo ?? '')
  // `useState` con inizializzatore, non `useRef(...).current`: stessa scelta
  // di `PuntiniAttesa` in `ui/base.tsx`, per la stessa regola (`react-hooks/refs`).
  const [scorrimento] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (larghezza === 0) return
    const corsa = larghezza * 0.65
    const animazione = Animated.loop(
      Animated.sequence([
        Animated.timing(scorrimento, {
          toValue: corsa,
          duration: durate.corsa,
          easing: curve.respiro,
          useNativeDriver: true,
        }),
        Animated.timing(scorrimento, {
          toValue: 0,
          duration: durate.corsa,
          easing: curve.respiro,
          useNativeDriver: true,
        }),
      ]),
    )
    animazione.start()
    return () => animazione.stop()
  }, [larghezza, scorrimento])

  // Il primo messaggio lo dà già l'inizializzatore di `useState` sopra: qui
  // solo i timer per quelli successivi, mai una `setState` sincrona nel corpo
  // dell'effetto (`react-hooks/set-state-in-effect`).
  useEffect(() => {
    const timer = messaggi.slice(1).map((voce) => setTimeout(() => setMessaggio(voce.testo), voce.dopoMs))
    return () => timer.forEach(clearTimeout)
  }, [messaggi])

  return (
    <View style={{ gap: spazi.m }}>
      {/* L'`Animated.View` monta subito, non dietro `larghezza > 0`: se
          nascesse solo dopo la prima misura, comparirebbe nello stesso
          commit in cui l'effetto avvia il loop col driver nativo — e
          un'animazione avviata su una vista non ancora montata non arriva
          mai allo schermo. Finché `larghezza` non è misurata il segmento ha
          semplicemente larghezza zero, invece di dipendere da una
          percentuale che dovrebbe comunque risolversi contro il fondo. */}
      <View
        onLayout={(evento) => setLarghezza(evento.nativeEvent.layout.width)}
        style={{ height: 6, borderRadius: raggi.pillola, backgroundColor: linee.media, overflow: 'hidden' }}
      >
        <Animated.View
          style={{
            width: larghezza > 0 ? larghezza * 0.35 : 0,
            height: 6,
            borderRadius: raggi.pillola,
            backgroundColor: colori.ambra,
            transform: [{ translateX: scorrimento }],
          }}
        />
      </View>
      <Corpo taglia={13} tono="tenue" su={su} style={{ textAlign: 'center' }}>
        {messaggio}
      </Corpo>
    </View>
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
  titoloErrore = 'Non riesco a leggere',
  spiegazioneErrore = 'Controlla che il backend sia raggiungibile e riprova.',
  su,
  scheletro,
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
  /**
   * La forma da mostrare al posto dello spinner — `<ScheletroGrigliaCapi />` e
   * compagnia (`ui/scheletri.tsx`). Assente, resta lo spinner: va bene dove
   * non c'è una forma da promettere (un salvataggio, una lista di due righe),
   * e uno scheletro che indovina una forma sbagliata è peggio di uno spinner
   * onesto.
   */
  scheletro?: ReactNode
  children: ReactNode
}) {
  if (caricamento) return <>{scheletro ?? <Caricamento su={su} />}</>
  if (errore) return <Errore titolo={titoloErrore} spiegazione={spiegazioneErrore} su={su} />
  if (vuoto) return <Vuoto titolo={titoloVuoto} spiegazione={spiegazioneVuoto} su={su} />
  return <>{children}</>
}
