/**
 * Le tue chat: l'elenco delle conversazioni con lo stilista.
 *
 * Prima ce n'era una sola, continua — la decisione registrata in
 * `docs/adr/0006-lo-storico-della-chat.md`. Da qui si riapre una
 * conversazione passata (`suggeritore.tsx` la ricarica per id, vedi il
 * parametro `conversazione`) o se ne elimina una con una pressione lunga —
 * niente icona in più: il set del design non ne ha una per «elimina».
 */

import { router } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'
import { messaggioDiErrore } from '../src/dati/errori'
import { conta, giornoRelativo } from '../src/dati/formato'
import { useRisorsa } from '../src/dati/risorsa'
import { elencaConversazioni, eliminaConversazione } from '../src/dati/supabase'
import { colori, spazi, superfici } from '../src/tema/tokens'
import { BottoneTondo } from '../src/ui/base'
import { Conferma } from '../src/ui/avviso'
import { Schermata } from '../src/ui/guscio'
import { RigaNavigabile } from '../src/ui/righe'
import { StatoRisorsa } from '../src/ui/stati'

export default function Chat() {
  const { dati, caricamento, errore, ricarica } = useRisorsa(() => elencaConversazioni())
  const conversazioni = dati ?? []
  // La conferma è di questa schermata (Conferma, non Alert.alert — sul web
  // Alert.alert con più bottoni non fa nulla), l'errore di rete resta
  // sull'Alert nativo: non è la conferma di un'azione, non ha bisogno dei
  // colori del design.
  const [daEliminare, setDaEliminare] = useState<{ id: string; titolo: string } | null>(null)

  function elimina() {
    if (!daEliminare) return
    const { id } = daEliminare
    setDaEliminare(null)
    eliminaConversazione(id)
      .then(() => ricarica())
      .catch((err: unknown) => Alert.alert('Non riesco a eliminarla', messaggioDiErrore(err, '')))
  }

  return (
    <Schermata
      occhiello="Il tuo stilista"
      titolo="Le tue chat"
      indietro
      // Da qui si comincia anche una chat nuova, non solo se ne riapre una.
      azioni={
        <BottoneTondo
          nome="piu"
          onPress={() => router.push({ pathname: '/suggeritore', params: { nuova: '1' } })}
          misura={38}
          misuraIcona={18}
          sfondo={superfici.vetroAlto}
          colore={colori.inchiostro}
        />
      }
      contentStyle={{ gap: spazi.s }}
    >
      <StatoRisorsa
        caricamento={caricamento}
        errore={Boolean(errore)}
        vuoto={conversazioni.length === 0}
        titoloVuoto="Ancora nessuna chat"
        spiegazioneVuoto={'Scrivi allo stilista da «Oggi» o dalla chat: la trovi qui appena la lasci.'}
      >
        {conversazioni.map((voce) => (
          <RigaNavigabile
            key={voce.conversazione.id}
            icona="scintilla"
            titolo={voce.conversazione.titolo}
            sottotitolo={`${giornoRelativo(voce.conversazione.ultimo_turno_il)} · ${conta(voce.turni, 'messaggio', 'messaggi')}`}
            onPress={() =>
              router.push({ pathname: '/suggeritore', params: { conversazione: voce.conversazione.id } })
            }
            onPressaLungo={() => setDaEliminare({ id: voce.conversazione.id, titolo: voce.conversazione.titolo })}
          />
        ))}
      </StatoRisorsa>

      <Conferma
        visibile={daEliminare !== null}
        titolo={daEliminare?.titolo ?? ''}
        messaggio="La conversazione e i suoi messaggi vengono eliminati."
        testoConferma="Elimina"
        onConferma={elimina}
        onAnnulla={() => setDaEliminare(null)}
      />
    </Schermata>
  )
}
