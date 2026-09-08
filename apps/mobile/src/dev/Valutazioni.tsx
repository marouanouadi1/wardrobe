/**
 * La tabella di valutazione: quale modello legge i tessuti meglio, e quanto costa.
 *
 * Non è il playground (una prova alla volta, a mano): qui si leggono i
 * risultati di `scripts/valuta_modelli.py`, lo stesso banco di dieci capi
 * fotografati apposta (vedi `tests/fixtures/campioni/GUIDA.md`) fatto girare
 * contro ogni modello configurato. Resta vuota finché quello script non ha
 * girato almeno una volta — non è un errore, è uno strumento senza dati.
 *
 * Stessa ragione del fondo scuro di `playground.tsx`: qui si misura il
 * prodotto, non lo si usa.
 */

import type { RigaAggregata } from '@wardrobe/contracts'
import { VALORI_ATTRIBUTO_CAPO } from '@wardrobe/contracts'
import { View } from 'react-native'
import { api } from '../dati/api'
import { euro, parola, percentuale } from '../dati/formato'
import { useRisorsa } from '../dati/risorsa'
import { ETICHETTE, colori, raggi, spazi, testoSu } from '../tema/tokens'
import { Schermata } from '../ui/guscio'
import { RiquadroStatistica } from '../ui/righe'
import { StatoRisorsa } from '../ui/stati'
import { Corpo, Etichetta, Forte, Numero } from '../ui/testo'

export default function Valutazioni() {
  const { dati, caricamento, errore } = useRisorsa(() => api.dev.valutazioni())
  const righe = dati?.righe ?? []
  const senzaRun = !dati?.run_id || righe.length === 0

  return (
    <Schermata occhiello="Solo interno" titolo="Valutazione modelli" indietro su="scuro">
      <StatoRisorsa
        caricamento={caricamento}
        errore={Boolean(errore)}
        vuoto={senzaRun}
        su="scuro"
        titoloErrore="Non riesco a leggere il banco"
        titoloVuoto="Nessun run ancora"
        spiegazioneVuoto="Fotografa i 10 campioni (tests/fixtures/campioni/GUIDA.md), poi lancia da services/api: uv run python scripts/valuta_modelli.py --conferma"
      >
        <Etichetta taglia={11} colore={testoSu.scuro.tenue}>
          {`Run · ${dati?.run_id}`}
        </Etichetta>
        {righe.map((riga) => (
          <RigaModello key={`${riga.provider}-${riga.modello}`} riga={riga} />
        ))}
      </StatoRisorsa>
    </Schermata>
  )
}

function RigaModello({ riga }: { riga: RigaAggregata }) {
  return (
    <View
      style={{
        padding: spazi.l,
        borderRadius: raggi.scheda - 2,
        backgroundColor: 'rgba(247,244,239,0.05)',
        gap: spazi.m,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.m }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Forte taglia={15} colore={colori.crema} numberOfLines={1}>
            {riga.modello}
          </Forte>
          <Corpo taglia={11.5} colore={testoSu.scuro.tenue}>
            {`${riga.provider} · ${riga.campioni} campion${parola(riga.campioni, 'e', 'i')}`}
          </Corpo>
        </View>
        <Numero taglia={24} colore={colori.ambra}>
          {percentuale(riga.accuratezza_media)}
        </Numero>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {VALORI_ATTRIBUTO_CAPO.map((attributo) => {
          const valore = riga.esatti_per_attributo?.[attributo]
          return (
            <View
              key={attributo}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: raggi.piccolo,
                backgroundColor: 'rgba(247,244,239,0.07)',
                minWidth: 64,
              }}
            >
              <Etichetta taglia={9} colore={testoSu.scuro.tenue}>
                {ETICHETTE.attributo[attributo]}
              </Etichetta>
              <Forte taglia={13} colore={colori.crema}>
                {valore === undefined ? '—' : percentuale(valore)}
              </Forte>
            </View>
          )
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: spazi.s }}>
        <RiquadroStatistica numero={euro(riga.costo_medio_eur)} etichetta="costo medio" />
        <RiquadroStatistica numero={`${riga.latenza_mediana_ms} ms`} etichetta="latenza" />
        <RiquadroStatistica numero={percentuale(riga.tasso_vago)} etichetta="vago" />
        <RiquadroStatistica numero={percentuale(riga.tasso_errore)} etichetta="errore" />
      </View>

      {riga.inventati > 0 || riga.sicuri_e_sbagliati > 0 || riga.timidi_e_giusti > 0 ? (
        <View style={{ flexDirection: 'row', gap: spazi.m, flexWrap: 'wrap' }}>
          {riga.inventati > 0 ? (
            <Corpo taglia={11.5} colore={colori.coralloChiaro}>
              {`${riga.inventati} inventat${parola(riga.inventati, 'o', 'i')}`}
            </Corpo>
          ) : null}
          {riga.sicuri_e_sbagliati > 0 ? (
            <Corpo taglia={11.5} colore={colori.coralloChiaro}>
              {`${riga.sicuri_e_sbagliati} sicuri e sbagliati`}
            </Corpo>
          ) : null}
          {riga.timidi_e_giusti > 0 ? (
            <Corpo taglia={11.5} colore={testoSu.scuro.tenue}>
              {`${riga.timidi_e_giusti} timidi e giusti`}
            </Corpo>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
