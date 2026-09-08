/**
 * Il suggeritore, in tre modi di chiedere la stessa cosa.
 *
 * Tre e non uno perché le persone chiedono in modo diverso: chi vuole solo
 * guardare (proposte), chi sa spiegare a parole (chat), chi preferisce
 * rispondere a tre domande (guidato). Il modello dietro è lo stesso; cambia solo
 * come si raccoglie il contesto.
 */

import type { Suggerimento } from '@wardrobe/contracts'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useArmadio, useVestiEVai } from '../src/dati/archivio'
import { type SceltaConversazione, useChat } from '../src/dati/chat'
import { capiDiVestizione, fotoDaMostrare } from '../src/dati/dominio'
import { colori, linee, ombre, raggi, spazi } from '../src/tema/tokens'
import {
  BadgeIa,
  BarraChiedi,
  BollaChat,
  BottonePrimario,
  BottoneSecondario,
  Pillola,
  PuntiniAttesa,
  Scheda,
  Segmenti,
  Toccabile,
} from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { Corpo, Etichetta, Forte, Titolo } from '../src/ui/testo'

type Modo = 'proposte' | 'chat' | 'guidato'

const MODI = [
  { valore: 'proposte' as const, etichetta: 'Proposte' },
  { valore: 'chat' as const, etichetta: 'Chat' },
  { valore: 'guidato' as const, etichetta: 'Guidato' },
] as const

const DOMANDE = [
  { chiave: 'occasione', testo: 'Dove vai?', opzioni: ['Ufficio', 'Cena', 'Casa', 'Palestra', 'Cerimonia'] },
  { chiave: 'meteo', testo: 'Che tempo trovi?', opzioni: ['Freddo', 'Mite', 'Caldo', 'Pioggia'] },
  { chiave: 'umore', testo: 'Come ti senti?', opzioni: ['Sicuro', 'Comodo', 'Invisibile', 'Voglio osare'] },
] as const

const SPUNTI = ['Cosa metto stasera?', 'Fa più freddo, cambia', 'Solo capi puliti', 'Qualcosa che non uso mai']

