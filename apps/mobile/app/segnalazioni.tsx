/**
 * Le mie segnalazioni: la lista che il modulo di feedback di Sentry non
 * mostra a chi segnala — solo a chi ha accesso al progetto, oggi una persona
 * sola. Qui invece ognuno vede quello che ha scritto da «Segnala un
 * problema» (Profilo), e a che punto è.
 *
 * Chi è nell'allowlist EMAIL_AMMINISTRATORI del backend vede le segnalazioni
 * di tutti — non solo le proprie — e può cambiarne lo stato con le pillole
 * sotto ogni scheda: senza, lo stato resterebbe fermo su «Ricevuta» per
 * sempre, perché nessuno avrebbe un modo di cambiarlo.
 */

import type { Segnalazione, StatoSegnalazione } from '@wardrobe/contracts'
import { useState } from 'react'
import { View } from 'react-native'
import { api } from '../src/dati/api'
import { formattaData } from '../src/dati/formato'
import { useRisorsa } from '../src/dati/risorsa'
import { colori, linee, raggi, spazi } from '../src/tema/tokens'
import { Badge, Pillola } from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { StatoRisorsa } from '../src/ui/stati'
import { Corpo } from '../src/ui/testo'

const STILE_STATO: Record<StatoSegnalazione, { sfondo: string; testo: string; etichetta: string }> = {
  ricevuta: { sfondo: linee.tenue, testo: colori.inchiostro, etichetta: 'Ricevuta' },
  in_lavorazione: { sfondo: colori.coralloTenue, testo: colori.corallo, etichetta: 'In lavorazione' },
  risolta: { sfondo: colori.inchiostro, testo: colori.crema, etichetta: 'Risolta' },
}

const STATI: StatoSegnalazione[] = ['ricevuta', 'in_lavorazione', 'risolta']

export default function Segnalazioni() {
  const { dati, caricamento, errore, ricarica } = useRisorsa(() => api.segnalazioni.elenca())
  const [locali, setLocali] = useState<Segnalazione[] | null>(null)

  const segnalazioni = locali ?? dati?.segnalazioni ?? []
  const amministratore = dati?.amministratore ?? false

  async function cambiaStato(id: string, stato: StatoSegnalazione) {
    // Ottimista: la lista è corta e il tocco deve sembrare immediato. Se il
    // backend rifiuta la modifica, `ricarica()` la riporta allo stato vero.
    setLocali(segnalazioni.map((s) => (s.id === id ? { ...s, stato } : s)))
    try {
      await api.segnalazioni.aggiorna(id, { stato })
    } catch {
      setLocali(null)
      void ricarica()
    }
  }

  return (
    <Schermata occhiello={amministratore ? 'Tutte' : 'Le tue'} titolo="Segnalazioni" indietro contentStyle={{ gap: spazi.m }}>
      <StatoRisorsa
        caricamento={caricamento}
        errore={Boolean(errore)}
        vuoto={segnalazioni.length === 0}
        titoloErrore="Non riesco a leggerle"
        titoloVuoto="Ancora nessuna segnalazione"
        spiegazioneVuoto={'Quello che scrivi da «Segnala un problema», nel Profilo, finisce qui — con lo stato di chi lo lavora.'}
      >
        {segnalazioni.map((segnalazione) => {
          const stile = STILE_STATO[segnalazione.stato ?? 'ricevuta']
          return (
            <View
              key={segnalazione.id}
              style={{
                padding: spazi.l,
                borderRadius: raggi.medioAlto,
                backgroundColor: colori.scheda,
                borderWidth: 1,
                borderColor: linee.media,
                gap: spazi.s,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
                <Badge testo={stile.etichetta} sfondo={stile.sfondo} colore={stile.testo} />
                <Corpo taglia={11.5} tono="tenue" style={{ flex: 1, textAlign: 'right' }}>
                  {formattaData(segnalazione.creata_il)}
                </Corpo>
              </View>

              <Corpo taglia={14}>{segnalazione.testo}</Corpo>

              {amministratore ? (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: spazi.xs }}>
                  {STATI.map((stato) => (
                    <Pillola
                      key={stato}
                      testo={STILE_STATO[stato].etichetta}
                      attiva={stato === (segnalazione.stato ?? 'ricevuta')}
                      onPress={() => void cambiaStato(segnalazione.id, stato)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </StatoRisorsa>
    </Schermata>
  )
}
