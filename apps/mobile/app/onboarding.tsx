/**
 * L'onboarding: tre schermate, una foto a tutto schermo, nessun modulo.
 *
 * Il terzo passo chiede tre preferenze di stile — e si può saltare. Un
 * questionario obbligatorio all'ingresso è il modo più efficace di perdere
 * l'utente prima che veda il prodotto: le preferenze si imparano dall'uso, e
 * queste tre servono solo a partire meno alla cieca.
 */

import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { colori, raggi, spazi } from '../src/tema/tokens'
import { BottonePrimario, Pillola, Toccabile } from '../src/ui/base'
import { Corpo, Etichetta, Titolo } from '../src/ui/testo'
import { segnaIntroVista } from './index'

const PASSI = [
  {
    occhiello: 'benvenuto',
    titolo: 'Il tuo armadio, finalmente in ordine.',
    corpo:
      'Fotografi i vestiti una volta sola. Poi ogni mattina ti dico cosa mettere, con quello che hai già in casa.',
    azione: 'Come funziona',
    foto: 17745134,
  },
  {
    occhiello: 'passo 1 di 2',
    titolo: 'Fotografa. Non compilare niente.',
    corpo:
      'Un capo per foto. Il modello riconosce categoria, colore, tessuto, stagione e lavaggio. Tu correggi solo se sbaglia.',
    azione: 'Va bene, e poi?',
    foto: 31064320,
  },
  {
    occhiello: 'passo 2 di 2',
    titolo: 'Dimmi come ti vesti.',
    corpo:
      'Tre tocchi e i suggerimenti partono già tarati sul tuo stile. Puoi cambiare quando vuoi.',
    azione: "Entra nell'armadio",
    foto: 7665789,
    stili: ['Comodo', 'Classico', 'Sportivo', 'Elegante', 'Neutri', 'Colori accesi'],
  },
] as const

function foto(id: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900&h=1300&fit=crop`
}

export default function Onboarding() {
  const [passo, setPasso] = useState(0)
  const [stiliScelti, setStiliScelti] = useState<string[]>([])
  const bordi = useSafeAreaInsets()
  const corrente = PASSI[passo]!
  const { profilo, ricarica } = useArmadio()

  async function entra() {
    // Le tre preferenze scelte al passo 2 non erano mai salvate: si
    // raccoglievano e si buttavano via. Il profilo esiste già (il backend lo
    // crea vuoto al primo GET /profilo): qui si aggiornano solo gli stili.
    if (stiliScelti.length > 0 && profilo) {
      await api
        .salvaProfilo({ ...profilo, preferenze: { ...profilo.preferenze, stili: stiliScelti } })
        .then(() => ricarica())
        .catch(() => undefined) // non è questo il momento di bloccare l'ingresso per un salvataggio andato male
    }
    await segnaIntroVista()
    router.replace('/(tabs)/oggi')
  }

  return (
    <View style={{ flex: 1, backgroundColor: colori.inchiostro }}>
      <Image
        source={{ uri: foto(corrente.foto) }}
        style={{ position: 'absolute', inset: 0 }}
        contentFit="cover"
        transition={300}
      />
      {/* La sfumatura non è decorazione: senza, il testo bianco su una foto
          qualunque diventa illeggibile. */}
      <LinearGradient
        colors={['rgba(21,21,26,0.15)', 'rgba(21,21,26,0.55)', 'rgba(21,21,26,0.96)']}
        locations={[0, 0.46, 1]}
        style={{ position: 'absolute', inset: 0 }}
      />

      <View
        style={{
          flex: 1,
          paddingTop: Math.max(bordi.top, 20) + 20,
          paddingBottom: Math.max(bordi.bottom, 20) + 10,
          paddingHorizontal: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Titolo taglia={22} colore={colori.scheda}>
            wardrobe
          </Titolo>
          <View
            style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: colori.citron }}
          />
        </View>

        <View style={{ marginTop: 'auto', gap: spazi.m }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {PASSI.map((_, indice) => (
              <View
                key={indice}
                style={{
                  height: 3,
                  borderRadius: 99,
                  width: indice === passo ? 26 : 10,
                  backgroundColor: indice === passo ? colori.citron : 'rgba(255,253,249,0.35)',
                }}
              />
            ))}
          </View>

          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingVertical: 6,
              paddingLeft: 8,
              paddingRight: 12,
              borderRadius: raggi.pillola,
              backgroundColor: 'rgba(255,253,249,0.16)',
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: colori.citron }} />
            <Etichetta taglia={11} colore={colori.scheda}>
              {corrente.occhiello}
            </Etichetta>
          </View>

          <Titolo taglia={40} colore={colori.scheda} style={{ letterSpacing: -1.6 }}>
            {corrente.titolo}
          </Titolo>
          <Corpo taglia={15} colore="rgba(255,253,249,0.82)" style={{ maxWidth: 330 }}>
            {corrente.corpo}
          </Corpo>

          {'stili' in corrente ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s, marginTop: spazi.xs }}>
              {corrente.stili.map((stile) => (
                <Pillola
                  key={stile}
                  testo={stile}
                  scura
                  attiva={stiliScelti.includes(stile)}
                  onPress={() =>
                    setStiliScelti((precedenti) =>
                      precedenti.includes(stile)
                        ? precedenti.filter((s) => s !== stile)
                        : [...precedenti, stile],
                    )
                  }
                />
              ))}
            </View>
          ) : null}

          <BottonePrimario
            testo={corrente.azione}
            freccia
            chiaro
            style={{ marginTop: spazi.m }}
            onPress={() => (passo < PASSI.length - 1 ? setPasso(passo + 1) : void entra())}
          />

          <Toccabile onPress={() => void entra()} scala={0} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Corpo taglia={13.5} colore="rgba(255,253,249,0.6)">
              {"Entro direttamente nell'armadio"}
            </Corpo>
          </Toccabile>
        </View>
      </View>
    </View>
  )
}
