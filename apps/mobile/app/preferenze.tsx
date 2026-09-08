/**
 * Le preferenze di stile: tre tocchi, dopo il login.
 *
 * Era il terzo passo dell'onboarding, spostato qui perché salva sul backend
 * (`api.salvaProfilo`, che vuole un bearer token) — prima del login non c'è
 * un utente a cui appoggiare quel salvataggio. Un questionario obbligatorio
 * qui perderebbe comunque l'utente: si può saltare, e si può rivedere da
 * Profilo → «Le mie preferenze» in qualunque momento, già precompilato.
 */

import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { api } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { segnaPreferenzeViste } from '../src/dati/intro'
import { colori, spazi } from '../src/tema/tokens'
import { BottonePrimario, Pillola, Toccabile } from '../src/ui/base'
import { Corpo } from '../src/ui/testo'
import { Testata } from '../src/ui/guscio'

const STILI = ['Comodo', 'Classico', 'Sportivo', 'Elegante', 'Neutri', 'Colori accesi']

export default function Preferenze() {
  const { profilo, ricarica } = useArmadio()
  const [stiliScelti, setStiliScelti] = useState<string[]>(profilo?.preferenze?.stili ?? [])
  const [salvando, setSalvando] = useState(false)

  async function entra() {
    setSalvando(true)
    if (profilo) {
      await api
        .salvaProfilo({ ...profilo, preferenze: { ...profilo.preferenze, stili: stiliScelti } })
        .then(() => ricarica())
        .catch(() => undefined) // non è questo il momento di bloccare l'ingresso per un salvataggio andato male
    }
    await segnaPreferenzeViste()
    setSalvando(false)
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/oggi')
  }

  return (
    <View style={{ flex: 1, backgroundColor: colori.sfondo }}>
      <Testata occhiello="il tuo stile · 1 di 1" titolo="Dimmi come ti vesti." />

      <View style={{ flex: 1, paddingHorizontal: spazi.xl, paddingBottom: spazi.l, gap: spazi.l }}>
        <Corpo taglia={15} tono="medio" style={{ maxWidth: 330 }}>
          Tre tocchi e i suggerimenti partono già tarati sul tuo stile. Puoi cambiare quando vuoi,
          da Profilo.
        </Corpo>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
          {STILI.map((stile) => (
            <Pillola
              key={stile}
              testo={stile}
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

        <View style={{ marginTop: 'auto', gap: spazi.s }}>
          <BottonePrimario
            testo="Entra nell'armadio"
            freccia
            caricando={salvando}
            disabilitato={salvando}
            onPress={() => void entra()}
          />
          <Toccabile onPress={() => void entra()} scala={0} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Corpo taglia={13.5} tono="tenue">
              Lo faccio dopo
            </Corpo>
          </Toccabile>
        </View>
      </View>
    </View>
  )
}
