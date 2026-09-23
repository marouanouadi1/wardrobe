/**
 * Il suggeritore: **una chat sola**.
 *
 * Erano tre modi di chiedere la stessa cosa — «Proposte» (guardare e basta),
 * «Chat» (spiegare a parole), «Guidato» (rispondere a tre domande) — e il
 * modello dietro era sempre lo stesso: cambiava solo come si raccoglieva il
 * contesto. Il deck «Aura» ne tiene uno, e l'utente ha scelto di seguirlo
 * (2026-09-22, `Q-10` in `docs/QUESTIONI.md`).
 *
 * Cosa ne è stato dei due tolti, perché non si vada a cercarli:
 * - **Proposte** non è sparita, si è **spostata**: le proposte pronte stanno in
 *   «Oggi», col contatore «n di 5» che le fa scorrere. Era la stessa lista,
 *   dallo stesso `chiediSuggerimenti()`, in due schermate.
 * - **Guidato** è stato **tolto**: tre pillole (dove vai, che tempo trovi, come
 *   ti senti) che componevano una frase e la mandavano a *questa* chat. Non
 *   faceva niente che la chat non faccia — era un modo di non digitare. Chi non
 *   vuole scrivere ha ancora gli spunti qui sotto, che sono la stessa idea in
 *   una riga sola.
 */

import type { Suggerimento } from '@wardrobe/contracts'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useArmadio, useVestiEVai } from '../src/dati/archivio'
import { type SceltaConversazione, useChat } from '../src/dati/chat'
import { linee, spazi } from '../src/tema/tokens'
import {
  BarraChiedi,
  BollaChat,
  BottonePrimario,
  BottoneSecondario,
  LinkTesto,
  Pillola,
  PuntiniAttesa,
} from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { Caricamento } from '../src/ui/stati'
import { Corpo, Etichetta, Forte } from '../src/ui/testo'

const SPUNTI = ['Cosa metto stasera?', 'Fa più freddo, cambia', 'Solo capi puliti', 'Qualcosa che non uso mai']

/** «Provalo» + «Salva»: la coppia di azioni che chiude ogni proposta. */
function AzioniProposta({
  salvata,
  onProva,
  onSalva,
}: {
  salvata: boolean
  onProva: () => void
  onSalva: () => void
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spazi.s }}>
      <BottonePrimario testo="Provalo" style={{ flex: 1 }} onPress={onProva} />
      <BottoneSecondario
        testo={salvata ? 'Salvato' : 'Salva'}
        style={{ paddingHorizontal: 18 }}
        onPress={salvata ? undefined : onSalva}
      />
    </View>
  )
}

