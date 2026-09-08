/**
 * Le primitive dell'interfaccia: scheda, pillola, segmenti, pulsanti, icona.
 *
 * Tutte pressabili con lo stesso feedback — scala 0.97 e un tocco di haptic —
 * perché su un'app che deve risultare facile la coerenza del tocco conta più
 * di qualunque animazione elaborata.
 *
 * Una schermata compone queste primitive: non ridefinisce una card, un
 * bottone o un badge a mano. Se manca una forma, si aggiunge qui (o in
 * `stati.tsx` / `righe.tsx` / `guscio.tsx`), non inline nella schermata — è la
 * stessa regola già in vigore per i valori del design (`tema/tokens.ts`).
 */

import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colori, linee, ombre, raggi, spazi } from '../tema/tokens'
import { Etichetta, Forte } from './testo'

// ─────────────────────────────────────────────────────────────
// Tocco
// ─────────────────────────────────────────────────────────────

interface ToccabileProps extends PressableProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Scala alla pressione. 0 disattiva l'effetto. */
  scala?: number
  haptic?: boolean
}

export function Toccabile({ children, style, scala = 0.97, haptic = true, ...props }: ToccabileProps) {
  return (
    <Pressable
      {...props}
      // Senza `onPress` l'elemento è inerte: niente scala e niente vibrazione,
      // altrimenti un pulsante già acceso risponderebbe al dito senza fare nulla.
      disabled={props.disabled ?? !props.onPress}
      onPress={(evento) => {
        if (haptic && Platform.OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
        props.onPress?.(evento)
      }}
      style={({ pressed }) => [
        style,
        pressed && scala > 0 ? { transform: [{ scale: scala }] } : null,
      ]}
    >
      {children}
    </Pressable>
  )
}

// ─────────────────────────────────────────────────────────────
// Campi
// ─────────────────────────────────────────────────────────────

/**
 * Il campo di testo del design: unico, dove prima erano quattro varianti
 * quasi identiche (accedi, registrati, il correttore del capo, l'inserimento
 * manuale) che divergevano solo per una svista — un padding qui, uno sfondo
 * là. `etichetta` è opzionale perché il correttore del capo non ne ha una.
 */
export function Campo({
  etichetta,
  style,
  ...props
}: TextInputProps & { etichetta?: string; style?: StyleProp<ViewStyle> }) {
  const campo = (
    <TextInput
      placeholderTextColor="rgba(21,21,26,0.4)"
      {...props}
      style={[
        {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: raggi.piccolo,
          borderWidth: 1,
          borderColor: linee.chiara,
          backgroundColor: colori.scheda,
          fontFamily: 'Manrope_500Medium',
          fontSize: 15,
          color: colori.inchiostro,
        },
        style,
      ]}
    />
  )
  if (!etichetta) return campo
  return (
    <View style={{ gap: spazi.s }}>
      <Etichetta>{etichetta}</Etichetta>
      {campo}
    </View>
  )
}

/**
 * La barra di richiesta a pillola: campo di testo + bottone tondo d'invio.
 *
 * Sostituisce i tre `TextInput` grezzi (Oggi, il suggeritore, la ricerca
 * dell'armadio) che ridigitavano a mano `fontFamily` e `placeholderTextColor`
 * — valori che `Campo` incapsula già. Il bottone d'invio è opzionale: la
 * ricerca dell'armadio non ne ha uno.
 */
export function BarraChiedi({
  valore,
  onCambia,
  placeholder,
  onInvia,
  icona = 'scintilla',
  style,
}: {
  valore: string
  onCambia: (testo: string) => void
  placeholder: string
  /** Assente: nessun bottone d'invio, solo il campo (es. la ricerca). */
  onInvia?: () => void
  icona?: NomeIcona
  style?: ViewStyle
}) {
  return (
    <View
      style={[
        onInvia
          ? { paddingLeft: spazi.l, paddingRight: 7, paddingVertical: 7 }
          : { paddingHorizontal: spazi.l, paddingVertical: 12 },
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spazi.s,
          borderRadius: raggi.pillola,
          backgroundColor: colori.scheda,
          ...ombre.bassa,
        },
        style,
      ]}
    >
      <Icona nome={icona} misura={17} colore={onInvia ? colori.ambraMedio : 'rgba(21,21,26,0.45)'} spessore={2.2} />
      <TextInput
        value={valore}
        onChangeText={onCambia}
        onSubmitEditing={onInvia}
        placeholder={placeholder}
        placeholderTextColor="rgba(21,21,26,0.4)"
        style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 14.5, color: colori.inchiostro }}
      />
      {onInvia ? (
        <BottoneTondo nome="freccia" onPress={onInvia} misura={42} sfondo={colori.ambra} />
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────
// Contenitori
// ─────────────────────────────────────────────────────────────

export function Scheda({
  children,
  style,
  su,
  imbottitura = spazi.l,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  su?: 'chiaro' | 'scuro'
  imbottitura?: number
}) {
  const scura = su === 'scuro'
  return (
    <View
      style={[
        {
          backgroundColor: scura ? colori.inchiostro : colori.scheda,
          borderRadius: raggi.scheda,
          padding: imbottitura,
        },
        scura ? null : ombre.scheda,
        style,
      ]}
    >
      {children}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────
// Pillole e filtri
// ─────────────────────────────────────────────────────────────

export function Pillola({
  testo,
  attiva,
  onPress,
  su,
}: {
  testo: string
  attiva?: boolean
  onPress?: () => void
  su?: 'chiaro' | 'scuro'
}) {
  const scura = su === 'scuro'
  const sfondoAttivo = scura ? colori.ambra : colori.inchiostro
  const testoAttivo = scura ? colori.inchiostro : colori.crema
  return (
    <Toccabile
      onPress={onPress}
      scala={0.95}
      style={{
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderRadius: raggi.pillola,
        borderWidth: 1,
        borderColor: attiva ? sfondoAttivo : scura ? linee.scura : linee.chiara,
        backgroundColor: attiva ? sfondoAttivo : 'transparent',
      }}
    >
      <Forte
        taglia={13}
        colore={attiva ? testoAttivo : scura ? 'rgba(247,244,239,0.75)' : 'rgba(21,21,26,0.72)'}
      >
        {testo}
      </Forte>
    </Toccabile>
  )
}

/** Il controllo a segmenti del design: sfondo grigio, pillola bianca su quello attivo. */
export function Segmenti<T extends string>({
  voci,
  scelta,
  onScegli,
}: {
  voci: readonly { readonly valore: T; readonly etichetta: string }[]
  scelta: T
  onScegli: (valore: T) => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 3,
        padding: 3,
        borderRadius: raggi.pillola,
        backgroundColor: linee.tenue,
      }}
    >
      {voci.map((voce) => {
        const attivo = voce.valore === scelta
        return (
          <Toccabile
            key={voce.valore}
            onPress={() => onScegli(voce.valore)}
            scala={0}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 11,
              borderRadius: raggi.pillola,
              backgroundColor: attivo ? colori.scheda : 'transparent',
              ...(attivo ? ombre.bassa : {}),
            }}
          >
            <Forte taglia={13} tono={attivo ? 'forte' : 'tenue'}>
              {voce.etichetta}
            </Forte>
          </Toccabile>
        )
      })}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────
// Pulsanti
// ─────────────────────────────────────────────────────────────

export function BottonePrimario({
  testo,
  onPress,
  freccia,
  icona,
  caricando,
  ambra,
  chiaro,
  disabilitato,
  style,
}: {
  testo: string
  onPress?: () => void
  freccia?: boolean
  /** Un'icona a sinistra del testo — es. la fotocamera di «Scatta». */
  icona?: NomeIcona
  /** Spegne il tocco e mostra uno spinner al posto dell'icona. */
  caricando?: boolean
  /** Solo per le azioni che eseguono l'IA: vedi la regola in tokens.ts. */
  ambra?: boolean
  /** Sfondo chiaro (per pulsanti su foto scure): testo scuro invece che crema. */
  chiaro?: boolean
  disabilitato?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const spento = disabilitato || caricando
  const sfondo = disabilitato
    ? 'rgba(21,21,26,0.08)'
    : ambra
      ? colori.ambra
      : chiaro
        ? colori.scheda
        : colori.inchiostro
  const inchiostro = disabilitato
    ? 'rgba(21,21,26,0.4)'
    : ambra || chiaro
      ? colori.inchiostro
      : colori.crema

  return (
    <Toccabile
      onPress={spento ? undefined : onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: freccia ? 'space-between' : 'center',
          paddingHorizontal: 22,
          paddingVertical: 17,
          borderRadius: raggi.pillola,
          backgroundColor: sfondo,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s }}>
        {icona ? (
          caricando ? (
            <ActivityIndicator color={inchiostro} />
          ) : (
            <Icona nome={icona} colore={inchiostro} misura={19} />
          )
        ) : null}
        <Forte taglia={16} colore={inchiostro}>
          {testo}
        </Forte>
      </View>
      {freccia ? <Icona nome="freccia" colore={inchiostro} misura={19} /> : null}
    </Toccabile>
  )
}

export function BottoneSecondario({
  testo,
  onPress,
  sfondo,
  colore,
  style,
}: {
  testo: string
  onPress?: () => void
  /**
   * Il fondo quando il pulsante è un interruttore già acceso. Non è mai ambra:
   * questo pulsante non parla per l'IA — vedi la regola in tokens.ts.
   */
  sfondo?: string
  colore?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Toccabile
      onPress={onPress}
      scala={0.96}
      style={[
        {
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: raggi.pillola,
          borderWidth: 1,
          borderColor: linee.chiara,
          backgroundColor: sfondo ?? 'transparent',
        },
        style,
      ]}
    >
      <Forte taglia={13.5} colore={colore}>
        {testo}
      </Forte>
    </Toccabile>
  )
}

/**
 * Il badge a pillola generico: un'icona opzionale, un'etichetta, un fondo.
 *
 * `BadgeIa` è la sua specializzazione — ambra, icona `scintilla` — per il
 * solo caso in cui parla il modello. Un badge di stato (chi cuce, non IA)
 * passa `sfondo`/`colore` propri invece di reinventare la stessa pillola.
 */
export function Badge({
  testo,
  sfondo = colori.ambra,
  colore = colori.inchiostro,
  icona,
}: {
  testo: string
  sfondo?: string
  colore?: string
  icona?: NomeIcona
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: raggi.pillola,
        backgroundColor: sfondo,
      }}
    >
      {icona ? <Icona nome={icona} misura={12} colore={colore} spessore={2.4} /> : null}
      <Etichetta taglia={10.5} colore={colore}>
        {testo}
      </Etichetta>
    </View>
  )
}

