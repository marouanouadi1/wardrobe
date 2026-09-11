/**
 * I capi, nelle forme in cui il design li mostra: griglia, e le miniature
 * più piccole (suggerimenti, selettore dell'avatar).
 *
 * Sotto la foto c'è `colori.fondoFoto`, uguale per tutti i capi. Non era così:
 * c'era il colore dominante del capo, come segnaposto di caricamento. Ha
 * smesso di funzionare quando lo scontorno (`handlers/analisi.py`) ha
 * iniziato a produrre PNG trasparenti — il fondo non è più coperto dalla
 * foto, e ogni capo finiva adagiato su una velatura del proprio colore. Il
 * segnaposto resta, ma è lo stesso bianco per tutti.
 */

import type { Capo } from '@wardrobe/contracts'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { fotoDaMostrare } from '../dati/dominio'
import { ETICHETTE, colori, durate, griglie, ombre, raggi } from '../tema/tokens'
import { Badge, BottoneTondo, Toccabile } from './base'
import { Fondo, type Su } from './fondo'
import { Corpo, Etichetta, Forte, Titolo } from './testo'

const OMBRE_SCHEDA_FOTO = {
  scheda: ombre.scheda,
  alta: ombre.alta,
  bassa: ombre.bassa,
  nessuna: {},
} as const

/**
 * La card foto a tutta larghezza: angoli smussati, un fondo, e dentro quello
 * che la schermata vuole (di solito un'`<Image>` più un testo sovrapposto).
 *
 * Sostituisce sei ricostruzioni a mano quasi identiche — il dettaglio di un
 * capo, il suggeritore, gli outfit salvati, la proposta di Oggi, le due
 * schermate di `carica.tsx` — ciascuna con un raggio o un'ombra leggermente
 * diversi senza una ragione: la stessa forma, copiata a mano sei volte,
 * diverge in silenzio.
 */
export function SchedaFoto({
  raggio = raggi.grande - 2,
  ombra = 'scheda',
  su,
  sfondo,
  style,
  children,
}: {
  raggio?: number
  ombra?: keyof typeof OMBRE_SCHEDA_FOTO
  su?: Su
  /** Un fondo esplicito, invece del solido che `su` ricava da sé — il velo
   * d'inchiostro di uno scheletro che sa di stare già su una `Schermata`
   * scura (`ScheletroSchedaOutfit`), non un rettangolo scuro autonomo su una
   * schermata chiara (`carica.tsx`). */
  sfondo?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  // Prima `sfondo` era l'unica leva — `carica.tsx` le passava
  // `colori.inchiostro` senza modo di dirlo ai testi dentro, che finivano
  // cablati a mano (`colore={colori.scheda}`, `colore="rgba(255,253,249,…)"`).
  const fondo: Su = su ?? 'chiaro'
  const scura = fondo === 'scuro'
  return (
    <Fondo su={fondo}>
      <View
        style={[
          {
            borderRadius: raggio,
            overflow: 'hidden',
            backgroundColor: sfondo ?? (scura ? colori.inchiostro : colori.scheda),
          },
          OMBRE_SCHEDA_FOTO[ombra],
          style,
        ]}
      >
        {children}
      </View>
    </Fondo>
  )
}

/**
 * Il piede di una foto: la sfumatura verso l'inchiostro, ancorata in fondo,
 * con `su="scuro"` già dichiarato per chi ci scrive dentro. `CapoInGriglia`
 * e le due schermate di `carica.tsx` lo ricostruivano a mano — stesso
 * gradiente, e per la stessa ragione i loro testi erano cablati a mano
 * (`colore={colori.scheda}`, `colore="rgba(255,253,249,…)"`): nessuno dei
 * due sapeva dirsi scuro all'unico modo che un `ReactNode` permette.
 */
export function PiedeFoto({
  children,
  opacita = 0.82,
  style,
}: {
  children: ReactNode
  /** Quanto scende verso l'inchiostro pieno: 0.82 di norma. La copertina di
   * `carica.tsx` usa 0.85 — una foto già velata al 50% ha meno bisogno di
   * sfumatura per restare leggibile. */
  opacita?: number
  style?: StyleProp<ViewStyle>
}) {
  return (
    <LinearGradient
      colors={['rgba(21,21,26,0)', `rgba(21,21,26,${opacita})`]}
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, style]}
    >
      <Fondo su="scuro">{children}</Fondo>
    </LinearGradient>
  )
}

/**
 * L'elenco dei «perché» di una proposta: un pallino ambra e una riga di testo
 * per ciascuno — l'ambra è corretta qui, è il motivo che il modello dà per la
 * sua scelta. Una forma che vive qui invece che ridisegnata inline in una
 * schermata, per la stessa regola di `SchedaFoto` sopra.
 */
