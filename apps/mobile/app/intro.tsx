/**
 * L'apertura: i tre passi `welcome`, `provalo`, `chiedi` del deck.
 *
 * **Erano due, con due foto a tutto schermo e la scritta «wardrobe».** Il
 * redesign le aveva saltate: la fase 4 del piano diceva «onboarding, profilo,
 * impostazioni» e ne è stata fatta solo la seconda metà, senza che nessun
 * rapporto lo dicesse. Questa è la prima cosa che si vede aprendo l'app, e
 * finché è rimasta indietro tutto il resto sembrava non essere successo.
 *
 * Le immagini vengono **dal deck**, copiate in `assets/intro/`: la felpa, i
 * pantaloni e le ciabatte della stanga, e l'omino del passo 2. Non sono
 * sagome ridisegnate — sono gli stessi file.
 *
 * Quello che il deck promette e l'app non sa ancora fare non è stato
 * cancellato né reso toccabile a vuoto: il terzo passo dice «Crea il mio
 * account» e porta a `registrati`, che esiste. È il solo pezzo di queste tre
 * schermate che non descriva qualcosa di già costruito.
 */

import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Animated, BackHandler, Easing, View, useWindowDimensions } from 'react-native'
import { segnaIntroVista } from '../src/dati/intro'
import { colori, linee, raggi, spazi, testoSu, velo } from '../src/tema/tokens'
import {
  BollaChat,
  BottoneIndietro,
  BottonePrimario,
  Icona,
  LinkTesto,
  Scheda,
  Toccabile,
} from '../src/ui/base'
import { SfondoAura } from '../src/ui/guscio'
import { Corpo, Etichetta, Forte, Titolo } from '../src/ui/testo'

const FELPA = require('../assets/intro/felpa-blu-con-cappuccio.png') as number
const PANTALONI = require('../assets/intro/pantaloni-grigi-dritti.png') as number
const CIABATTE = require('../assets/intro/ciabatte-blu-tre-strisce.png') as number
const OMINO = require('../assets/intro/omino-fronte.png') as number

/** La stanga: i capi appesi scorrono lenti verso sinistra, in loop.
 *  Sei tessere e non tre, come nel deck: la serie è **doppia**, così a metà
 *  corsa l'animazione ricomincia e il taglio non si vede. */
const APPESI = [
  { foto: FELPA, larghezza: 136 },
  { foto: PANTALONI, larghezza: 120 },
  { foto: CIABATTE, larghezza: 112 },
] as const

const DISTANZA_APPESI = 16
const LARGHEZZA_SERIE = APPESI.reduce((t, c) => t + c.larghezza + DISTANZA_APPESI, 0)

/** La gruccia sopra ogni tessera: lo stesso tracciato del deck. */
function Gruccia() {
  return (
    <View style={{ alignItems: 'center', marginBottom: -3 }}>
      <Image
        source={{
          uri:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 30" width="16" height="20"><path d="M12 30V10a4 4 0 1 1 4-4" fill="none" stroke="${testoSu.chiaro.debole}" stroke-width="1.6" stroke-linecap="round"/></svg>`,
            ),
        }}
        style={{ width: 16, height: 20 }}
      />
    </View>
  )
}