export default function Suggeritore() {
  const parametri = useLocalSearchParams<{ chiedi?: string; conversazione?: string }>()
  const { salvaOutfit, avvisa } = useArmadio()
  const vestiEVai = useVestiEVai()
  const [salvati, setSalvati] = useState<string[]>([])

  // Quale conversazione aprire: quella passata dall'elenco (`chat.tsx`, il
  // parametro `conversazione`), o l'ultima di default — lo stesso
  // comportamento di sempre. «Nuova», sotto, la sposta su `{ tipo: 'nuova' }`
  // senza una nuova navigazione.
  const [sceltaChat, setSceltaChat] = useState<SceltaConversazione>(
    parametri.conversazione ? { tipo: 'id', id: parametri.conversazione } : { tipo: 'ultima' },
  )
  const {
    messaggi: conversazione,
    conversazione: conversazioneAttuale,
    caricamento: storiaInCaricamento,
    inAttesa,
    bozza,
    setBozza,
    invia,
  } = useChat(sceltaChat, avvisa)

  // Se la domanda arrivava da «Oggi», il suggeritore la gira al modello una
  // volta sola, come un messaggio in chat vero e proprio — dopo aver caricato
  // la cronologia, altrimenti finirebbe davanti ai messaggi precedenti.
  //
  // Il timeout non è un vezzo: sposta l'invio fuori dal corpo sincrono
  // dell'effetto — è la differenza che chiede react-hooks/set-state-in-effect.
  useEffect(() => {
    if (storiaInCaricamento) return
    const chiesto = parametri.chiedi?.trim()
    if (!chiesto) return
    const id = setTimeout(() => void invia(chiesto), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametri.chiedi, storiaInCaricamento])

  function provaEsalva(proposta: Suggerimento) {
    return {
      salvata: salvati.includes(proposta.titolo),
      onProva: () => vestiEVai(proposta.vestizione),
      onSalva: () => {
        setSalvati((precedenti) => [...precedenti, proposta.titolo])
        void salvaOutfit(proposta.titolo, { vestizione: proposta.vestizione, origine: 'ia' })
      },
    }
  }

  return (
    <Schermata occhiello="Il tuo stilista" titolo="Chiedi ad Aura" tavolozza="caldo" indietro ancoraInFondo>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
        <Etichetta taglia={11} tono="tenue" style={{ flex: 1 }} numberOfLines={1}>
          {conversazioneAttuale?.titolo ?? 'Nuova conversazione'}
        </Etichetta>
        <LinkTesto centrato={false} sottolineato taglia={12.5} tono="medio" onPress={() => router.push('/chat')}>
          Storico
        </LinkTesto>
        <LinkTesto
          centrato={false}
          sottolineato
          taglia={12.5}
          tono="medio"
          onPress={() => setSceltaChat({ tipo: 'nuova' })}
        >
          Nuova
        </LinkTesto>
      </View>

      {storiaInCaricamento ? (
        // Prima non c'era nulla qui: uno schermo vuoto indistinguibile da
        // una chat senza messaggi, finché la cronologia non arrivava.
        <Caricamento />
      ) : conversazione.length === 0 && !inAttesa ? (
        <Corpo taglia={13} tono="debole" style={{ textAlign: 'center' }}>
          {"Scrivi per iniziare: questa chat resta qui anche se chiudi l'app."}
        </Corpo>
      ) : null}

      <View style={{ gap: 11 }}>
        {conversazione.map((messaggio) => {
          const daUtente = messaggio.ruolo === 'utente'
          // Il turno appena inviato, ancora in volo verso il server: un
          // filo più trasparente, è la sola differenza — l'eco è già lì,
          // non manca più nulla da aspettare per vederlo.
          const inVolo = messaggio.id.startsWith('bozza-')
          return (
            <BollaChat key={messaggio.id} daUtente={daUtente}>
              <View style={{ opacity: inVolo ? 0.6 : 1, gap: spazi.s }}>
                {daUtente ? (
                  // `su="scuro"` non serve più scriverlo qui: `BollaChat`
                  // lo dichiara da sé (`ui/base.tsx`), da `daUtente`.
                  <Corpo taglia={14}>{messaggio.testo}</Corpo>
                ) : (
                  // La risposta vera dello stilista: prima la prosa —
                  // c'è sempre — poi le proposte, solo quando ci sono.
                  <>
                    <Corpo taglia={14}>{messaggio.testo}</Corpo>
                    {messaggio.suggerimenti?.map((proposta) => (
                      <View key={proposta.titolo} style={{ gap: spazi.s }}>
                        <Forte taglia={14}>{`${proposta.titolo} · ${proposta.match}%`}</Forte>
                        {proposta.perche.map((motivo) => (
                          <Corpo key={motivo} taglia={13} tono="medio">
                            {`— ${motivo}`}
                          </Corpo>
                        ))}
                        <View style={{ marginTop: spazi.xs }}>
                          <AzioniProposta {...provaEsalva(proposta)} />
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </BollaChat>
          )
        })}

        {inAttesa ? (
          <BollaChat daUtente={false}>
            <PuntiniAttesa />
          </BollaChat>
        ) : null}
      </View>

      {/* Gli spunti: la scorciatoia per chi non ha voglia di scrivere. Erano
          già qui, e adesso portano da soli il peso che era del modo «Guidato». */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
        {SPUNTI.map((spunto) => (
          <Pillola key={spunto} testo={spunto} onPress={() => void invia(spunto)} />
        ))}
      </ScrollView>

      <BarraChiedi
        valore={bozza}
        onCambia={setBozza}
        onInvia={() => void invia()}
        placeholder="Cena fuori, e fa freddo…"
      />

      <Corpo
        taglia={11.5}
        tono="debole"
        style={{ textAlign: 'center', borderTopWidth: 1, borderTopColor: linee.tenue, paddingTop: spazi.m }}
      >
        Le proposte usano solo i capi che hai, e mai quelli in lavatrice.
      </Corpo>
    </Schermata>
  )
}
