/**
 * Le primitive dell'interfaccia: scheda, pillola, segmenti, pulsanti, icona.
 *
 * Tutte pressabili con lo stesso feedback — scala 0.97 e un tocco di haptic —
 * perché su un'app che deve risultare facile la coerenza del tocco conta più
 * di qualunque animazione elaborata.
 */

import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import {
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colori, linee, ombre, raggi, spazi } from '../tema/tokens'
import { Corpo, Etichetta, Forte } from './testo'

// ─────────────────────────────────────────────────────────────
// Tocco
// ─────────────────────────────────────────────────────────────

interface TocacbileProps extends PressableProps {
  children: ReactNode
  style?: ViewStyle | ViewStyle[]
  /** Scala alla pressione. 0 disattiva l'effetto. */
  scala?: number
  haptic?: boolean
}

export function Toccabile({ children, style, scala = 0.97, haptic = true, ...props }: TocacbileProps) {
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
// Contenitori
// ─────────────────────────────────────────────────────────────

export function Scheda({
  children,
  style,
  scura,
  imbottitura = spazi.l,
}: {
  children: ReactNode
  style?: ViewStyle | ViewStyle[]
  scura?: boolean
  imbottitura?: number
}) {
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
  scura,
}: {
  testo: string
  attiva?: boolean
  onPress?: () => void
  scura?: boolean
}) {
  const sfondoAttivo = scura ? colori.citron : colori.inchiostro
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
        backgroundColor: 'rgba(21,21,26,0.06)',
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
  citron,
  disabilitato,
  style,
}: {
  testo: string
  onPress?: () => void
  freccia?: boolean
  /** Solo per le azioni che eseguono l'IA: vedi la regola in tokens.ts. */
  citron?: boolean
  disabilitato?: boolean
  style?: ViewStyle
}) {
  const sfondo = disabilitato
    ? 'rgba(21,21,26,0.08)'
    : citron
      ? colori.citron
      : colori.inchiostro
  const inchiostro = disabilitato
    ? 'rgba(21,21,26,0.4)'
    : citron
      ? colori.inchiostro
      : colori.crema

  return (
    <Toccabile
      onPress={disabilitato ? undefined : onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: freccia ? 'space-between' : 'center',
        paddingHorizontal: 22,
        paddingVertical: 17,
        borderRadius: raggi.pillola,
        backgroundColor: sfondo,
        ...style,
      }}
    >
      <Forte taglia={16} colore={inchiostro}>
        {testo}
      </Forte>
      {freccia ? <Icona nome="freccia" colore={inchiostro} misura={19} /> : null}
    </Toccabile>
  )
}

export function BottoneSecondario({
  testo,
  onPress,
  riempimento,
  tinta,
  style,
}: {
  testo: string
  onPress?: () => void
  /**
   * Il fondo quando il pulsante è un interruttore già acceso. Non è mai citron:
   * questo pulsante non parla per l'IA — vedi la regola in tokens.ts.
   */
  riempimento?: string
  tinta?: string
  style?: ViewStyle
}) {
  return (
    <Toccabile
      onPress={onPress}
      scala={0.96}
      style={{
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: raggi.pillola,
        borderWidth: 1,
        borderColor: linee.chiara,
        backgroundColor: riempimento ?? 'transparent',
        ...style,
      }}
    >
      <Forte taglia={13.5} colore={tinta}>
        {testo}
      </Forte>
    </Toccabile>
  )
}

/** Il badge del match, l'unico posto oltre ai pulsanti IA dove sta il citron. */
export function BadgeIa({ testo, tenue }: { testo: string; tenue?: boolean }) {
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
        backgroundColor: tenue ? colori.citronTenue : colori.citron,
      }}
    >
      <Icona nome="scintilla" misura={12} colore={colori.inchiostro} spessore={2.4} />
      <Etichetta taglia={10.5} colore={tenue ? colori.olivaScuro : colori.inchiostro}>
        {testo}
      </Etichetta>
    </View>
  )
}

export function Riga({ children, gap = spazi.s, style }: { children: ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
}

export function Vuoto({ titolo, spiegazione }: { titolo: string; spiegazione: string }) {
  return (
    <Scheda imbottitura={spazi.xl} style={{ alignItems: 'center', gap: spazi.s }}>
      <Forte taglia={15}>{titolo}</Forte>
      <Corpo taglia={13} tono="tenue" style={{ textAlign: 'center' }}>
        {spiegazione}
      </Corpo>
    </Scheda>
  )
}

// ─────────────────────────────────────────────────────────────
// Icone
// ─────────────────────────────────────────────────────────────

/**
 * Le icone del design, come tracciati SVG.
 *
 * Nessuna libreria: sono nove percorsi, presi dal file di design, e una
 * dipendenza in meno da aggiornare.
 */
export const TRACCIATI = {
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
  sfondo = colori.citron,
  tinta = colori.inchiostro,
  misura = 34,
}: {
  nome: NomeIcona
  sfondo?: string
  tinta?: string
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
      <Icona nome={nome} misura={misura * 0.5} colore={tinta} spessore={2.2} />
    </View>
  )
}

export const stiliComuni = StyleSheet.create({
  schermata: { flex: 1, backgroundColor: colori.sfondo },
  contenuto: { paddingHorizontal: spazi.xl, paddingBottom: 120, gap: spazi.l },
})
