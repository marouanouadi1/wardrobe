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
import { Alert } from 'react-native'
import { api, messaggioDiErrore } from '../src/dati/api'
import { conta, giornoRelativo } from '../src/dati/formato'
import { useRisorsa } from '../src/dati/risorsa'
import { spazi } from '../src/tema/tokens'
import { Schermata } from '../src/ui/guscio'
import { RigaNavigabile } from '../src/ui/righe'
import { StatoRisorsa } from '../src/ui/stati'

export default function Chat() {
  const { dati, caricamento, errore, ricarica } = useRisorsa(() => api.chat.conversazioni())
  const conversazioni = dati?.conversazioni ?? []

  function chiediDiEliminare(id: string, titolo: string) {
    Alert.alert(titolo, 'La conversazione e i suoi messaggi vengono eliminati.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => {
          api.chat
            .elimina(id)
            .then(() => ricarica())
            .catch((err: unknown) => Alert.alert('Non riesco a eliminarla', messaggioDiErrore(err, '')))
        },
      },
    ])
  }

  return (
    <Schermata occhiello="Il tuo stilista" titolo="Le tue chat" indietro contentStyle={{ gap: spazi.s }}>
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
            onPressaLungo={() => chiediDiEliminare(voce.conversazione.id, voce.conversazione.titolo)}
          />
        ))}
      </StatoRisorsa>
    </Schermata>
  )
}
