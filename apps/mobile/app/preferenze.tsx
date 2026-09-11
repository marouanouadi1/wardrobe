/**
 * Le preferenze di stile: tre tocchi, dopo il login.
 *
 * Era il terzo passo dell'onboarding, spostato qui perché salva sul backend
 * (`api.salvaProfilo`, che vuole un bearer token) — prima del login non c'è
 * un utente a cui appoggiare quel salvataggio. Un questionario obbligatorio
 * qui perderebbe comunque l'utente: si può saltare, e si può rivedere da
 * Profilo → «Le mie preferenze» in qualunque momento, già precompilato.
 */

import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { api } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { useAzione } from '../src/dati/risorsa'
import { segnaPreferenzeViste } from '../src/dati/intro'
import { colori, spazi } from '../src/tema/tokens'
import { BottonePrimario, LinkTesto, Pillola } from '../src/ui/base'
import { Corpo } from '../src/ui/testo'
import { Testata } from '../src/ui/guscio'

const STILI = ['Comodo', 'Classico', 'Sportivo', 'Elegante', 'Neutri', 'Colori accesi']

export default function Preferenze() {
  // `rivisita` distingue le due strade che portano qui: il primo accesso
  // (index.tsx, un redirect dopo il login — «indietro» non ha un posto
  // sensato dove andare) da una revisita volontaria (Profilo → «Le mie
  // preferenze», router.push, dove «indietro» deve tornare lì). Senza questo
  // segnale `router.canGoBack()` mentiva al primo accesso: la cronologia del
  // browser porta con sé le tappe di prima del login (intro, accedi), quindi
  // risultava vero anche quando non c'era nessun «indietro» sensato — uscendo
  // dritti sull'intro invece che nell'armadio.
  const { rivisita } = useLocalSearchParams<{ rivisita?: string }>()
  const { profilo, pronto, ricarica, avvisa } = useArmadio()
  const [stiliScelti, setStiliScelti] = useState<string[]>([])
  const { caricamento: salvando, esegui } = useAzione<typeof profilo>()

  // Il profilo arriva un istante dopo il montaggio (l'archivio è ancora in
  // caricamento appena dopo il login): leggerlo nell'inizializzatore di
  // `useState` sopra lo vedeva sempre `null`, le pillole nascevano tutte
  // spente, e «Entra nell'armadio» avrebbe salvato `stili: []` sopra le
  // preferenze già scelte in una sessione precedente. Sincronizza una volta
  // sola, alla prima volta che il profilo arriva — un `ref`, non `profilo`
  // da solo, per non far ripartire l'effetto dopo il `ricarica()` che il
  // salvataggio più sotto innesca a sua volta.
  const sincronizzato = useRef(false)
  useEffect(() => {
    if (sincronizzato.current || !profilo) return
    setStiliScelti(profilo.preferenze?.stili ?? [])
    sincronizzato.current = true
  }, [profilo])

  async function entra() {
    if (!profilo) {
      // `pronto` diventa `true` anche sull'errore di caricamento
      // dell'archivio (Fase 2: `erroreCaricamento` porta `profilo: null`
      // insieme a `pronto: true`, quindi il bottone qui sopra non è più
      // disabilitato da solo). Senza questa guardia si segnava comunque
      // «preferenze viste» e la selezione fatta in questa schermata
      // spariva senza che l'utente lo sapesse, senza più un modo di
      // tornarci (il primo accesso non passa più di qui). Si resta sulla
      // schermata: la prossima `carica()` riuscita fa arrivare `profilo`
      // e riabilita un salvataggio vero.
      avvisa('Non riesco a leggere il tuo profilo: riprova tra poco.')
      return
    }
    const salvato = await esegui(() =>
      api.salvaProfilo({ ...profilo, preferenze: { ...profilo.preferenze, stili: stiliScelti } }),
    )
    if (salvato) await ricarica()
    else avvisa('Le preferenze non sono state salvate. Le trovi comunque in Profilo.')
    await segnaPreferenzeViste()
    if (rivisita) router.back()
    else router.replace('/(tabs)/oggi')
  }

  // Distinta da `entra()`, non la stessa funzione con un salvataggio in meno:
  // «lo faccio dopo» non deve mai chiamare `salvaProfilo` — prima lo faceva,
  // e con `stiliScelti` ancora a `[]` (vedi sopra) cancellava preferenze già
  // salvate anche per chi non aveva toccato nulla in questa schermata.
  async function salta() {
    await segnaPreferenzeViste()
    if (rivisita) router.back()
    else router.replace('/(tabs)/oggi')
  }

  return (
    <View style={{ flex: 1, backgroundColor: colori.sfondo }}>
      <Testata occhiello="il tuo stile" titolo="Dimmi come ti vesti." indietro={Boolean(rivisita)} />

      <View style={{ flex: 1, paddingHorizontal: spazi.xl, paddingBottom: spazi.l, gap: spazi.l }}>
        <Corpo taglia="guida" tono="medio" style={{ maxWidth: 330 }}>
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
            disabilitato={salvando || !pronto}
            onPress={() => void entra()}
          />
          {!rivisita ? <LinkTesto onPress={() => void salta()}>Lo faccio dopo</LinkTesto> : null}
        </View>
      </View>
    </View>
  )
}
