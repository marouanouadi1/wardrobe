/**
 * Gli scheletri di caricamento: la sagoma di ciò che sta arrivando, al posto di
 * uno spinner che non dice dove guarderai.
 *
 * **Pulsazione d'opacità, non uno sweep** con `expo-linear-gradient`. Non è una
 * questione di costo — una griglia di scheletri si regge benissimo — ma di
 * palette. Uno sweep è una luce che passa, e una luce deve essere più chiara
 * del blocco che attraversa. Qui i fondi sono `#F2EEE7` e le schede `#FFFDF9`:
 * sopra al secondo un «più chiaro» non esiste, e un riflesso che per farsi
 * vedere deve andare verso lo scuro non sembra una luce, sembra un'ombra che
 * passa. La pulsazione invece si comporta identica su entrambi i fondi, perché
 * è lo stesso velo d'inchiostro che cambia densità.
 *
 * C'è una seconda ragione, di grammatica. Lo sweep in quest'app è già preso: è
 * la barra di `AttesaLunga` (`ui/stati.tsx`), in ambra, e vuol dire una cosa
 * sola — il modello di visione o lo stilista stanno lavorando. La pulsazione
 * grigia vuol dire l'altra — stanno arrivando dei dati. Se le due attese si
 * somigliassero, il segnale ambra smetterebbe di significare qualcosa.
 *
 * Da lì discende l'invariante di questo file, verificabile con un grep:
 * **`colori.ambra` non compare mai qui**, nemmeno negli scheletri delle
 * schermate che poi mostreranno una proposta dell'IA. Quando l'attesa è
 * davvero il modello, la schermata mostra `AttesaLunga` — non tinge lo
 * scheletro. `app/(tabs)/oggi.tsx` ha le due attese distinte e in sequenza:
 * `pronto` è l'archivio che si carica (scheletro), `chiediSuggerimenti` è il
 * modello che compone (`AttesaLunga`).
 *
 * `Animated`, non Reanimated, per la ragione già scritta in `ui/base.tsx`.
 */

import { useEffect, useState } from 'react'
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import { colori, curve, durate, griglie, ombre, raggi, spazi, superfici } from '../tema/tokens'
import { SchedaFoto } from './capi'
import { useFondo, type Su } from './fondo'

/**
 * Il rettangolo che respira: la sola forma da cui sono fatti tutti gli
 * scheletri qui sotto.
 *
 * Esportato per costruire uno scheletro nuovo *in questo file*. Una schermata
 * che ne accosta due a mano sta reinventando una forma inline — se manca uno
 * scheletro, si aggiunge qui un composto con un nome, non nella schermata.
 */
export function Blocco({
  larghezza = '100%',
  altezza,
  raggio = raggi.piccolo,
  su,
  style,
}: {
  larghezza?: DimensionValue
  altezza?: DimensionValue
  raggio?: number
  su?: Su
  style?: StyleProp<ViewStyle>
}) {
  const ereditato = useFondo()
  const fondo = su ?? ereditato
  // `useState` con inizializzatore, non `useRef(...).current`: stessa scelta
  // di `PuntiniAttesa` e `AttesaLunga`, per la stessa regola (`react-hooks/refs`).
  const [pulsazione] = useState(() => new Animated.Value(1))

  useEffect(() => {
    const animazione = Animated.loop(
      Animated.sequence([
        Animated.timing(pulsazione, {
          toValue: 0.45,
          duration: durate.respiro,
          easing: curve.respiro,
          useNativeDriver: true,
        }),
        Animated.timing(pulsazione, {
          toValue: 1,
          duration: durate.respiro,
          easing: curve.respiro,
          useNativeDriver: true,
        }),
      ]),
    )
    animazione.start()
    return () => animazione.stop()
  }, [pulsazione])

  // Nessun `onLayout` e nessuna condizione davanti all'`Animated.View`: è la
  // trappola documentata in `ui/stati.tsx` — un'animazione avviata col driver
  // nativo su una vista non ancora sullo schermo non ci arriva mai. La
  // pulsazione non ha bisogno di misurare niente, a differenza di uno sweep.
  return (
    <Animated.View
      style={[
        {
          width: larghezza,
          height: altezza,
          borderRadius: raggio,
          backgroundColor: superfici.scheletro[fondo === 'scuro' ? 'scuro' : 'chiaro'],
          opacity: pulsazione,
        },
        style,
      ]}
    />
  )
}

/**
 * La proposta grande di Oggi: la foto, e sotto la fascia di testo.
 *
 * Dentro la stessa `SchedaFoto` della card vera (`app/(tabs)/oggi.tsx`), con
 * lo stesso `padding`/`gap`/altezza del bottone: non un'approssimazione della
 * forma, la stessa forma con rettangoli al posto del contenuto. `altezzaFoto`
 * di default è la stessa della foto vera — non è un numero indovinato, è
 * l'unico modo perché lo scambio scheletro→contenuto non salti.
 */