function Stanga() {
  // `useState` con inizializzatore e non `useRef(...).current`: stessa
  // scelta di `PistaIndeterminata` (`ui/stati.tsx`), per la stessa regola
  // (`react-hooks/refs` vieta di leggere una ref durante il render).
  const [scorrimento] = useState(() => new Animated.Value(0))

  useEffect(() => {
    // 26 secondi per una serie, come il deck. `useNativeDriver` perché è una
    // sola `translateX`: senza, l'animazione passa dal thread JS e si
    // interrompe ogni volta che la schermata fa qualcos'altro.
    const corsa = Animated.loop(
      Animated.timing(scorrimento, {
        toValue: -LARGHEZZA_SERIE,
        duration: 26000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    corsa.start()
    return () => corsa.stop()
  }, [scorrimento])

  return (
    <View style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 74 }}>
      {/* La sbarra su cui i capi sono appesi. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 83,
          height: 2,
          borderRadius: 2,
          backgroundColor: linee.chiara,
        }}
      />
      <Animated.View
        style={{
          flexDirection: 'row',
          gap: DISTANZA_APPESI,
          paddingLeft: 26,
          transform: [{ translateX: scorrimento }],
        }}
      >
        {[...APPESI, ...APPESI].map((capo, indice) => (
          <View key={indice} style={{ width: capo.larghezza }}>
            <Gruccia />
            <Scheda
              vetro
              imbottitura={0}
              style={{ height: 176, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              <Image source={capo.foto} style={{ width: '88%', height: '88%' }} contentFit="contain" />
            </Scheda>
          </View>
        ))}
      </Animated.View>
    </View>
  )
}

/** Il passo 2: l'omino con addosso i capi, e due targhette. */
function Avatar() {
  return (
    <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={OMINO} style={{ width: '62%', height: '100%' }} contentFit="contain" />
      {/* `right: 0` e non un margine: la targhetta è più larga di mezzo
          schermo, e ancorandola al centro usciva dal bordo destro. */}
      <View style={{ position: 'absolute', top: '14%', right: 0, maxWidth: '82%' }}>
        <Targhetta testo="AVATAR 3D · GIRALO COL DITO" />
      </View>
      <View style={{ position: 'absolute', bottom: '16%', left: 0 }}>
        <Targhetta testo="LA TUA TAGLIA" />
      </View>
    </View>
  )
}

function Targhetta({ testo }: { testo: string }) {
  return (
    <Scheda vetro imbottitura={0} style={{ paddingHorizontal: 11, paddingVertical: 7 }}>
      <Etichetta taglia={10}>{testo}</Etichetta>
    </Scheda>
  )
}

/** Il passo 3: due battute di chat e la proposta, come nel deck. */
function Chat() {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        justifyContent: 'center',
        gap: spazi.s,
        // Le bolle stanno dentro i margini della schermata: senza, la bolla
        // dell'utente usciva dal bordo destro e quella di Aura da sinistro.
        paddingHorizontal: 26,
      }}
    >
      <BollaChat daUtente>
        <Corpo taglia={14} su="scuro">
          Cena fuori stasera, quindici gradi. Cosa mi metto?
        </Corpo>
      </BollaChat>

      <BollaChat daUtente={false}>
        <View style={{ gap: spazi.m }}>
          <Corpo taglia={14}>
            La felpa blu coi pantaloni grigi regge bene quindici gradi. Le ciabatte no: stasera
            lascerei una scarpa chiusa.
          </Corpo>
          <View style={{ gap: spazi.s }}>
            <Etichetta taglia={10} tono="debole">
              PROPOSTA
            </Etichetta>
            <View style={{ flexDirection: 'row', gap: spazi.s }}>
              {[FELPA, PANTALONI].map((foto, indice) => (
                <View
                  key={indice}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: raggi.piccolo,
                    // Una velatura d'inchiostro, non di bianco: la bolla
                    // di Aura è già bianca opaca, e un velo bianco su
                    // bianco non si vede — le tessere sparivano.
                    backgroundColor: linee.tenue,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Image source={foto} style={{ width: '84%', height: '84%' }} contentFit="contain" />
                </View>
              ))}
              {/* La casella tratteggiata: il deck la usa per dire «qui manca
                  una scarpa», che è il punto della risposta. */}
              <View
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: raggi.piccolo,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: linee.chiara,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <Icona nome="piu" misura={17} colore={testoSu.chiaro.debole} spessore={1.9} />
                <Etichetta taglia={9} tono="debole">
                  SCARPA
                </Etichetta>
              </View>
            </View>
          </View>
        </View>
      </BollaChat>
    </View>
  )
}

const PASSI = [
  {
    occhiello: 'AURA',
    titolo: 'Il tuo armadio,\na portata di mano.',
    corpo: 'Lo fotografi una volta. Poi è lui a dirti cosa metterti.',
    azione: 'Guarda come funziona',
    Scena: Stanga,
  },
  {
    occhiello: 'PROVA VIRTUALE',
    titolo: 'Provali addosso,\nsenza provarli.',
    corpo:
      "Dici una volta la tua taglia e com'è fatto il tuo corpo. Da lì ogni capo che fotografi te lo ritrovi addosso, da girare con un dito.",
    azione: 'Continua',
    Scena: Avatar,
  },
  {
    occhiello: 'IL TUO STILISTA',
    titolo: 'Non sai cosa metterti?\nChiedilo.',
    corpo:
      "Racconti l'occasione e il tempo che fa. Aura risponde con outfit fatti dei capi che hai già — e ti dice anche cosa manca.",
    azione: 'Crea il mio account',
    Scena: Chat,
  },
] as const

export default function Intro() {
  const [passo, setPasso] = useState(0)
  const { height } = useWindowDimensions()
  const corrente = PASSI[passo]!
  const ultimo = passo === PASSI.length - 1

  // Il tasto indietro hardware di Android: senza questo, dal secondo passo in
  // poi esce dall'app invece di tornare indietro — non c'è un gesto
  // predittivo a cui appoggiarsi (`app.json` ha
  // `predictiveBackGestureEnabled: false`).
  useEffect(() => {
    if (passo === 0) return
    const sottoscrizione = BackHandler.addEventListener('hardwareBackPress', () => {
      setPasso((precedente) => Math.max(0, precedente - 1))
      return true
    })
    return () => sottoscrizione.remove()
  }, [passo])

  function vai(dove: '/accedi' | '/registrati') {
    // Segna l'intro come vista prima di uscire, da qualunque porta: senza,
    // `index.tsx` la rimostra a ogni apertura finché non c'è un token.
    void segnaIntroVista()
    router.push(dove)
  }

  return (
    <View style={{ flex: 1, backgroundColor: colori.sfondo }}>
      <SfondoAura tavolozza="oro" />

      <View style={{ flex: 1, paddingTop: Math.max(height * 0.06, 44) }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 26, minHeight: 34 }}>
          {passo > 0 ? <BottoneIndietro onPress={() => setPasso(passo - 1)} /> : null}
        </View>

        <corrente.Scena />

        {/* La sfumatura sotto la scena: il testo deve restare leggibile anche
            quando un capo della stanga ci passa sotto. */}
        <LinearGradient
          colors={[velo(colori.sfondo, 0), velo(colori.sfondo, 0.9)]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 }}
          pointerEvents="none"
        />

        <View style={{ paddingHorizontal: 26, paddingBottom: 34, gap: spazi.s }}>
          <View style={{ flexDirection: 'row', gap: 5, marginBottom: 11 }}>
            {PASSI.map((_, indice) => (
              <Toccabile
                key={indice}
                scala={0}
                haptic={false}
                hitSlop={8}
                onPress={indice < passo ? () => setPasso(indice) : undefined}
                style={{
                  height: 3,
                  borderRadius: raggi.pillola,
                  width: indice === passo ? 22 : 9,
                  backgroundColor: indice === passo ? colori.inchiostro : linee.chiara,
                }}
              >
                <View />
              </Toccabile>
            ))}
          </View>

          <Etichetta taglia={12}>{corrente.occhiello}</Etichetta>

          <Titolo taglia="eroe" style={{ letterSpacing: -1.3, lineHeight: 36 }}>
            {corrente.titolo}
          </Titolo>

          <Corpo taglia="guida" tono="medio" style={{ maxWidth: 330 }}>
            {corrente.corpo}
          </Corpo>

          <BottonePrimario
            testo={corrente.azione}
            style={{ marginTop: spazi.m }}
            onPress={() => (ultimo ? vai('/registrati') : setPasso(passo + 1))}
          />

          <LinkTesto onPress={() => vai('/accedi')}>
            <Corpo taglia={14} tono="tenue">
              {'Hai già un account? '}
              <Forte taglia={14} colore={colori.primario}>
                Accedi
              </Forte>
            </Corpo>
          </LinkTesto>
        </View>
      </View>
    </View>
  )
}
