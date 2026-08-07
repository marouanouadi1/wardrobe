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
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { api } from '../../src/dati/api'
import { type SceltaModello, useArmadio } from '../../src/dati/archivio'
import { colori, raggi, spazi } from '../../src/tema/tokens'
import { Toccabile } from '../../src/ui/base'
import { Corpo, Etichetta, Forte, Titolo } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

const CREMA_TENUE = 'rgba(247,244,239,0.5)'

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
        <Etichetta taglia={11} colore={CREMA_TENUE}>
          {titolo}
        </Etichetta>
        <Corpo taglia={11.5} colore="rgba(247,244,239,0.5)" style={{ marginTop: 2 }}>
          {descrizione}
        </Corpo>
      </View>

      <Toccabile
        onPress={() => imposta(null)}
        scala={0.99}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spazi.m,
          paddingHorizontal: 15,
          paddingVertical: 14,
          borderRadius: raggi.medio,
          borderWidth: 1,
          borderColor: scelta === null ? colori.citron : 'rgba(247,244,239,0.12)',
          backgroundColor: scelta === null ? 'rgba(215,244,92,0.12)' : 'rgba(247,244,239,0.04)',
        }}
      >
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 99,
            borderWidth: 2,
            borderColor: scelta === null ? colori.citron : 'rgba(247,244,239,0.3)',
            backgroundColor: scelta === null ? colori.citron : 'transparent',
          }}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Titolo taglia={15} colore={colori.crema}>
            Predefinito del backend
          </Titolo>
          <Corpo taglia={11.5} colore={CREMA_TENUE}>
            Quello del `.env` (Anthropic, finché non lo cambi)
          </Corpo>
        </View>
      </Toccabile>

      {modelli.map((voce) => {
        const attivo = stessoModello(scelta, { provider: voce.provider, modello: voce.id })
        return (
          <Toccabile
            key={`${voce.provider}-${voce.id}`}
            onPress={() => imposta({ provider: voce.provider, modello: voce.id })}
            scala={0.99}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spazi.m,
              paddingHorizontal: 15,
              paddingVertical: 14,
              borderRadius: raggi.medio,
              borderWidth: 1,
              borderColor: attivo ? colori.citron : 'rgba(247,244,239,0.12)',
              backgroundColor: attivo ? 'rgba(215,244,92,0.12)' : 'rgba(247,244,239,0.04)',
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 99,
                borderWidth: 2,
                borderColor: attivo ? colori.citron : 'rgba(247,244,239,0.3)',
                backgroundColor: attivo ? colori.citron : 'transparent',
              }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Titolo taglia={15} colore={colori.crema}>
                {voce.etichetta}
              </Titolo>
              <Corpo taglia={11.5} colore={CREMA_TENUE}>
                {voce.provider}
                {voce.note ? ` · ${voce.note}` : ''}
              </Corpo>
            </View>
            {/* Stessa spia del playground: se manca la chiave, il flusso vero
                fallirebbe con lo stesso 503 — meglio saperlo prima di scegliere. */}
            <Forte taglia={10} colore={voce.configurato ? colori.citron : 'rgba(255,106,69,0.9)'}>
              {voce.configurato ? 'pronto' : 'senza chiave'}
            </Forte>
          </Toccabile>
        )
      })}
    </View>
  )
}

export default function ModelliInUso() {
  const {
    modelloVisione,
    modelloStilista,
    impostaModelloVisione,
    impostaModelloStilista,
  } = useArmadio()
  const [modelli, setModelli] = useState<ModelloDisponibile[]>([])

  useEffect(() => {
    void (async () => {
      try {
        setModelli(await api.dev.modelli())
      } catch {
        // Resta il catalogo di riferimento: la schermata rimane utilizzabile
        // in lettura anche se il backend non risponde in questo momento.
      }
    })()
  }, [])

  const modelliVisione = modelli.filter((m) => m.visione)

  return (
    <View style={{ flex: 1, backgroundColor: colori.inchiostro }}>
      <Testata occhiello="Solo interno" titolo="Modelli in uso" indietro scura />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 60, gap: spazi.xl }}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>
    </View>
  )
}
