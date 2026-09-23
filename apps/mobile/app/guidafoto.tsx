/**
 * Come viene bene una foto: contenuto statico, nessuna chiamata.
 *
 * Erano **due righe di testo minuto** in fondo a `(tabs)/carica.tsx`, dove
 * nessuno le leggeva: stavano sotto il bottone che si tocca per andarsene, e
 * dicevano la cosa più tecnica di tutte (come togliere lo sfondo su iPhone)
 * senza dire prima quella più utile — come si mette il capo.
 *
 * **Gli esempi fotografici del deck non ci sono**, e non sono stati sostituiti
 * con riquadri vuoti: il deck mostra tre foto di capi veri (una buona, una
 * buona, una mossa su un tappeto a fantasia) e in `assets/` non abbiamo quelle
 * immagini. Tre cornici senza contenuto direbbero meno del testo che portano.
 */

import { router } from 'expo-router'
import { View } from 'react-native'
import { colori, spazi, velature } from '../src/tema/tokens'
import { BottonePrimario, Icona, Scheda } from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { Corpo, Forte, Titolo } from '../src/ui/testo'

/** Cosa inquadrare. */
const COSA = [
  'Un capo per foto, intero nell’inquadratura',
  'Steso o appeso, senza pieghe grosse',
  'Fondo semplice: letto, muro, pavimento',
]

/** Come scattare. */
const COME = [
  'Appoggia il capo su un letto o un muro chiaro',
  'Tieni il telefono fermo, senza zoom',
  'Luce di giorno, niente flash',
]

function Elenco({ titolo, voci }: { titolo: string; voci: string[] }) {
  return (
    <Scheda vetro imbottitura={spazi.l} style={{ gap: spazi.m }}>
      <Titolo taglia="guida">{titolo}</Titolo>
      {voci.map((voce) => (
        <View key={voce} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spazi.m }}>
          <View style={{ marginTop: 1 }}>
            <Icona nome="spunta" misura={17} colore={colori.primario} />
          </View>
          <Corpo taglia="corpo" tono="medio" style={{ flex: 1 }}>
            {voce}
          </Corpo>
        </View>
      ))}
    </Scheda>
  )
}

export default function GuidaFoto() {
  return (
    <Schermata occhiello="Nuovo capo" titolo="Come viene bene" tavolozza="neutro" indietro>
      <Elenco titolo="Cosa inquadrare" voci={COSA} />
      <Elenco titolo="Come scattare" voci={COME} />

      {/* La cosa che toglie ansia, e per questo sta prima del trucco tecnico:
          una foto imperfetta **non blocca niente**. Lo scontorno che non
          riesce è ingoiato di proposito dal backend (`handlers/analisi.py`,
          ADR 0004), il capo entra lo stesso. */}
      <Scheda su="chiaro" sfondo={velature.primario} imbottitura={spazi.l} style={{ gap: spazi.s }}>
        <Forte taglia="minuto">Se lo sfondo non viene via</Forte>
        <Corpo taglia="minuto" tono="medio">
          {'Il capo entra lo stesso: lo correggi dopo, e intanto l’avatar usa il suo colore.'}
        </Corpo>
      </Scheda>

      <Scheda vetro imbottitura={spazi.l} style={{ gap: spazi.s }}>
        <Forte taglia="minuto">Se vuoi toglierlo tu</Forte>
        <Corpo taglia="minuto" tono="tenue">
          {
            'Su iPhone: tieni premuto sul capo in Foto e scegli «Copia soggetto», oppure in File tocca a lungo la foto e scegli «Rimuovi sfondo». In alternativa un sito come remove.bg.'
          }
        </Corpo>
      </Scheda>

      <BottonePrimario testo="Scatta adesso" icona="fotocamera" onPress={() => router.back()} />
    </Schermata>
  )
}
