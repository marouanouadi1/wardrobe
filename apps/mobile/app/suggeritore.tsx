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
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useArmadio, useVestiEVai } from '../src/dati/archivio'
import { type SceltaConversazione, useChat } from '../src/dati/chat'
import { capiDiVestizione, capiDisponibili, fotoDaMostrare, slotMancanti } from '../src/dati/dominio'
import { colori, durate, ETICHETTE, linee, raggi, spazi } from '../src/tema/tokens'
import {
  BadgeIa,
  BarraChiedi,
  BollaChat,
  BottonePrimario,
  BottoneSecondario,
  LinkTesto,
  Pillola,
  PuntiniAttesa,
  Scheda,
  Segmenti,
} from '../src/ui/base'
import { MotiviProposta, SchedaFoto } from '../src/ui/capi'
import { Schermata } from '../src/ui/guscio'
import { AttesaLunga, Caricamento, MESSAGGI_SUGGERIMENTI, Vuoto } from '../src/ui/stati'
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
  const { suggerimenti, indice, capi, pronto, suggerimentiInCorso, salvaOutfit, chiediSuggerimenti, avvisa } =
    useArmadio()
  // Stessa guardia di `app/(tabs)/oggi.tsx`: senza una combinazione
  // indossabile (`vestizione_indossabile`, `services/api/src/domain/wardrobe.py`)
  // il modo «guidato» chiamerebbe `/suggerimenti` solo per ricevere un 502.
  // `pronto` prima di guardare `capi`: a caricamento in corso `capi` è ancora
  // `[]`, e senza questa guardia il bottone diceva per un istante «aggiungi
  // prima un capo che manca» a chi l'armadio ce l'ha già completo.
  const mancanti = useMemo(() => (pronto ? slotMancanti(capiDisponibili(capi)) : []), [pronto, capi])
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

      {modo === 'proposte' && !pronto ? (
        // L'armadio sta ancora caricando: senza questo, la schermata restava
        // bianca fino a quando `capi`/`suggerimenti` non erano pronti.
        <Caricamento />
      ) : null}

      {modo === 'proposte' && pronto && suggerimenti.length === 0 ? (
        suggerimentiInCorso ? (
          // Lo stilista sta componendo — la stessa attesa di `app/(tabs)/oggi.tsx`,
          // sullo stesso endpoint.
          <Scheda imbottitura={24} style={{ alignItems: 'center', gap: spazi.m }}>
            <Titolo taglia={17}>Sto pensando a un outfit</Titolo>
            <AttesaLunga messaggi={MESSAGGI_SUGGERIMENTI} />
          </Scheda>
        ) : mancanti.length > 0 ? (
          <Vuoto
            titolo={
              mancanti.length === 1
                ? `Ti manca un ${ETICHETTE.slot[mancanti[0]!].toLowerCase()}`
                : 'Ti serve un sopra e un sotto'
            }
            spiegazione="Per comporre un outfit mi serve almeno un sopra e un sotto, oppure un abito."
          />
        ) : (
          // Prima non c'era nessuna via d'uscita da qui: arrivando da «Chiedi
          // tu a Wardrobe» (armadio.tsx) con `suggerimenti` ancora vuoto, la
          // scheda restava bianca — a differenza di Oggi, questa schermata non
          // chiede mai da sola allo stilista.
          <>
            <Vuoto
              titolo="Ancora nessuna proposta"
              spiegazione="Chiedimi un outfit e ti mostro qui le combinazioni che funzionano di più."
            />
            <BottonePrimario
              testo="Proponimi qualcosa"
              ambra
              onPress={() => void chiediSuggerimenti()}
            />
          </>
        )
      ) : null}

      {modo === 'proposte' && pronto
        ? suggerimenti.map((proposta) => {
            const capi = capiDiVestizione(proposta.vestizione, indice)
            const badge = <BadgeIa testo={`${proposta.match}%`} />
            return (
              <SchedaFoto key={proposta.titolo}>
                {capi[0] && fotoDaMostrare(capi[0]) ? (
                  <View>
                    <Image
                      source={{ uri: fotoDaMostrare(capi[0]) }}
                      style={{ width: '100%', height: 230, backgroundColor: colori.fondoFoto }}
                      contentFit="cover"
                      contentPosition={{ top: '20%', left: '50%' }}
                      transition={durate.breve}
                    />
                    <View style={{ position: 'absolute', top: 12, right: 12 }}>{badge}</View>
                  </View>
                ) : (
                  // Il match è l'informazione più importante della proposta:
                  // non deve dipendere dal primo capo avere una foto.
                  <View style={{ padding: 16, paddingBottom: 0 }}>{badge}</View>
                )}

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
                          backgroundColor: colori.fondoFoto,
                        }}
                        contentFit="cover"
                        transition={durate.breve}
                      />
                    ))}
                  </View>

                  <MotiviProposta motivi={proposta.perche} />

                  {/* «Salva» tiene la proposta senza doverla prima provare:
                      due tocchi in meno per chi ha già deciso. */}
                  <AzioniProposta {...provaEsalva(proposta)} />
                </View>
              </SchedaFoto>
            )
          })
        : null}

      {modo === 'chat' ? (
        <>
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
            testo={
              !complete
                ? 'Rispondi alle tre domande'
                : mancanti.length > 0
                  ? 'Aggiungi prima un capo che manca'
                  : 'Trova il mio outfit'
            }
            ambra={complete && mancanti.length === 0}
            caricando={suggerimentiInCorso}
            disabilitato={!complete || mancanti.length > 0 || suggerimentiInCorso}
            onPress={() => {
              setGenerato(true)
              void chiediSuggerimenti(
                `${risposte.occasione}, ${risposte.meteo?.toLowerCase()}, mi sento ${risposte.umore?.toLowerCase()}`,
              )
            }}
          />

          {suggerimentiInCorso ? (
            // Prima, fra il tocco e la risposta, non c'era nessun segnale:
            // il bottone restava toccabile e ripartiva se lo si premeva di
            // nuovo. Stessa attesa di Oggi, sullo stesso endpoint.
            <Scheda imbottitura={16} style={{ alignItems: 'center', gap: spazi.m }}>
              <AttesaLunga messaggi={MESSAGGI_SUGGERIMENTI} />
            </Scheda>
          ) : generato && suggerimenti[0] ? (
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
