/**
 * Il dettaglio di un capo: la foto, cosa ha capito il modello, cosa ci sta bene.
 *
 * La parte importante è il riquadro «letto dalla foto». Mostra ogni attributo
 * con la sua confidenza, dipinge in corallo quelli incerti, e li rende
 * toccabili per correggerli. È il patto con l'utente: il modello prova a
 * indovinare, ma non fa finta di sapere.
 *
 * La soglia dell'incertezza non è scritta qui — arriva da `@wardrobe/contracts`,
 * generata dal dominio Python.
 */

import type { AttributoCapo, Capo } from '@wardrobe/contracts'
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
import { ETICHETTE, colori, durate, linee, raggi, spazi, velo } from '../../src/tema/tokens'
import { BadgeIa, BottonePrimario, BottoneSecondario, BottoneTondo, Campo, Pillola, Scheda, Toccabile } from '../../src/ui/base'
import { Attributo, Miniatura, SchedaFoto } from '../../src/ui/capi'
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
  const velaturaSuFoto = velo(colori.scheda, 0.9)

  return (
    <Schermata occhiello={ETICHETTE.tipo[capo.tipo]} titolo={capo.nome} indietro contentStyle={{ paddingHorizontal: 0 }}>
      <SchedaFoto
        raggio={raggi.grande - 2}
        ombra="alta"
        sfondo={colori.fondoFoto}
        style={{ marginHorizontal: spazi.xl }}
      >
        <Image
          source={{ uri: fotoDaMostrare(capo) }}
          style={{ width: '100%', height: 330 }}
          contentFit="cover"
          transition={durate.breve}
        />
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: raggi.pillola,
            backgroundColor: velaturaSuFoto,
          }}
        >
          <Forte taglia={11}>{ETICHETTE.tipo[capo.tipo]}</Forte>
        </View>
        <View style={{ position: 'absolute', top: 12, right: 12 }}>
          <BottoneTondo
            nome="cuore"
            onPress={() => void cambiaPreferito(capo.id)}
            misura={38}
            misuraIcona={18}
            sfondo={velaturaSuFoto}
            colore={capo.preferito ? colori.corallo : 'rgba(21,21,26,0.6)'}
            pieno={capo.preferito}
          />
        </View>
      </SchedaFoto>

      <View style={{ paddingHorizontal: spazi.xl, gap: spazi.m }}>
        <View>
          <Titolo taglia={28}>{capo.nome}</Titolo>
          <Corpo taglia={13.5} tono="tenue">
            {capo.brand ? `${capo.brand} · ` : ''}
            {`ultimo uso ${quandoUsato(capo.ultimo_uso)}`}
          </Corpo>
        </View>

        <BottonePrimario
          testo="Provalo sull'avatar"
          freccia
          onPress={() => {
            vestiSlot(capo.id)
            router.push('/(tabs)/avatar')
          }}
        />

        {/* Due interruttori: l'etichetta dice l'azione quando sono spenti e
            conferma lo stato quando sono accesi. Il corallo è per il bucato,
            mai l'ambra: quella parla solo per l'IA. */}
        <View style={{ flexDirection: 'row', gap: spazi.s }}>
          <BottoneSecondario
            testo={messoOggi ? 'Segnato per oggi' : "L'ho messo oggi"}
            sfondo={messoOggi ? colori.inchiostro : undefined}
            colore={messoOggi ? colori.crema : undefined}
            style={{ flex: 1 }}
            onPress={messoOggi ? undefined : () => void indossaOggi(capo.id)}
          />
          <BottoneSecondario
            testo={capo.stato === 'pulito' ? 'Da lavare' : 'In lavatrice'}
            sfondo={capo.stato === 'pulito' ? undefined : colori.coralloTenue}
            style={{ flex: 1 }}
            onPress={() => void cambiaStato(capo.id, capo.stato === 'pulito' ? 'da_lavare' : 'pulito')}
          />
        </View>

        <Scheda imbottitura={18} style={{ gap: spazi.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
            <BadgeIa testo="letto dalla foto" />
            {media !== null ? (
              <Forte taglia={11.5} tono="debole" style={{ marginLeft: 'auto' }}>
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

          <Corpo taglia={11.5} tono="debole">
            {incerti.length === 0
              ? 'Il modello è sicuro di tutto. Tocca un valore se vuoi cambiarlo.'
              : 'Tocca un valore per correggerlo. Quelli in corallo sono incerti: il modello preferisce chiedere.'}
          </Corpo>

          {attributoInModifica ? (
            <View style={{ gap: spazi.s, paddingTop: spazi.s, borderTopWidth: 1, borderTopColor: linee.tenue }}>
              <Forte taglia={12.5}>{`Correggi ${ETICHETTE.attributo[attributoInModifica]}`}</Forte>

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
                        // Non l'ambra: questo segna la scelta dell'utente,
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
          <Titolo taglia={16}>Etichette</Titolo>
          <Corpo taglia={11.5} tono="debole">
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

          <Corpo taglia={11.5} tono="tenue">
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
            <Titolo taglia={19}>Altri capi del tuo armadio</Titolo>
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
    </Schermata>
  )
}