/** «Provalo» + «Salva»: la coppia di azioni che chiude ogni proposta, sia
 * nella scheda piena (proposte) sia in linea dentro la bolla (chat). */
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
  const { suggerimenti, indice, salvaOutfit, chiediSuggerimenti, avvisa } = useArmadio()
  const vestiEVai = useVestiEVai()
  const [modo, setModo] = useState<Modo>(parametri.chiedi ? 'chat' : 'proposte')
  const [risposte, setRisposte] = useState<Record<string, string>>({})
  const [generato, setGenerato] = useState(false)
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

  const complete = DOMANDE.every((domanda) => risposte[domanda.chiave])

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
    <Schermata occhiello="Il tuo stilista" titolo="Chiedi a Wardrobe" indietro ancoraInFondo={modo === 'chat'}>
      <Segmenti voci={MODI} scelta={modo} onScegli={setModo} />

      {modo === 'proposte'
        ? suggerimenti.map((proposta) => {
            const capi = capiDiVestizione(proposta.vestizione, indice)
            return (
              <View
                key={proposta.titolo}
                style={{
                  borderRadius: raggi.grande - 2,
                  overflow: 'hidden',
                  backgroundColor: colori.scheda,
                  ...ombre.scheda,
                }}
              >
                {capi[0] && fotoDaMostrare(capi[0]) ? (
                  <View>
                    <Image
                      source={{ uri: fotoDaMostrare(capi[0]) }}
                      style={{ width: '100%', height: 230, backgroundColor: capi[0].colore.hex }}
                      contentFit="cover"
                      contentPosition={{ top: '20%', left: '50%' }}
                    />
                    <View style={{ position: 'absolute', top: 12, right: 12 }}>
                      <BadgeIa testo={`${proposta.match}%`} />
                    </View>
                  </View>
                ) : null}

                <View style={{ padding: 16, gap: spazi.m }}>
                  <Titolo taglia={21}>{proposta.titolo}</Titolo>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {capi.map((capo) => (
                      <Image
                        key={capo.id}
                        source={{ uri: fotoDaMostrare(capo) }}
                        style={{
                          width: 52,
                          height: 64,
                          borderRadius: raggi.piccolo,
                          backgroundColor: capo.colore.hex,
                        }}
                        contentFit="cover"
                      />
                    ))}
                  </View>

                  <View style={{ gap: 7 }}>
                    {proposta.perche.map((motivo) => (
                      <View key={motivo} style={{ flexDirection: 'row', gap: 9 }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: raggi.pillola,
                            marginTop: 7,
                            backgroundColor: colori.ambra,
                          }}
                        />
                        <Corpo taglia={13} tono="medio" style={{ flex: 1 }}>
                          {motivo}
                        </Corpo>
                      </View>
                    ))}
                  </View>

                  {/* «Salva» tiene la proposta senza doverla prima provare:
                      due tocchi in meno per chi ha già deciso. */}
                  <AzioniProposta {...provaEsalva(proposta)} />
                </View>
              </View>
            )
          })
        : null}

      {modo === 'chat' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
            <Etichetta taglia={11} tono="tenue" style={{ flex: 1 }} numberOfLines={1}>
              {conversazioneAttuale?.titolo ?? 'Nuova conversazione'}
            </Etichetta>
            <Toccabile onPress={() => router.push('/chat')} scala={0} style={{ paddingVertical: 4 }}>
              <Corpo taglia={12.5} tono="medio" style={{ textDecorationLine: 'underline' }}>
                Storico
              </Corpo>
            </Toccabile>
            <Toccabile
              onPress={() => setSceltaChat({ tipo: 'nuova' })}
              scala={0}
              style={{ paddingVertical: 4 }}
            >
              <Corpo taglia={12.5} tono="medio" style={{ textDecorationLine: 'underline' }}>
                Nuova
              </Corpo>
            </Toccabile>
          </View>

          {!storiaInCaricamento && conversazione.length === 0 && !inAttesa ? (
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
                      <Corpo taglia={14} su="scuro">
                        {messaggio.testo}
                      </Corpo>
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
        </>
      ) : null}

      {modo === 'guidato' ? (
        <>
          {DOMANDE.map((domanda) => (
            <View key={domanda.chiave} style={{ gap: spazi.s }}>
              <Titolo taglia={18}>{domanda.testo}</Titolo>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
                {domanda.opzioni.map((opzione) => (
                  <Pillola
                    key={opzione}
                    testo={opzione}
                    attiva={risposte[domanda.chiave] === opzione}
                    onPress={() => {
                      setRisposte((precedenti) => ({ ...precedenti, [domanda.chiave]: opzione }))
                      setGenerato(false)
                    }}
                  />
                ))}
              </View>
            </View>
          ))}

          <BottonePrimario
            testo={complete ? 'Trova il mio outfit' : 'Rispondi alle tre domande'}
            ambra={complete}
            disabilitato={!complete}
            onPress={() => {
              setGenerato(true)
              void chiediSuggerimenti(
                `${risposte.occasione}, ${risposte.meteo?.toLowerCase()}, mi sento ${risposte.umore?.toLowerCase()}`,
              )
            }}
          />

          {generato && suggerimenti[0] ? (
            <Scheda imbottitura={16} style={{ gap: spazi.m }}>
              <Titolo taglia={20}>{suggerimenti[0].titolo}</Titolo>
              <Corpo taglia={13} tono="medio">
                {`${risposte.occasione}, ${risposte.meteo?.toLowerCase()}, e ti senti ${risposte.umore?.toLowerCase()}: ${suggerimenti[0].perche[0]}`}
              </Corpo>
              <BottonePrimario testo="Vedilo sull'avatar" onPress={() => vestiEVai(suggerimenti[0]!.vestizione)} />
            </Scheda>
          ) : null}
        </>
      ) : null}

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
