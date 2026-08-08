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
import { useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { capiDiVestizione } from '../../src/dati/dominio'
import { useArmadio } from '../../src/dati/archivio'
import { colori, linee, ombre, raggi, spazi } from '../../src/tema/tokens'
import { BadgeIa, Bolla, BottoneSecondario, Icona, Scheda, Toccabile } from '../../src/ui/base'
import { Avviso } from '../../src/ui/avviso'
import { Corpo, Etichetta, Forte, Titolo } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

const SCORCIATOIE = ['Ho una cena', 'Fa freddo', 'Solo capi puliti', 'Sorprendimi']

export default function Oggi() {
  const { suggerimenti, indice, profilo, vesti } = useArmadio()
  const [domanda, setDomanda] = useState('')
  const [scartati, setScartati] = useState<string[]>([])

  const vivi = suggerimenti.filter((s) => !scartati.includes(s.titolo))
  const principale = vivi[0] ?? suggerimenti[0]
  const alternative = vivi.slice(1, 3)

  // La copertina della proposta grande: il primo capo della vestizione, con la
  // stessa regola del suggeritore — se cambio proposta cambia anche la foto,
  // altrimenti il pulsante «cambia» sembrerebbe non funzionare.
  const copertina = principale ? capiDiVestizione(principale.vestizione, indice)[0] : undefined
  const daLavare = Array.from(indice.values()).filter((capo) => capo.stato !== 'pulito').length

  function chiedi(testo: string) {
    router.push({ pathname: '/suggeritore', params: { chiedi: testo } })
  }

  return (
    <View style={{ flex: 1 }}>
      <Testata
        occhiello={`Buongiorno${profilo?.nome ? `, ${profilo.nome.split(' ')[0]}` : ''}`}
        titolo="Cosa metto oggi"
        fotoProfilo={profilo?.foto_url}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 130, gap: spazi.l }}
        showsVerticalScrollIndicator={false}
      >
        <Avviso />

        {/* Chiedi tu: l'ingresso libero, in cima, perché la proposta automatica
            non può indovinare una cena a cui non è invitata. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spazi.s,
            paddingLeft: spazi.l,
            padding: 7,
            borderRadius: raggi.pillola,
            backgroundColor: colori.scheda,
            ...ombre.scheda,
          }}
        >
          <Icona nome="scintilla" misura={17} colore={colori.oliva} />
          <TextInput
            value={domanda}
            onChangeText={setDomanda}
            onSubmitEditing={() => chiedi(domanda)}
            placeholder="Dimmi tu: «cena fuori, ho freddo»"
            placeholderTextColor="rgba(21,21,26,0.4)"
            style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 14, color: colori.inchiostro }}
          />
          <Toccabile
            onPress={() => chiedi(domanda)}
            scala={0.9}
            style={{
              width: 42,
              height: 42,
              borderRadius: raggi.pillola,
              backgroundColor: colori.citron,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icona nome="freccia" misura={18} spessore={2.2} />
          </Toccabile>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {SCORCIATOIE.map((testo) => (
            <Toccabile
              key={testo}
              onPress={() => chiedi(testo)}
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
                  onPress={() => {
                    vesti(principale.vestizione)
                    router.push('/(tabs)/avatar')
                  }}
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
                <Toccabile
                  onPress={() =>
                    setScartati((precedenti) =>
                      precedenti.length >= suggerimenti.length - 1 ? [] : [...precedenti, principale.titolo],
                    )
                  }
                  scala={0.92}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: raggi.pillola,
                    borderWidth: 1,
                    borderColor: 'rgba(255,253,249,0.32)',
                    backgroundColor: 'rgba(255,253,249,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icona nome="ricarica" misura={19} colore={colori.scheda} />
                </Toccabile>
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
                <Forte taglia={13} colore={colori.oliva}>
                  Chiedi tu →
                </Forte>
              </Toccabile>
            </View>

            {alternative.map((proposta) => {
              const capi = capiDiVestizione(proposta.vestizione, indice)
              return (
                <Toccabile
                  key={proposta.titolo}
                  onPress={() => {
                    vesti(proposta.vestizione)
                    router.push('/(tabs)/avatar')
                  }}
                  scala={0.985}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 12,
                    borderRadius: raggi.medio + 4,
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
        {daLavare > 0 ? (
          <Scheda imbottitura={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Bolla nome="ricarica" sfondo="rgba(21,21,26,0.06)" tinta={colori.inchiostro} />
            <View style={{ flex: 1 }}>
              <Titolo taglia={17}>
                {daLavare === 1 ? 'Hai un capo in lavatrice' : `Hai ${daLavare} capi in lavatrice`}
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
      </ScrollView>
    </View>
  )
}
