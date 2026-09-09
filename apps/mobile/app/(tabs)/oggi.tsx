/**
 * Oggi: la schermata che risponde alla domanda per cui esiste l'app.
 *
 * Una proposta grande, due alternative, e una barra per dire la propria. La
 * proposta grande occupa lo spazio che merita perché il novanta per cento delle
 * mattine finisce lì: se serve scorrere per vederla, tanto valeva un elenco.
 */

import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import {
  capiDiVestizione,
  capiDisponibili,
  daLavare,
  fotoDaMostrare,
  nomeDiBattesimo,
  slotMancanti,
} from '../../src/dati/dominio'
import { useArmadio, useVestiEVai } from '../../src/dati/archivio'
import { parola } from '../../src/dati/formato'
import { colori, durate, ETICHETTE, linee, ombre, raggi, spazi } from '../../src/tema/tokens'
import { BadgeIa, BarraChiedi, Bolla, BottonePrimario, BottoneSecondario, BottoneTondo, Scheda, Toccabile } from '../../src/ui/base'
import { SchedaFoto } from '../../src/ui/capi'
import { ScheletroProposta, ScheletroRigaProposta } from '../../src/ui/scheletri'
import { Corpo, Etichetta, Forte, Titolo } from '../../src/ui/testo'
import { Schermata } from '../../src/ui/guscio'
import { AttesaLunga, Errore, Vuoto } from '../../src/ui/stati'

const SCORCIATOIE = ['Ho una cena', 'Fa freddo', 'Solo capi puliti', 'Sorprendimi']

/**
 * `/suggerimenti` è una chiamata allo stilista (`services/api/src/handlers/
 * suggerimenti.py`), tipicamente più corta dell'analisi di una foto — non
 * c'è uno scontorno prima. Riusata da `app/suggeritore.tsx` per la stessa
 * attesa, sullo stesso endpoint.
 */
export const MESSAGGI_SUGGERIMENTI = [
  { dopoMs: 0, testo: 'Guardo cosa hai pulito e cosa hai messo di recente.' },
  { dopoMs: 4000, testo: 'Sto confrontando le combinazioni migliori.' },
  { dopoMs: 10000, testo: 'Ci vuole ancora qualche secondo.' },
] as const

