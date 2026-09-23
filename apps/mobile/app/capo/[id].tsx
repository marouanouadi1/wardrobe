/**
 * Il dettaglio di un capo: la foto, cosa ha capito il modello, cosa ci sta bene.
 *
 * La disposizione è quella del deck: il cuore e il «···» **nella testata**, non
 * sopra la foto; il capo per intero (`contain`) invece che tagliato; i tre
 * stati come pillole, dove prima c'erano due interruttori che ne coprivano due.
 *
 * La parte importante è il riquadro «letto dalla foto». Mostra ogni attributo
 * con la sua confidenza, dipinge in pericolo quelli incerti, e li rende
 * toccabili per correggerli. È il patto con l'utente: il modello prova a
 * indovinare, ma non fa finta di sapere.
 *
 * La soglia dell'incertezza non è scritta qui — arriva da `@wardrobe/contracts`,
 * generata dal dominio Python.
 */

import { VALORI_STATO_CAPO, type AttributoCapo, type Capo } from '@wardrobe/contracts'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useArmadio } from '../../src/dati/archivio'
import {
  PALETTE_COLORI,
  STAGIONI,
  TIPI_CAPO,
  attributiIncerti,
  fotoDaMostrare,
  quandoUsato,
} from '../../src/dati/dominio'
import { ETICHETTE, colori, durate, linee, raggi, spazi, superfici, velo } from '../../src/tema/tokens'
import { BadgeIa, BottonePrimario, BottoneTondo, Campo, Pillola, Scheda, Toccabile } from '../../src/ui/base'
import { Attributo, Miniatura, SchedaFoto } from '../../src/ui/capi'
import { Foglio } from '../../src/ui/avviso'
import { Schermata, Testata } from '../../src/ui/guscio'
import { Caricamento, Vuoto } from '../../src/ui/stati'
import { Corpo, Forte, Titolo } from '../../src/ui/testo'

/** I campi che si correggono con un testo libero, non con una scelta chiusa. */
const ATTRIBUTI_LIBERI = new Set<AttributoCapo>(['materiale', 'fantasia', 'vestibilita', 'lavaggio'])

/** Il valore attuale di un attributo a testo libero, per precompilare il campo. */
function valoreLiberoAttuale(capo: Capo, attributo: AttributoCapo): string {
  switch (attributo) {
    case 'materiale':
      return capo.materiale ?? ''
    case 'fantasia':
      return capo.fantasia ?? ''
    case 'vestibilita':
      return capo.vestibilita ?? ''
    case 'lavaggio':
      return capo.lavaggio ?? ''
    default:
      return ''
  }
}