export function ScheletroProposta({
  altezzaFoto = 260,
  su,
}: {
  altezzaFoto?: number
  su?: Su
}) {
  const ereditato = useFondo()
  const fondo = su ?? ereditato
  const scura = fondo === 'scuro'
  return (
    // Prima questa `SchedaFoto` non riceveva `su` (né `sfondo`) — restava
    // sempre bianca — mentre i `Blocco` dentro sì: con `su="scuro"`
    // disegnavano un velo di crema sopra una scheda bianca, e sparivano.
    // `ScheletroSchedaOutfit` qui sotto è la stessa forma e lo fa giusto:
    // stesso velo (`superfici.suScuro.riga`) di una `Scheda` scura — questo
    // scheletro sta già su una `Schermata` scura, non è un rettangolo scuro
    // autonomo come la copertina di `carica.tsx`.
    <SchedaFoto
      raggio={raggi.grande}
      su={fondo}
      sfondo={scura ? superfici.suScuro.riga : undefined}
      ombra={scura ? 'nessuna' : 'alta'}
    >
      <Blocco altezza={altezzaFoto} raggio={0} su={fondo} />
      <View style={{ padding: 18, gap: spazi.s }}>
        <Blocco altezza={14} larghezza={104} raggio={raggi.pillola} su={su} />
        <Blocco altezza={32} larghezza="72%" raggio={raggi.piccolo} su={su} />
        <Blocco altezza={20} larghezza="90%" raggio={raggi.pillola} su={su} />
        <View style={{ flexDirection: 'row', gap: spazi.s, marginTop: spazi.s }}>
          <Blocco altezza={52} raggio={raggi.pillola} su={su} style={{ flex: 1 }} />
          <Blocco altezza={52} larghezza={52} raggio={raggi.pillola} su={su} />
        </View>
      </View>
    </SchedaFoto>
  )
}

/** Una proposta alternativa: tre miniature, due righe, la pillola del match. */
export function ScheletroRigaProposta({ su }: { su?: Su }) {
  const ereditato = useFondo()
  const fondo = su ?? ereditato
  const scura = fondo === 'scuro'
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 12,
        borderRadius: raggi.medioAlto,
        backgroundColor: scura ? superfici.suScuro.riga : colori.scheda,
        ...(scura ? null : ombre.bassa),
      }}
    >
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[0, 1, 2].map((indice) => (
          <Blocco key={indice} larghezza={34} altezza={52} raggio={11} su={fondo} />
        ))}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
        <Blocco altezza={15} larghezza="70%" raggio={raggi.piccolo} su={fondo} />
        <Blocco altezza={11} raggio={raggi.pillola} su={fondo} />
      </View>
      <Blocco larghezza={46} altezza={22} raggio={raggi.pillola} su={fondo} />
    </View>
  )
}

/**
 * L'armadio in griglia, a due colonne. Le misure vengono da `griglie.armadio`
 * e non sono ridigitate qui: è l'unico modo perché il passaggio
 * scheletro→capi non sposti nulla.
 */
export function ScheletroGrigliaCapi({
  quanti = 6,
  su,
}: {
  /** Sei riempiono una schermata senza scorrere: bastano a dire «una griglia». */
  quanti?: number
  su?: Su
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: griglie.armadio.distanza }}>
      {Array.from({ length: quanti }, (_, indice) => (
        <View key={indice} style={{ width: griglie.armadio.colonna }}>
          <Blocco altezza={griglie.armadio.altezzaFoto} raggio={griglie.armadio.raggio} su={su} />
        </View>
      ))}
    </View>
  )
}

/**
 * Un outfit salvato: la striscia di foto e la fascia con nome e freccia.
 *
 * Dentro la stessa `SchedaFoto` della card vera (`app/outfit.tsx`) — non una
 * cornice ricostruita a mano una seconda volta.
 */
export function ScheletroSchedaOutfit({ su }: { su?: Su }) {
  const ereditato = useFondo()
  const fondo = su ?? ereditato
  const scura = fondo === 'scuro'
  return (
    <SchedaFoto
      su={fondo}
      sfondo={scura ? superfici.suScuro.riga : undefined}
      ombra={scura ? 'nessuna' : 'scheda'}
    >
      {/* Un blocco solo, non quattro accostati: nella scheda vera le foto sono
          a filo, senza spazio in mezzo — quattro rettangoli senza separazione
          sono un rettangolo. `raggio={0}` perché a smussare ci pensa
          l'`overflow: 'hidden'` di `SchedaFoto`. */}
      <Blocco altezza={250} raggio={0} su={fondo} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spazi.m,
          paddingHorizontal: 16,
          paddingVertical: 15,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
          <Blocco altezza={17} larghezza="62%" raggio={raggi.piccolo} su={fondo} />
          <Blocco altezza={11} larghezza="86%" raggio={raggi.pillola} su={fondo} />
        </View>
        <Blocco larghezza={46} altezza={46} raggio={raggi.pillola} su={fondo} />
      </View>
    </SchedaFoto>
  )
}

/**
 * Il mese: la riga delle iniziali e le celle dei giorni.
 *
 * `giorni` lo passa la schermata, che il mese corrente ce l'ha già calcolato —
 * un default fisso farebbe comparire e sparire una riga a febbraio.
 */
export function ScheletroCalendario({
  giorni = 30,
  su,
}: {
  giorni?: number
  su?: Su
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: griglie.mese.distanza }}>
      {Array.from({ length: 7 }, (_, indice) => (
        <View key={`iniziale-${indice}`} style={{ width: griglie.mese.colonna, alignItems: 'center' }}>
          <Blocco larghezza={8} altezza={8} raggio={raggi.pillola} su={su} />
        </View>
      ))}
      {Array.from({ length: giorni }, (_, indice) => (
        // Nessuna `altezza`: la cella la ricava dalla propria larghezza, come
        // quella vera — così resta quadrata-e-mezzo su ogni telefono.
        <Blocco
          key={indice}
          larghezza={griglie.mese.colonna}
          raggio={griglie.mese.raggio}
          su={su}
          style={{ aspectRatio: griglie.mese.proporzione }}
        />
      ))}
    </View>
  )
}