export function MotiviProposta({ motivi, su }: { motivi: string[]; su?: Su }) {
  return (
    <View style={{ gap: 7 }}>
      {motivi.map((motivo) => (
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
          <Corpo taglia={13} tono="medio" su={su} style={{ flex: 1 }}>
            {motivo}
          </Corpo>
        </View>
      ))}
    </View>
  )
}

export function CapoInGriglia({ capo, onPress }: { capo: Capo; onPress: () => void }) {
  return (
    <Toccabile
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: griglie.armadio.raggio,
        overflow: 'hidden',
        backgroundColor: colori.fondoFoto,
        ...ombre.bassa,
      }}
    >
      <Image
        source={{ uri: fotoDaMostrare(capo) }}
        style={{ width: '100%', height: griglie.armadio.altezzaFoto }}
        contentFit="cover"
        transition={durate.breve}
      />
      <PiedeFoto style={{ paddingTop: 24, padding: 12 }}>
        <Titolo taglia="corpo">{capo.nome}</Titolo>
        <Corpo taglia="micro" tono="medio">
          {capo.colore.nome} · {capo.materiale?.split(',')[0] ?? ETICHETTE.tipo[capo.tipo]}
        </Corpo>
      </PiedeFoto>
      {capo.stato !== 'pulito' ? (
        <View style={{ position: 'absolute', top: 9, right: 9 }}>
          <Badge testo="da lavare" sfondo={colori.corallo} colore={colori.crema} />
        </View>
      ) : null}
    </Toccabile>
  )
}

/** Miniatura quadrata: la mostrano il dettaglio di un capo («ci sta bene con») e le liste corte. */
export function Miniatura({
  capo,
  larghezza = 96,
  altezza = 118,
  selezionato,
  onPress,
}: {
  capo: Capo
  larghezza?: number
  altezza?: number
  selezionato?: boolean
  onPress?: () => void
}) {
  return (
    <Toccabile onPress={onPress} scala={0.96} style={{ width: larghezza }}>
      <Image
        source={{ uri: fotoDaMostrare(capo) }}
        style={{
          width: larghezza,
          height: altezza,
          borderRadius: raggi.medio,
          backgroundColor: colori.fondoFoto,
          borderWidth: selezionato ? 2 : 0,
          borderColor: colori.inchiostro,
        }}
        contentFit="cover"
        transition={durate.breve}
      />
      <Forte taglia={11.5} style={{ marginTop: 7 }} numberOfLines={2}>
        {capo.nome}
      </Forte>
    </Toccabile>
  )
}

/**
 * Una foto ancora in coda, prima dell'analisi: la miniatura più la ✕ per
 * toglierla. Non prende un `Capo` — a differenza di `Miniatura` — perché a
 * questo punto non esiste ancora: solo un uri locale, appena scattato o
 * scelto dalla galleria. Usata dal riepilogo di `(tabs)/carica.tsx` prima di
 * «Analizza».
 */
export function MiniaturaFoto({
  uri,
  onRimuovi,
  misura = 92,
}: {
  uri: string
  /** Assente: niente ✕ — la foto è già in analisi, toglierla ora non farebbe niente. */
  onRimuovi?: () => void
  misura?: number
}) {
  return (
    <View style={{ width: misura }}>
      <Image
        source={{ uri }}
        style={{
          width: misura,
          height: misura,
          borderRadius: raggi.medio,
          backgroundColor: colori.fondoFoto,
        }}
        contentFit="cover"
      />
      {onRimuovi ? (
        <View style={{ position: 'absolute', top: -6, right: -6 }}>
          <BottoneTondo
            nome="chiudi"
            onPress={onRimuovi}
            misura={26}
            misuraIcona={13}
            sfondo={colori.inchiostro}
            colore={colori.crema}
            bordo={colori.sfondo}
          />
        </View>
      ) : null}
    </View>
  )
}

/** L'attributo letto dalla foto: in corallo se il modello non ne è sicuro. */
export function Attributo({
  chiave,
  valore,
  incerto,
  onPress,
}: {
  chiave: string
  valore: string
  incerto?: boolean
  onPress?: () => void
}) {
  return (
    <Toccabile
      onPress={onPress}
      scala={0.96}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: raggi.medio - 2,
        borderWidth: 1,
        borderColor: incerto ? 'rgba(255,106,69,0.45)' : 'transparent',
        backgroundColor: incerto ? '#FFF1EC' : 'rgba(21,21,26,0.04)',
      }}
    >
      <Etichetta taglia={10} tono="debole" style={{ letterSpacing: 0.9 }}>
        {chiave}
      </Etichetta>
      <Forte taglia={13.5} style={{ marginTop: 2 }}>
        {valore}
      </Forte>
    </Toccabile>
  )
}
