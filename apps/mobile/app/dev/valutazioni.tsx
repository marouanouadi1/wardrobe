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

import type { RigaAggregata, RispostaValutazioni } from '@wardrobe/contracts'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { api } from '../../src/dati/api'
import { colori, raggi, spazi } from '../../src/tema/tokens'
import { Corpo, Etichetta, Forte, Numero } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

const CREMA_TENUE = 'rgba(247,244,239,0.5)'
const FONDO_RIGA = 'rgba(247,244,239,0.05)'
const FONDO_CHIP = 'rgba(247,244,239,0.07)'

/** Lo stesso ordine di `AttributoCapo`: è quello in cui il backend li giudica. */
const ATTRIBUTI = [
  'tipo',
  'colore',
  'materiale',
  'fantasia',
  'stagione',
  'vestibilita',
  'lavaggio',
] as const

const ETICHETTE_ATTRIBUTO: Record<(typeof ATTRIBUTI)[number], string> = {
  tipo: 'Tipo',
  colore: 'Colore',
  materiale: 'Materiale',
  fantasia: 'Fantasia',
  stagione: 'Stagione',
  vestibilita: 'Vestib.',
  lavaggio: 'Lavaggio',
}

function percentuale(valore: number): string {
  return `${Math.round(valore * 100)}%`
}

function euro(valore: number | null | undefined): string {
  // `null`/assente non è «costa zero»: è «non lo sappiamo», e va mostrato
  // diverso da uno zero vero — vedi `domain.adapters.llm.registry._con_prezzi`.
  return valore === null || valore === undefined ? '—' : `${valore.toFixed(4)} €`
}

export default function Valutazioni() {
  const [dati, setDati] = useState<RispostaValutazioni | null>(null)
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        setDati(await api.dev.valutazioni())
      } catch {
        setErrore(true)
      } finally {
        setCaricando(false)
      }
    })()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: colori.inchiostro }}>
      <Testata occhiello="Solo interno" titolo="Valutazione modelli" indietro scura />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 60, gap: spazi.l }}
        showsVerticalScrollIndicator={false}
      >
        {(() => {
          const righe = dati?.righe ?? []
          if (caricando) return <ActivityIndicator color={colori.citron} style={{ marginTop: spazi.xl }} />
          if (errore) {
            return (
              <Messaggio
                titolo="Non riesco a leggere il banco"
                corpo="Controlla che il backend sia raggiungibile e riprova."
              />
            )
          }
          if (!dati?.run_id || righe.length === 0) {
            return (
              <Messaggio
                titolo="Nessun run ancora"
                corpo="Fotografa i 10 campioni (tests/fixtures/campioni/GUIDA.md), poi lancia da services/api: uv run python scripts/valuta_modelli.py --conferma"
              />
            )
          }
          return (
            <>
              <Etichetta taglia={11} colore={CREMA_TENUE}>
                {`Run · ${dati.run_id}`}
              </Etichetta>
              {righe.map((riga) => (
                <RigaModello key={`${riga.provider}-${riga.modello}`} riga={riga} />
              ))}
            </>
          )
        })()}
      </ScrollView>
    </View>
  )
}

function RigaModello({ riga }: { riga: RigaAggregata }) {
  return (
    <View
      style={{
        padding: spazi.l,
        borderRadius: raggi.scheda - 2,
        backgroundColor: FONDO_RIGA,
        gap: spazi.m,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.m }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Forte taglia={15} colore={colori.crema} numberOfLines={1}>
            {riga.modello}
          </Forte>
          <Corpo taglia={11.5} colore={CREMA_TENUE}>
            {`${riga.provider} · ${riga.campioni} campion${riga.campioni === 1 ? 'e' : 'i'}`}
          </Corpo>
        </View>
        <Numero taglia={24} colore={colori.citron}>
          {percentuale(riga.accuratezza_media)}
        </Numero>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {ATTRIBUTI.map((attributo) => {
          const valore = riga.esatti_per_attributo?.[attributo]
          return (
            <View
              key={attributo}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: raggi.piccolo,
                backgroundColor: FONDO_CHIP,
                minWidth: 64,
              }}
            >
              <Etichetta taglia={9} colore={CREMA_TENUE}>
                {ETICHETTE_ATTRIBUTO[attributo]}
              </Etichetta>
              <Forte taglia={13} colore={colori.crema}>
                {valore === undefined ? '—' : percentuale(valore)}
              </Forte>
            </View>
          )
        })}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: spazi.s }}>
        <Metrica etichetta="costo medio" valore={euro(riga.costo_medio_eur)} />
        <Metrica etichetta="latenza" valore={`${riga.latenza_mediana_ms} ms`} />
        <Metrica etichetta="vago" valore={percentuale(riga.tasso_vago)} />
        <Metrica etichetta="errore" valore={percentuale(riga.tasso_errore)} />
      </View>

      {riga.inventati > 0 || riga.sicuri_e_sbagliati > 0 || riga.timidi_e_giusti > 0 ? (
        <View style={{ flexDirection: 'row', gap: spazi.m, flexWrap: 'wrap' }}>
          {riga.inventati > 0 ? (
            <Corpo taglia={11.5} colore="#FFB39B">
              {`${riga.inventati} inventat${riga.inventati === 1 ? 'o' : 'i'}`}
            </Corpo>
          ) : null}
          {riga.sicuri_e_sbagliati > 0 ? (
            <Corpo taglia={11.5} colore="#FFB39B">
              {`${riga.sicuri_e_sbagliati} sicuri e sbagliati`}
            </Corpo>
          ) : null}
          {riga.timidi_e_giusti > 0 ? (
            <Corpo taglia={11.5} colore={CREMA_TENUE}>
              {`${riga.timidi_e_giusti} timidi e giusti`}
            </Corpo>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function Metrica({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: raggi.piccolo,
        backgroundColor: FONDO_CHIP,
      }}
    >
      <Numero taglia={14} colore={colori.crema}>
        {valore}
      </Numero>
      <Etichetta taglia={8.5} colore={CREMA_TENUE} style={{ marginTop: 2 }}>
        {etichetta}
      </Etichetta>
    </View>
  )
}

function Messaggio({ titolo, corpo }: { titolo: string; corpo: string }) {
  return (
    <View
      style={{
        marginTop: spazi.xl,
        padding: spazi.xl,
        borderRadius: raggi.scheda - 2,
        backgroundColor: FONDO_RIGA,
        gap: spazi.s,
      }}
    >
      <Forte taglia={15} colore={colori.crema}>
        {titolo}
      </Forte>
      <Corpo taglia={13} colore={CREMA_TENUE}>
        {corpo}
      </Corpo>
    </View>
  )
}
