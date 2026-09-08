/**
 * Quale modello usano davvero «Aggiungi» e «Chiedi a Wardrobe» — non il
 * playground, i due lavori veri del prodotto.
 *
 * Il playground misura: cambia modello per un solo test e non tocca niente
 * fuori da sé. Questa schermata sposta la scelta stabile che i due flussi
 * useranno finché non la cambi di nuovo (o finché non riavvii l'app: vive in
 * memoria, come il resto dello store).
 *
 * Sta sotto «Sviluppo» come il playground: il catalogo arriva da
 * `/dev/modelli`, che in produzione non esiste (vedi `api-stack.ts`).
 */

import type { ModelloDisponibile } from '@wardrobe/contracts'
import { View } from 'react-native'
import { api } from '../dati/api'
import { type SceltaModello, useArmadio } from '../dati/archivio'
import { useRisorsa } from '../dati/risorsa'
import { spazi, testoSu } from '../tema/tokens'
import { Schermata } from '../ui/guscio'
import { RigaRadio, TitoloSezione, spiaModello } from '../ui/righe'
import { Corpo } from '../ui/testo'

function stessoModello(a: SceltaModello | null, b: SceltaModello | null): boolean {
  if (a === null || b === null) return a === b
  return a.provider === b.provider && a.modello === b.modello
}

/** Un lavoro (visione o stilista): la sua scelta, il catalogo, e come cambiarla. */
function Selettore({
  titolo,
  descrizione,
  scelta,
  imposta,
  modelli,
}: {
  titolo: string
  descrizione: string
  scelta: SceltaModello | null
  imposta: (scelta: SceltaModello | null) => void
  modelli: ModelloDisponibile[]
}) {
  return (
    <View style={{ gap: spazi.s }}>
      <View>
        <TitoloSezione su="scuro">{titolo}</TitoloSezione>
        <Corpo taglia={11.5} colore={testoSu.scuro.tenue} style={{ marginTop: 2 }}>
          {descrizione}
        </Corpo>
      </View>

      <RigaRadio
        titolo="Predefinito del backend"
        sottotitolo="Quello del `.env` (Anthropic, finché non lo cambi)"
        attivo={scelta === null}
        onPress={() => imposta(null)}
      />

      {modelli.map((voce) => {
        const attivo = stessoModello(scelta, { provider: voce.provider, modello: voce.id })
        return (
          <RigaRadio
            key={`${voce.provider}-${voce.id}`}
            titolo={voce.etichetta}
            sottotitolo={`${voce.provider}${voce.note ? ` · ${voce.note}` : ''}`}
            attivo={attivo}
            onPress={() => imposta({ provider: voce.provider, modello: voce.id })}
            {...spiaModello(voce.configurato)}
          />
        )
      })}
    </View>
  )
}

export default function ModelliInUso() {
  const { modelloVisione, modelloStilista, impostaModelloVisione, impostaModelloStilista } = useArmadio()
  const { dati } = useRisorsa(() => api.dev.modelli())
  const modelli = dati ?? []
  const modelliVisione = modelli.filter((m) => m.visione)

  return (
    <Schermata occhiello="Solo interno" titolo="Modelli in uso" indietro su="scuro" contentStyle={{ gap: spazi.xl }}>
      <Selettore
        titolo="Lettura foto"
        descrizione={'Il modello che guarda la foto quando tocchi «Aggiungi».'}
        scelta={modelloVisione}
        imposta={impostaModelloVisione}
        modelli={modelliVisione}
      />

      <Selettore
        titolo="Suggerimenti"
        descrizione={'Il modello che propone gli outfit in «Chiedi a Wardrobe».'}
        scelta={modelloStilista}
        imposta={impostaModelloStilista}
        modelli={modelli}
      />
    </Schermata>
  )
}