/** Il badge del match, l'unico posto oltre ai pulsanti IA dove sta l'ambra. */
export function BadgeIa({ testo, tenue }: { testo: string; tenue?: boolean }) {
  return (
    <Badge
      testo={testo}
      icona="scintilla"
      sfondo={tenue ? colori.ambraTenue : colori.ambra}
      colore={tenue ? colori.ambraScuro : colori.inchiostro}
    />
  )
}

/**
 * La bolla di chat: stessi angoli per il messaggio dell'utente, quello dello
 * stilista e quello «Sto pensando…». Prima quest'ultima li ricopiava a mano —
 * una divergenza silenziosa in attesa di succedere.
 */
export function BollaChat({ daUtente, children }: { daUtente: boolean; children: ReactNode }) {
  return (
    <View
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
      {children}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────
// Icone
// ─────────────────────────────────────────────────────────────

/**
 * Le icone del design, come tracciati SVG.
 *
 * Nessuna libreria: sono nove percorsi, presi dal file di design, e una
 * dipendenza in meno da aggiornare. L'oggetto resta privato: solo il tipo
 * `NomeIcona` che ne deriva esce dal modulo.
 */
const TRACCIATI = {
  scintilla: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  griglia: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  piu: 'M12 5v14M5 12h14',
  maglietta: 'M8 3l4 2 4-2 4.2 1.7-1 4.3H17v10H7V9H4.8l-1-4.3z',
  utente: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.4-3.2 4.2-5 7.5-5s6.1 1.8 7.5 5',
  freccia: 'M5 12h14M12 5l7 7-7 7',
  indietro: 'M19 12H5M12 19l-7-7 7-7',
  chevron: 'M9 18l6-6-6-6',
  cerca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  sole: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M6.3 6.3L4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  calendario:
    'M7 3v4M17 3v4M3.5 9.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5z',
  cartellino: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h5l9 9-6.5 6.5-9-9v-4zM7.5 8.5h.01',
  cuore: 'M19 14c1.5-1.5 3-3.4 3-5.5A4.5 4.5 0 0 0 12 6a4.5 4.5 0 0 0-10 2.5C2 10.6 3.5 12.5 5 14l7 7z',
  ricarica: 'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16',
  mescola: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  chiudi: 'M18 6L6 18M6 6l12 12',
  fotocamera:
    'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2',
  spunta: 'M20 6L9 17l-5-5',
} as const

export type NomeIcona = keyof typeof TRACCIATI

export function Icona({
  nome,
  misura = 18,
  colore: tinta = colori.inchiostro,
  spessore = 2,
  pieno,
}: {
  nome: NomeIcona
  misura?: number
  colore?: string
  spessore?: number
  pieno?: boolean
}) {
  return (
    <Svg width={misura} height={misura} viewBox="0 0 24 24">
      <Path
        d={TRACCIATI[nome]}
        stroke={tinta}
        strokeWidth={spessore}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={pieno ? tinta : 'none'}
      />
    </Svg>
  )
}

/** Un cerchio con un'icona dentro: la scorciatoia visiva più usata nel design. */
export function Bolla({
  nome,
  sfondo = colori.ambra,
  colore = colori.inchiostro,
  misura = 34,
}: {
  nome: NomeIcona
  sfondo?: string
  colore?: string
  misura?: number
}) {
  return (
    <View
      style={{
        width: misura,
        height: misura,
        borderRadius: raggi.pillola,
        backgroundColor: sfondo,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icona nome={nome} misura={misura * 0.5} colore={colore} spessore={2.2} />
    </View>
  )
}

/** Una `Bolla` pressabile: il bottone tondo con icona (ritorno, invio, «vedila addosso»…). */
export function BottoneTondo({
  nome,
  onPress,
  sfondo = colori.ambra,
  colore = colori.inchiostro,
  misura = 42,
}: {
  nome: NomeIcona
  onPress?: () => void
  sfondo?: string
  colore?: string
  misura?: number
}) {
  return (
    <Toccabile onPress={onPress} scala={0.9} style={{ borderRadius: raggi.pillola }}>
      <Bolla nome={nome} sfondo={sfondo} colore={colore} misura={misura} />
    </Toccabile>
  )
}
