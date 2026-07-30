/**
 * Il suggeritore, in tre modi di chiedere la stessa cosa.
 *
 * Tre e non uno perché le persone chiedono in modo diverso: chi vuole solo
 * guardare (proposte), chi sa spiegare a parole (chat), chi preferisce
 * rispondere a tre domande (guidato). Il modello dietro è lo stesso; cambia solo
 * come si raccoglie il contesto.
 */

import type { MessaggioChat } from '@wardrobe/contracts'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { api } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { capiDiVestizione, fotoDaMostrare } from '../src/dati/dominio'
import { colori, linee, ombre, raggi, spazi } from '../src/tema/tokens'
import {
  BadgeIa,
  BottonePrimario,
  BottoneSecondario,
  Icona,
  Pillola,
  Scheda,
  Segmenti,
  Toccabile,
} from '../src/ui/base'
import { Corpo, Forte, Titolo } from '../src/ui/testo'
import { Testata } from '../src/ui/testata'

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

export default function Suggeritore() {
  const parametri = useLocalSearchParams<{ chiedi?: string }>()
  const { suggerimenti, indice, vesti, salvaOutfit, chiediSuggerimenti, avvisa } = useArmadio()
  const [modo, setModo] = useState<Modo>(parametri.chiedi ? 'chat' : 'proposte')
  const [bozza, setBozza] = useState('')
  const [risposte, setRisposte] = useState<Record<string, string>>({})
  const [generato, setGenerato] = useState(false)
  const [salvati, setSalvati] = useState<string[]>([])
  const [inCorso, setInCorso] = useState(false)
  const [conversazione, setConversazione] = useState<MessaggioChat[]>([])
  const [storiaCaricata, setStoriaCaricata] = useState(false)

  // La chat è continua, non una sessione che si azzera aprendo lo schermo:
  // riprende dalla cronologia vera salvata sul backend, mai da un messaggio
  // di benvenuto inventato.
  useEffect(() => {
    void (async () => {
      try {
        const { messaggi } = await api.chat.elenca()
        setConversazione(messaggi)
      } catch {
        // Storia non disponibile: la chat resta usabile, riparte vuota.
      } finally {
        setStoriaCaricata(true)
      }
    })()
  }, [])

  async function invia(testo: string) {
    const pulito = testo.trim()
    if (!pulito || inCorso) return
    setBozza('')
    setInCorso(true)
    try {
      const risposta = await api.chat.invia({ testo: pulito })
      setConversazione((precedenti) => [...precedenti, risposta.utente, risposta.tela])
    } catch (errore) {
      avvisa(errore instanceof Error ? errore.message : 'Il messaggio non è arrivato allo stilista')
    } finally {
      setInCorso(false)
    }
  }

  // Se la domanda arrivava da «Oggi», il suggeritore la gira al modello una
  // volta sola, come un messaggio in chat vero e proprio — dopo aver caricato
  // la cronologia, altrimenti finirebbe davanti ai messaggi precedenti.
  useEffect(() => {
    if (!storiaCaricata) return
    const chiesto = parametri.chiedi?.trim()
    if (chiesto) void invia(chiesto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametri.chiedi, storiaCaricata])

  const complete = DOMANDE.every((domanda) => risposte[domanda.chiave])

  return (
    <View style={{ flex: 1 }}>
      <Testata occhiello="Il tuo stilista" titolo="Chiedi a Tela" indietro />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 60, gap: spazi.l }}
        showsVerticalScrollIndicator={false}
      >
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
                              borderRadius: 99,
                              marginTop: 7,
                              backgroundColor: colori.citron,
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
                    <View style={{ flexDirection: 'row', gap: spazi.s }}>
                      <BottonePrimario
                        testo="Provalo"
                        style={{ flex: 1 }}
                        onPress={() => {
                          vesti(proposta.vestizione)
                          router.push('/(tabs)/avatar')
                        }}
                      />
                      <BottoneSecondario
                        testo={salvati.includes(proposta.titolo) ? 'Salvato' : 'Salva'}
                        style={{ paddingHorizontal: 18 }}
                        onPress={
                          salvati.includes(proposta.titolo)
                            ? undefined
                            : () => {
                                setSalvati((precedenti) => [...precedenti, proposta.titolo])
                                void salvaOutfit(proposta.titolo, {
                                  vestizione: proposta.vestizione,
                                  origine: 'ia',
                                })
                              }
                        }
                      />
                    </View>
                  </View>
                </View>
              )
            })
          : null}

        {modo === 'chat' ? (
          <>
            {storiaCaricata && conversazione.length === 0 && !inCorso ? (
              <Corpo taglia={13} tono="debole" style={{ textAlign: 'center' }}>
                {"Scrivi per iniziare: questa chat resta qui anche se chiudi l'app."}
              </Corpo>
            ) : null}

            <View style={{ gap: 11 }}>
              {conversazione.map((messaggio) => {
                const daUtente = messaggio.ruolo === 'utente'
                return (
                  <View
                    key={messaggio.id}
                    style={{
                      alignSelf: daUtente ? 'flex-end' : 'flex-start',
                      maxWidth: '84%',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      backgroundColor: daUtente ? colori.inchiostro : colori.scheda,
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                      borderBottomLeftRadius: daUtente ? 22 : 6,
                      borderBottomRightRadius: daUtente ? 6 : 22,
                      gap: spazi.s,
                      ...ombre.bassa,
                    }}
                  >
                    {daUtente ? (
                      <Corpo taglia={14} scuro>
                        {messaggio.testo}
                      </Corpo>
                    ) : (messaggio.suggerimenti?.length ?? 0) > 0 ? (
                      // La risposta vera dello stilista: tutte le proposte che
                      // ha fatto, non solo la prima riassunta a caso.
                      messaggio.suggerimenti!.map((proposta) => (
                        <View key={proposta.titolo} style={{ gap: 4 }}>
                          <Forte taglia={14}>{`${proposta.titolo} · ${proposta.match}%`}</Forte>
                          {proposta.perche.map((motivo) => (
                            <Corpo key={motivo} taglia={13} tono="medio">
                              {`— ${motivo}`}
                            </Corpo>
                          ))}
                        </View>
                      ))
                    ) : (
                      <Corpo taglia={14}>Non ho trovato un outfit adatto con i capi che hai ora.</Corpo>
                    )}
                  </View>
                )
              })}

              {inCorso ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '84%',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: colori.scheda,
                    borderTopLeftRadius: 22,
                    borderTopRightRadius: 22,
                    borderBottomLeftRadius: 6,
                    borderBottomRightRadius: 22,
                    ...ombre.bassa,
                  }}
                >
                  <Corpo taglia={14} tono="debole">
                    Sto pensando…
                  </Corpo>
                </View>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
              {SPUNTI.map((spunto) => (
                <Pillola key={spunto} testo={spunto} onPress={() => invia(spunto)} />
              ))}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spazi.s,
                paddingLeft: 18,
                padding: 7,
                borderRadius: raggi.pillola,
                backgroundColor: colori.scheda,
                ...ombre.bassa,
              }}
            >
              <TextInput
                value={bozza}
                onChangeText={setBozza}
                onSubmitEditing={() => invia(bozza)}
                placeholder="Cena fuori, e fa freddo…"
                placeholderTextColor="rgba(21,21,26,0.4)"
                style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 14, color: colori.inchiostro }}
              />
              <Toccabile
                onPress={() => invia(bozza)}
                scala={0.92}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: raggi.pillola,
                  backgroundColor: colori.citron,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icona nome="freccia" misura={19} spessore={2.2} />
              </Toccabile>
            </View>
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
              citron={complete}
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
                <BottonePrimario
                  testo="Vedilo sull'avatar"
                  onPress={() => {
                    vesti(suggerimenti[0]!.vestizione)
                    router.push('/(tabs)/avatar')
                  }}
                />
              </Scheda>
            ) : null}
          </>
        ) : null}

        <Corpo taglia={11.5} tono="debole" style={{ textAlign: 'center', borderTopWidth: 1, borderTopColor: linee.tenue, paddingTop: spazi.m }}>
          Le proposte usano solo i capi che hai, e mai quelli in lavatrice.
        </Corpo>
      </ScrollView>
    </View>
  )
}
