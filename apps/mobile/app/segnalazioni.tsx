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
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { api } from '../src/dati/api'
import { colori, raggi, spazi } from '../src/tema/tokens'
import { Pillola, Vuoto } from '../src/ui/base'
import { Corpo, Etichetta } from '../src/ui/testo'
import { Testata } from '../src/ui/testata'

const STILE_STATO: Record<StatoSegnalazione, { sfondo: string; testo: string; etichetta: string }> = {
  ricevuta: { sfondo: 'rgba(21,21,26,0.06)', testo: colori.inchiostro, etichetta: 'Ricevuta' },
  in_lavorazione: { sfondo: colori.coralloTenue, testo: colori.corallo, etichetta: 'In lavorazione' },
  risolta: { sfondo: colori.inchiostro, testo: colori.crema, etichetta: 'Risolta' },
}

const STATI: StatoSegnalazione[] = ['ricevuta', 'in_lavorazione', 'risolta']

function formattaData(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Segnalazioni() {
  const [segnalazioni, setSegnalazioni] = useState<Segnalazione[]>([])
  const [amministratore, setAmministratore] = useState(false)
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState(false)

  async function carica() {
    try {
      const elenco = await api.segnalazioni.elenca()
      setSegnalazioni(elenco.segnalazioni)
      setAmministratore(elenco.amministratore ?? false)
      setErrore(false)
    } catch {
      setErrore(true)
    } finally {
      setCaricando(false)
    }
  }

  // Un'IIFE invece di richiamare `carica` per nome: la regola react-hooks
  // sul chiamare setState in un effetto segue i riferimenti a funzioni
  // nominate, non i letterali inline — stessa scelta di `dev/valutazioni.tsx`.
  useEffect(() => {
    void (async () => {
      await carica()
    })()
  }, [])

  async function cambiaStato(id: string, stato: StatoSegnalazione) {
    // Ottimista: la lista è corta e il tocco deve sembrare immediato. Se il
    // backend rifiuta la modifica, `carica()` la riporta allo stato vero.
    setSegnalazioni((prima) => prima.map((s) => (s.id === id ? { ...s, stato } : s)))
    try {
      await api.segnalazioni.aggiorna(id, { stato })
    } catch {
      void carica()
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Testata occhiello={amministratore ? 'Tutte' : 'Le tue'} titolo="Segnalazioni" indietro />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 60, gap: spazi.m }}
        showsVerticalScrollIndicator={false}
      >
        {caricando ? (
          <ActivityIndicator color={colori.inchiostro} style={{ marginTop: spazi.xl }} />
        ) : null}

        {!caricando && errore ? (
          <Vuoto
            titolo="Non riesco a leggerle"
            spiegazione="Controlla che il backend sia raggiungibile e riprova."
          />
        ) : null}

        {!caricando && !errore && segnalazioni.length === 0 ? (
          <Vuoto
            titolo="Ancora nessuna segnalazione"
            spiegazione="Quello che scrivi da «Segnala un problema», nel Profilo, finisce qui — con lo stato di chi lo lavora."
          />
        ) : null}

        {segnalazioni.map((segnalazione) => {
          const stile = STILE_STATO[segnalazione.stato ?? 'ricevuta']
          return (
            <View
              key={segnalazione.id}
              style={{
                padding: spazi.l,
                borderRadius: raggi.medio + 4,
                backgroundColor: colori.scheda,
                borderWidth: 1,
                borderColor: 'rgba(21,21,26,0.08)',
                gap: spazi.s,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
                <View
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 5,
                    borderRadius: raggi.pillola,
                    backgroundColor: stile.sfondo,
                  }}
                >
                  <Etichetta taglia={10} colore={stile.testo}>
                    {stile.etichetta}
                  </Etichetta>
                </View>
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
                      onPress={() => cambiaStato(segnalazione.id, stato)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
