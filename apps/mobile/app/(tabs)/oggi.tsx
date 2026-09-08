/**
 * Oggi: la schermata che risponde alla domanda per cui esiste l'app.
 *
 * Una proposta grande, due alternative, e una barra per dire la propria. La
 * proposta grande occupa lo spazio che merita perché il novanta per cento delle
 * mattine finisce lì: se serve scorrere per vederla, tanto valeva un elenco.
 */

import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { capiDiVestizione, capiDisponibili, daLavare, nomeDiBattesimo } from '../../src/dati/dominio'
import { useArmadio, useVestiEVai } from '../../src/dati/archivio'
import { parola } from '../../src/dati/formato'
import { colori, linee, ombre, raggi, spazi, velo } from '../../src/tema/tokens'
import { BadgeIa, BarraChiedi, Bolla, BottonePrimario, BottoneSecondario, BottoneTondo, Scheda, Toccabile } from '../../src/ui/base'
import { Corpo, Etichetta, Forte, Titolo } from '../../src/ui/testo'
import { Schermata } from '../../src/ui/guscio'
import { Vuoto } from '../../src/ui/stati'

const SCORCIATOIE = ['Ho una cena', 'Fa freddo', 'Solo capi puliti', 'Sorprendimi']

export default function Oggi() {
  const { suggerimenti, indice, profilo, capi, pronto, chiediSuggerimenti } = useArmadio()
  const vestiEVai = useVestiEVai()
  const [domanda, setDomanda] = useState('')
  const [scartati, setScartati] = useState<string[]>([])

  const disponibili = useMemo(() => capiDisponibili(capi), [capi])

  // Al primo avvio la proposta non c'è ancora: nessuno l'ha mai chiesta. Parte
  // solo a caricamento finito (`pronto`) e solo se c'è almeno un capo pulito:
  // chiederla a un armadio vuoto è una chiamata al modello che non può che
  // fallire — vedi `handlers/suggerimenti.py`, che la rifiuta comunque.
  // `suggerimenti.length` nelle dep fa rientrare l'effetto a chiamata riuscita
  // (ed esce subito); a chiamata fallita `suggerimenti` resta vuoto e nessuna
  // dep cambia, quindi non riparte da solo. Aggiungere il primo capo pulito fa
  // scattare la proposta subito, senza uscire e rientrare dalla tab.
  useEffect(() => {
    if (!pronto) return
    if (disponibili.length === 0) return
    if (suggerimenti.length > 0) return
    void chiediSuggerimenti()
  }, [pronto, disponibili.length, suggerimenti.length, chiediSuggerimenti])

  const vivi = suggerimenti.filter((s) => !scartati.includes(s.titolo))
  const principale = vivi[0] ?? suggerimenti[0]
  const alternative = vivi.slice(1, 3)

  // La copertina della proposta grande: il primo capo della vestizione, con la
  // stessa regola del suggeritore — se cambio proposta cambia anche la foto,
  // altrimenti il pulsante «cambia» sembrerebbe non funzionare.
  const copertina = principale ? capiDiVestizione(principale.vestizione, indice)[0] : undefined
  const inLavatrice = daLavare(indice.values())
  const nome = nomeDiBattesimo(profilo)
  const armadioVuoto = pronto && capi.length === 0

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
      {armadioVuoto ? (
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
        </>
      )}

      {principale ? (
        <View
          style={{
            borderRadius: raggi.grande,
            overflow: 'hidden',
            backgroundColor: colori.inchiostro,
            ...ombre.alta,
          }}
        >
          <Image
            source={{ uri: copertina?.foto.url ?? undefined }}
            style={{ width: '100%', height: 392, backgroundColor: copertina?.colore.hex }}
            contentFit="cover"
            contentPosition={{ top: '22%', left: '50%' }}
            transition={250}
          />
          <LinearGradient
            colors={['rgba(21,21,26,0)', 'rgba(21,21,26,0.88)']}
            locations={[0.34, 1]}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View style={{ position: 'absolute', top: 14, left: 14 }}>
            <BadgeIa testo={`match ${principale.match}%`} />
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, gap: spazi.s }}>
            <Etichetta taglia={11.5} colore="rgba(255,253,249,0.62)">
              La proposta di oggi
            </Etichetta>
            <Titolo taglia={29} colore={colori.scheda}>
              {principale.titolo}
            </Titolo>
            <Corpo taglia={13.5} colore="rgba(255,253,249,0.8)">
              {principale.perche[0]}
            </Corpo>
            <View style={{ flexDirection: 'row', gap: spazi.s, marginTop: spazi.s }}>
              <Toccabile
                onPress={() => vestiEVai(principale.vestizione)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 15,
                  borderRadius: raggi.pillola,
                  backgroundColor: colori.scheda,
                }}
              >
                <Forte taglia={14.5}>Vedila addosso</Forte>
              </Toccabile>
              <BottoneTondo
                nome="ricarica"
                misura={52}
                misuraIcona={19}
                sfondo="rgba(255,253,249,0.1)"
                colore={colori.scheda}
                bordo={velo(colori.scheda, 0.32)}
                onPress={() =>
                  setScartati((precedenti) =>
                    precedenti.length >= suggerimenti.length - 1 ? [] : [...precedenti, principale.titolo],
                  )
                }
              />
            </View>
          </View>
        </View>
      ) : null}

      {alternative.length > 0 ? (
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
                      source={{ uri: capo.foto.url ?? undefined }}
                      style={{
                        width: 34,
                        height: 52,
                        borderRadius: 11,
                        backgroundColor: capo.colore.hex,
                      }}
                      contentFit="cover"
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