export default function Oggi() {
  const { suggerimenti, indice, profilo, capi, pronto, erroreCaricamento, suggerimentiInCorso, chiediSuggerimenti } =
    useArmadio()
  const vestiEVai = useVestiEVai()
  const [domanda, setDomanda] = useState('')
  const [scartati, setScartati] = useState<string[]>([])

  const disponibili = useMemo(() => capiDisponibili(capi), [capi])
  // Gli slot che mancano per comporre anche un solo outfit — stessa regola
  // di `vestizione_indossabile` (`services/api/src/domain/wardrobe.py`), su
  // `disponibili` e non su `capi`: il backend applica lo stesso filtro sul
  // pulito prima di guardare gli slot.
  const mancanti = useMemo(() => slotMancanti(disponibili), [disponibili])

  // Al primo avvio la proposta non c'è ancora: nessuno l'ha mai chiesta. Parte
  // solo a caricamento finito (`pronto`) e solo se l'armadio ha una
  // combinazione indossabile (`mancanti.length === 0`): un top da solo, o
  // qualunque accoppiata che non copra sopra e sotto, è una chiamata al
  // modello che non può che fallire — vedi `vestizione_indossabile` in
  // `handlers/suggerimenti.py`, che scarta ogni proposta del genere.
  // `suggerimenti.length` nelle dep fa rientrare l'effetto a chiamata riuscita
  // (ed esce subito); a chiamata fallita `suggerimenti` resta vuoto e nessuna
  // dep cambia, quindi non riparte da solo. Il primo capo che completa una
  // combinazione (es. il primo paio di pantaloni con un top già pulito) fa
  // scattare la proposta subito, senza uscire e rientrare dalla tab.
  useEffect(() => {
    if (!pronto) return
    if (mancanti.length > 0) return
    if (suggerimenti.length > 0) return
    void chiediSuggerimenti()
  }, [pronto, mancanti.length, suggerimenti.length, chiediSuggerimenti])

  const vivi = suggerimenti.filter((s) => !scartati.includes(s.titolo))
  const principale = vivi[0] ?? suggerimenti[0]
  const alternative = vivi.slice(1, 3)

  // La copertina della proposta grande: il primo capo della vestizione, con la
  // stessa regola del suggeritore — se cambio proposta cambia anche la foto,
  // altrimenti il pulsante «cambia» sembrerebbe non funzionare.
  const copertina = principale ? capiDiVestizione(principale.vestizione, indice)[0] : undefined
  const inLavatrice = daLavare(indice.values())
  const nome = nomeDiBattesimo(profilo)
  // `erroreCaricamento` esclude questo ramo apposta: un server irraggiungibile
  // e un armadio vuoto per davvero producevano lo stesso `capi: []`, e
  // «Carica il primo capo» è il consiglio sbagliato quando il problema è la
  // rete (`src/dati/archivio.tsx`).
  const armadioVuoto = pronto && !erroreCaricamento && capi.length === 0

  function chiedi(testo: string) {
    router.push({ pathname: '/suggeritore', params: { chiedi: testo } })
  }

  return (
    <Schermata
      occhiello={`Buongiorno${nome ? `, ${nome}` : ''}`}
      titolo="Cosa metto oggi"
      fotoProfilo={profilo?.foto_url}
      tab
    >
      {erroreCaricamento ? (
        // Lo stato che prima non esisteva: un server irraggiungibile non è
        // «l'armadio è vuoto», ed è la causa più comune di «non vedo niente
        // quando apro Oggi».
        <Errore titolo="Non riesco a leggere il tuo armadio" spiegazione={erroreCaricamento} />
      ) : armadioVuoto ? (
        // Niente da proporre e niente da chiedere: la barra e le scorciatoie
        // presuppongono un armadio, e chiedere «cosa metto» senza capi non
        // porta da nessuna parte.
        <>
          <Vuoto
            titolo="Il tuo armadio è vuoto"
            spiegazione="Aggiungi il primo capo e ti dico cosa metterti."
          />
          <BottonePrimario testo="Carica il primo capo" onPress={() => router.push('/(tabs)/carica')} />
        </>
      ) : (
        <>
          {/* Chiedi tu: l'ingresso libero, in cima, perché la proposta automatica
              non può indovinare una cena a cui non è invitata. */}
          <BarraChiedi
            valore={domanda}
            onCambia={setDomanda}
            onInvia={() => chiedi(domanda)}
            placeholder="Dimmi tu: «cena fuori, ho freddo»"
          />

          <ScorrimentoScorciatoie onScegli={chiedi} />

          {pronto && disponibili.length === 0 ? (
            <Vuoto
              titolo="Niente di pulito da proporre"
              spiegazione="Tutti i tuoi capi sono in lavatrice: appena tornano puliti chiedo di nuovo."
            />
          ) : null}

          {pronto && disponibili.length > 0 && mancanti.length > 0 ? (
            <>
              <Vuoto
                titolo={
                  mancanti.length === 1
                    ? `Ti manca un ${ETICHETTE.slot[mancanti[0]!].toLowerCase()}`
                    : 'Ti serve un sopra e un sotto'
                }
                spiegazione="Per comporre un outfit mi serve almeno un sopra e un sotto, oppure un abito."
              />
              <BottonePrimario testo="Aggiungi un capo" onPress={() => router.push('/(tabs)/carica')} />
            </>
          ) : null}
        </>
      )}

      {!pronto ? (
        // Il primo momento in assoluto: la forma della proposta, prima
        // ancora di sapere se ce ne sarà una. È lo scheletro che mancava —
        // prima di questo, la schermata restava vuota finché non arrivava
        // tutto insieme.
        <ScheletroProposta />
      ) : principale ? (
        // Il capo intero, scontornato, su fondo chiaro — non più ritagliato
        // su un fondo scuro. Uno sfondo trasparente aderisce solo se lo
        // sfondo dietro è `colori.fondoFoto` (`tokens.ts`); su `inchiostro`
        // il capo galleggiava tagliato sul nero. L'altezza (330) è la stessa
        // di `ScheletroProposta` (`ui/scheletri.tsx`): lo scambio non salta.
        <SchedaFoto raggio={raggi.grande} ombra="alta">
          <Image
            source={{ uri: copertina ? fotoDaMostrare(copertina) : undefined }}
            style={{ width: '100%', height: 330, backgroundColor: colori.fondoFoto }}
            contentFit="contain"
            transition={durate.breve}
          />
          <View style={{ position: 'absolute', top: 14, left: 14 }}>
            <BadgeIa testo={`match ${principale.match}%`} />
          </View>
          <View style={{ padding: 18, gap: spazi.s }}>
            <Etichetta taglia={11.5} tono="tenue">
              La proposta di oggi
            </Etichetta>
            <Titolo taglia={29}>{principale.titolo}</Titolo>
            <Corpo taglia={13.5} tono="medio">
              {principale.perche[0]}
            </Corpo>
            <View style={{ flexDirection: 'row', gap: spazi.s, marginTop: spazi.s }}>
              <BottonePrimario
                testo="Vedila addosso"
                style={{ flex: 1 }}
                onPress={() => vestiEVai(principale.vestizione)}
              />
              <BottoneTondo
                nome="ricarica"
                misura={52}
                misuraIcona={19}
                // Non ambra: questo pulsante scorre fra proposte già arrivate,
                // non fa parlare il modello di nuovo — la regola di `tokens.ts`.
                sfondo={linee.tenue}
                colore={colori.inchiostro}
                onPress={() =>
                  setScartati((precedenti) =>
                    precedenti.length >= suggerimenti.length - 1 ? [] : [...precedenti, principale.titolo],
                  )
                }
              />
            </View>
          </View>
        </SchedaFoto>
      ) : suggerimentiInCorso ? (
        // La seconda attesa, distinta dalla prima: l'archivio è già pronto,
        // ora è lo stilista (`POST /suggerimenti`, una chiamata LLM) a
        // comporre la proposta. `AttesaLunga` è onesta sul fatto che non ci
        // sono fasi osservabili — la stessa scelta di `carica.tsx` per
        // l'analisi di una foto — e qui l'ambra è legittima: è il modello che
        // sta parlando, non un dato che arriva.
        <Scheda imbottitura={24} style={{ alignItems: 'center', gap: spazi.m }}>
          <Titolo taglia={17}>Sto pensando a cosa metterti</Titolo>
          <AttesaLunga messaggi={MESSAGGI_SUGGERIMENTI} />
        </Scheda>
      ) : null}

      {!pronto ? (
        <>
          <ScheletroRigaProposta />
          <ScheletroRigaProposta />
        </>
      ) : alternative.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
            <Titolo taglia={19} style={{ flex: 1 }}>
              Altre due strade
            </Titolo>
            <Toccabile onPress={() => router.push('/suggeritore')} scala={0}>
              <Forte taglia={13} colore={colori.ambraMedio}>
                Chiedi tu →
              </Forte>
            </Toccabile>
          </View>

          {alternative.map((proposta) => {
            const capi = capiDiVestizione(proposta.vestizione, indice)
            return (
              <Toccabile
                key={proposta.titolo}
                onPress={() => vestiEVai(proposta.vestizione)}
                scala={0.985}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: 12,
                  borderRadius: raggi.medioAlto,
                  backgroundColor: colori.scheda,
                  ...ombre.bassa,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {capi.slice(0, 3).map((capo) => (
                    <Image
                      key={capo.id}
                      source={{ uri: fotoDaMostrare(capo) }}
                      style={{
                        width: 34,
                        height: 52,
                        borderRadius: 11,
                        backgroundColor: colori.fondoFoto,
                      }}
                      contentFit="cover"
                      transition={durate.breve}
                    />
                  ))}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Titolo taglia={16.5}>{proposta.titolo}</Titolo>
                  <Corpo taglia={12.5} tono="tenue" numberOfLines={2}>
                    {proposta.perche[0]}
                  </Corpo>
                </View>
                <BadgeIa testo={`${proposta.match}%`} tenue />
              </Toccabile>
            )
          })}
        </>
      ) : null}

      {/* Il promemoria della lavatrice: chiude il cerchio fra «cosa metto» e
          «cosa ho disponibile», ed è il motivo per cui i suggerimenti non
          propongono capi sporchi. Con la lavatrice vuota la scheda non ha
          niente da dire, e sparisce. */}
      {inLavatrice > 0 ? (
        <Scheda imbottitura={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Bolla nome="ricarica" sfondo={linee.tenue} colore={colori.inchiostro} />
          <View style={{ flex: 1 }}>
            <Titolo taglia={17}>
              {`Hai ${parola(inLavatrice, 'un capo', `${inLavatrice} capi`)} in lavatrice`}
            </Titolo>
            <Corpo taglia={12.5} tono="tenue">
              Li escludo dai suggerimenti finché non tornano puliti.
            </Corpo>
          </View>
          <BottoneSecondario
            testo="Vedi"
            onPress={() => router.push({ pathname: '/(tabs)/armadio', params: { stato: 'da_lavare' } })}
          />
        </Scheda>
      ) : null}
    </Schermata>
  )
}

function ScorrimentoScorciatoie({ onScegli }: { onScegli: (testo: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
      {SCORCIATOIE.map((testo) => (
        <Toccabile
          key={testo}
          onPress={() => onScegli(testo)}
          scala={0.95}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: raggi.pillola,
            borderWidth: 1,
            borderColor: linee.chiara,
          }}
        >
          <Forte taglia={12.5} tono="medio">
            {testo}
          </Forte>
        </Toccabile>
      ))}
    </ScrollView>
  )
}