export default function DettaglioCapo() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const {
    indice,
    capi,
    pronto,
    cambiaPreferito,
    cambiaStato,
    indossaOggi,
    vestiSlot,
    correggi,
    aggiornaEtichette,
    aggiornaAppunti,
  } = useArmadio()
  const [attributoInModifica, setAttributoInModifica] = useState<AttributoCapo | null>(null)
  const [testoModifica, setTestoModifica] = useState('')
  const [nuovaEtichetta, setNuovaEtichetta] = useState('')
  const [menuAperto, setMenuAperto] = useState(false)
  const capo = id ? indice.get(id) : undefined

  // Prima di `pronto`, `indice` è ancora vuoto: senza questa guardia, aprendo
  // il link diretto a un capo (es. da una notifica, o ricaricando la pagina)
  // si vedeva per un istante «questo capo non c'è più» — un capo che c'è, ma
  // che l'armadio non ha ancora finito di caricare.
  if (!pronto) {
    return (
      <View style={{ flex: 1 }}>
        <Testata occhiello="Capo" titolo="" indietro />
        <Caricamento />
      </View>
    )
  }

  if (!capo) {
    return (
      <View style={{ flex: 1 }}>
        <Testata occhiello="Capo" titolo="Non trovato" indietro />
        <View style={{ paddingHorizontal: spazi.xl }}>
          <Vuoto titolo="Questo capo non c'è più" spiegazione="Potrebbe essere stato rimosso dall'armadio." />
        </View>
      </View>
    )
  }

  const incerti = attributiIncerti(capo)
  const confidenze = capo.analisi?.confidenze ?? {}
  const media =
    Object.values(confidenze).length > 0
      ? Math.round(
          Object.values(confidenze).reduce((somma, valore) => somma + (valore ?? 0), 0) /
            Object.values(confidenze).length,
        )
      : null

  const attributi: [AttributoCapo, string | null][] = [
    ['tipo', ETICHETTE.tipo[capo.tipo]],
    ['colore', capo.colore.nome],
    ['materiale', capo.materiale ?? null],
    ['fantasia', capo.fantasia ?? null],
    ['stagione', capo.stagione ? ETICHETTE.stagione[capo.stagione] : null],
    ['vestibilita', capo.vestibilita ?? null],
    ['lavaggio', capo.lavaggio ?? null],
  ]

  const altriCapi = capi.filter((altro) => altro.slot !== capo.slot).slice(0, 6)
  // «Segnato per oggi» si legge dal dato vero, non da uno stato locale: se
  // rientri nella schermata il segno è ancora lì.
  const messoOggi = capo.ultimo_uso?.slice(0, 10) === new Date().toISOString().slice(0, 10)

  return (
    <Schermata
      occhiello={ETICHETTE.tipo[capo.tipo]}
      titolo={capo.nome}
      indietro
      tavolozza="freddo"
      // Il cuore e il «···» stanno **nella testata**, come nel deck: sopra la
      // foto erano due bersagli appoggiati su un'immagine di cui non
      // conosciamo il contenuto — un capo bianco e il cuore spariva.
      azioni={
        <>
          <BottoneTondo
            nome="cuore"
            onPress={() => void cambiaPreferito(capo.id)}
            misura={38}
            misuraIcona={18}
            sfondo={superfici.vetroAlto}
            colore={capo.preferito ? colori.pericolo : velo(colori.inchiostro, 0.6)}
            pieno={capo.preferito}
          />
          <BottoneTondo
            nome="altro"
            onPress={() => setMenuAperto(true)}
            misura={38}
            misuraIcona={18}
            sfondo={superfici.vetroAlto}
            colore={colori.inchiostro}
          />
        </>
      }
      contentStyle={{ paddingHorizontal: 0 }}
    >
      <SchedaFoto
        raggio={raggi.grande - 2}
        ombra="alta"
        su="chiaro"
        sfondo={colori.fondoFoto}
        style={{ marginHorizontal: spazi.xl }}
      >
        {/* `contain`, non `cover`: è la stessa correzione della griglia
            dell'armadio — un cappotto lungo tagliato a metà non si riconosce,
            e questa è la schermata dove il capo si guarda davvero. */}
        <Image
          source={{ uri: fotoDaMostrare(capo) }}
          style={{ width: '100%', height: 330 }}
          contentFit="contain"
          transition={durate.breve}
        />
      </SchedaFoto>

      <View style={{ paddingHorizontal: spazi.xl, gap: spazi.m }}>
        <View>
          <Titolo taglia="testata">{capo.nome}</Titolo>
          <Corpo taglia="corpo" tono="tenue">
            {capo.brand ? `${capo.brand} · ` : ''}
            {`ultimo uso ${quandoUsato(capo.ultimo_uso)}`}
          </Corpo>
        </View>

        <BottonePrimario
          testo="Provalo addosso"
          freccia
          onPress={() => {
            vestiSlot(capo.id)
            router.push('/(tabs)/avatar')
          }}
        />

        {/* I **tre** stati come pillole, non due interruttori. Prima
            «In lavatrice» non era raggiungibile: un solo bersaglio faceva
            rimbalzare fra `pulito` e `da_lavare`. `in_lavaggio` è nell'enum
            del backend, l'armadio lo mostra fra i «da lavare» e `ETICHETTE`
            ha la sua resa italiana — ma **nessun punto dell'app lo impostava**:
            questa era l'unica schermata che chiama `cambiaStato` su un capo
            (`T-41`).
            L'elenco viene da `VALORI_STATO_CAPO`: non si ridigita. */}
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {VALORI_STATO_CAPO.map((valore) => (
            <Pillola
              key={valore}
              testo={ETICHETTE.stato[valore]}
              attiva={capo.stato === valore}
              onPress={() => void cambiaStato(capo.id, valore)}
            />
          ))}
        </View>

        <Scheda imbottitura={18} style={{ gap: spazi.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
            <BadgeIa testo="letto dalla foto" />
            {media !== null ? (
              <Forte taglia="micro" tono="debole" style={{ marginLeft: 'auto' }}>
                {media}% sicuro
              </Forte>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
            {attributi.map(([chiave, valore]) =>
              valore ? (
                <Attributo
                  key={chiave}
                  chiave={ETICHETTE.attributo[chiave]}
                  valore={valore}
                  incerto={incerti.includes(chiave)}
                  onPress={() => {
                    if (ATTRIBUTI_LIBERI.has(chiave)) {
                      setTestoModifica(valoreLiberoAttuale(capo, chiave))
                    }
                    setAttributoInModifica(attributoInModifica === chiave ? null : chiave)
                  }}
                />
              ) : null,
            )}
          </View>

          <Corpo taglia="micro" tono="debole">
            {incerti.length === 0
              ? 'Il modello è sicuro di tutto. Tocca un valore se vuoi cambiarlo.'
              : 'Tocca un valore per correggerlo. Quelli in rosso sono incerti: il modello preferisce chiedere.'}
          </Corpo>

          {attributoInModifica ? (
            <View style={{ gap: spazi.s, paddingTop: spazi.s, borderTopWidth: 1, borderTopColor: linee.tenue }}>
              <Forte taglia="minuto">{`Correggi ${ETICHETTE.attributo[attributoInModifica]}`}</Forte>

              {attributoInModifica === 'tipo' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {TIPI_CAPO.map((tipo) => (
                    <Pillola
                      key={tipo}
                      testo={ETICHETTE.tipo[tipo]}
                      attiva={tipo === capo.tipo}
                      onPress={() => {
                        void correggi(capo.id, 'tipo', tipo)
                        setAttributoInModifica(null)
                      }}
                    />
                  ))}
                </View>
              ) : attributoInModifica === 'stagione' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {STAGIONI.map((stagione) => (
                    <Pillola
                      key={stagione}
                      testo={ETICHETTE.stagione[stagione]}
                      attiva={stagione === capo.stagione}
                      onPress={() => {
                        void correggi(capo.id, 'stagione', stagione)
                        setAttributoInModifica(null)
                      }}
                    />
                  ))}
                </View>
              ) : attributoInModifica === 'colore' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {PALETTE_COLORI.map((voce) => (
                    <Toccabile
                      key={voce.nome}
                      onPress={() => {
                        void correggi(capo.id, 'colore', voce)
                        setAttributoInModifica(null)
                      }}
                      scala={0.94}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: raggi.pillola,
                        backgroundColor: voce.hex,
                        borderWidth: voce.hex === capo.colore.hex ? 3 : 1,
                        // Non il primario: questo segna la scelta dell'utente,
                        // non un valore letto dal modello — la stessa regola
                        // di `Pillola` (`ui/base.tsx`), che per lo stesso
                        // stato usa `colori.inchiostro`.
                        borderColor: voce.hex === capo.colore.hex ? colori.inchiostro : linee.chiara,
                      }}
                    >
                      <View />
                    </Toccabile>
                  ))}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: spazi.s }}>
                  <Campo
                    value={testoModifica}
                    onChangeText={setTestoModifica}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <BottonePrimario
                    testo="Salva"
                    compatto
                    onPress={() => {
                      const attributo = attributoInModifica
                      void correggi(capo.id, attributo, testoModifica.trim())
                      setAttributoInModifica(null)
                    }}
                  />
                </View>
              )}
            </View>
          ) : null}
        </Scheda>

        <Scheda imbottitura={16} style={{ gap: spazi.m }}>
          <Titolo taglia="guida">Etichette</Titolo>
          <Corpo taglia="micro" tono="debole">
            Solo tue: il modello non le legge dalla foto, ma lo stilista sì.
          </Corpo>

          {(capo.etichette ?? []).length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {(capo.etichette ?? []).map((etichetta) => (
                <Pillola
                  key={etichetta}
                  testo={`${etichetta} ×`}
                  attiva
                  onPress={() =>
                    void aggiornaEtichette(
                      capo.id,
                      (capo.etichette ?? []).filter((voce) => voce !== etichetta),
                    )
                  }
                />
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spazi.s }}>
            <Campo
              value={nuovaEtichetta}
              onChangeText={setNuovaEtichetta}
              placeholder="es. da lavoro, da viaggio…"
              onSubmitEditing={() => {
                const pulita = nuovaEtichetta.trim()
                setNuovaEtichetta('')
                if (!pulita || (capo.etichette ?? []).includes(pulita)) return
                void aggiornaEtichette(capo.id, [...(capo.etichette ?? []), pulita])
              }}
              style={{ flex: 1 }}
            />
          </View>

          <Corpo taglia="micro" tono="tenue">
            Appunti
          </Corpo>
          <Campo
            defaultValue={capo.appunti ?? ''}
            onEndEditing={(evento) => void aggiornaAppunti(capo.id, evento.nativeEvent.text)}
            placeholder="una nota libera su questo capo…"
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Scheda>

        {altriCapi.length > 0 ? (
          <>
            {/* Non è un abbinamento — sono solo altri capi di slot diverso,
                senza nessun giudizio dietro. «Ci sta bene con» prometteva un
                criterio che non c'è: la schermata dichiara di non fingere di
                sapere, e questo titolo faceva l'opposto. */}
            <Titolo taglia="sezione">Altri capi del tuo armadio</Titolo>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {altriCapi.map((altro) => (
                <Miniatura
                  key={altro.id}
                  capo={altro}
                  larghezza={100}
                  altezza={124}
                  onPress={() => router.push(`/capo/${altro.id}`)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>

      {/* Il menu «···» del deck. Tre delle sue voci non hanno un backend, e
          sono disegnate **spente con il loro perché** invece che omesse: un
          menu che nasconde ciò che non sa fare insegna che quella cosa non
          esiste, uno che la mostra spenta insegna che non esiste *ancora*.
          «Mettilo in un outfit» non c'è: nell'app farebbe esattamente ciò che
          fa «Provalo addosso» qui sopra — `vestiSlot` e via all'avatar — e un
          secondo bersaglio per la stessa chiamata è rumore, non una scelta. */}
      <Foglio
        visibile={menuAperto}
        titolo={capo.nome}
        sottotitolo={`${ETICHETTE.tipo[capo.tipo]} · ultimo uso ${quandoUsato(capo.ultimo_uso)}`}
        onChiudi={() => setMenuAperto(false)}
        voci={[
          {
            etichetta: messoOggi ? 'Già segnato per oggi' : 'Segna come indossato oggi',
            icona: 'spunta',
            onPress: messoOggi
              ? undefined
              : () => {
                  void indossaOggi(capo.id)
                  setMenuAperto(false)
                },
            perche: messoOggi ? "L'hai già segnato oggi." : undefined,
          },
          {
            etichetta: 'Rifai la foto',
            icona: 'fotocamera',
            perche: 'La foto di un capo non si può ancora cambiare.',
          },
          {
            etichetta: 'Non suggerirlo più',
            icona: 'occhioSpento',
            perche: 'Non si può ancora tenere un capo fuori dai suggerimenti.',
          },
          {
            etichetta: 'Elimina il capo',
            icona: 'cestino',
            pericolo: true,
            perche: 'Un capo non si può ancora eliminare.',
          },
        ]}
      />
    </Schermata>
  )
}
