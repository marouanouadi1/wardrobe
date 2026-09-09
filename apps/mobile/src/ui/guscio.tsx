/**
 * Il guscio di una schermata: la testata comune, e i due contenitori che la
 * usano — `Schermata` (le tredici schermate con `ScrollView`) e
 * `GuscioAutenticazione` (le due schermate di accesso, prima del login).
 *
 * `Testata` sta in un componente perché è l'elemento che compare in tutte le
 * schermate, e perché la coppia occhiello + titolo è il modo in cui l'app dice
 * dove sei senza una barra di navigazione tradizionale.
 */

import { Image } from 'expo-image'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colori, linee, raggi, spazi } from '../tema/tokens'
import { BottoneIndietro, Icona, LinkTesto, Toccabile } from './base'
import { Corpo, TestoErrore, Titolo } from './testo'

export function Testata({
  occhiello,
  titolo,
  indietro,
  onIndietro,
  fotoProfilo,
  su,
}: {
  occhiello: string
  titolo: string
  indietro?: boolean
  /** Cosa fare al tocco: assente = `router.back()`, come sempre. Serve solo
   * a chi ha bisogno di tornare a un passo, non a una schermata (l'intro). */
  onIndietro?: () => void
  fotoProfilo?: string | null
  su?: 'chiaro' | 'scuro'
}) {
  const bordi = useSafeAreaInsets()

  return (
    <View
      style={{
        paddingTop: Math.max(bordi.top, 14) + 8,
        paddingHorizontal: spazi.xl,
        paddingBottom: spazi.s,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spazi.m,
      }}
    >
      {indietro ? <BottoneIndietro onPress={onIndietro} su={su} /> : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Corpo taglia={11.5} tono="tenue" su={su}>
          {occhiello}
        </Corpo>
        <Titolo taglia={27} su={su} style={{ marginTop: 1 }}>
          {titolo}
        </Titolo>
      </View>

      {fotoProfilo !== undefined ? (
        <Toccabile
          onPress={() => router.push('/(tabs)/profilo')}
          scala={0.92}
          style={{
            width: 42,
            height: 42,
            borderRadius: raggi.pillola,
            overflow: 'hidden',
            backgroundColor: linee.tenue,
          }}
        >
          {fotoProfilo ? (
            <Image source={{ uri: fotoProfilo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icona nome="utente" misura={20} colore="rgba(21,21,26,0.5)" />
            </View>
          )}
        </Toccabile>
      ) : null}
    </View>
  )
}

/**
 * Il guscio di una schermata: `Testata` + `ScrollView`, con il padding
 * orizzontale e il `paddingBottom` che il resto dell'app non deve ricopiare.
 *
 * `tab` dice se la schermata vive sotto la barra galleggiante: il conto del
 * `paddingBottom` **rispecchia `(tabs)/_layout.tsx`** — la stessa formula
 * `Math.max(bordi.bottom, 10) + 6`, più i 48px della pillola e i suoi 8px di
 * padding. Se cambi uno dei due conti, cambia anche l'altro.
 */
export function Schermata({
  occhiello,
  titolo,
  indietro,
  onIndietro,
  fotoProfilo,
  su,
  tab,
  ancoraInFondo,
  children,
  contentStyle,
}: {
  occhiello: string
  titolo: string
  indietro?: boolean
  onIndietro?: () => void
  fotoProfilo?: string | null
  su?: 'chiaro' | 'scuro'
  /** Sotto la barra galleggiante: il `paddingBottom` le lascia spazio. */
  tab?: boolean
  /** Ancora la vista in fondo quando il contenuto cresce: la chat, dove
   * l'ultimo messaggio deve restare visibile senza uno scroll manuale. */
  ancoraInFondo?: boolean
  children: ReactNode
  contentStyle?: ViewStyle
}) {
  const bordi = useSafeAreaInsets()
  const paddingBottom = tab ? Math.max(bordi.bottom, 10) + 6 + 48 + 8 : 60
  const scrollRef = useRef<ScrollView>(null)

  return (
    <View style={{ flex: 1, backgroundColor: su === 'scuro' ? colori.inchiostro : undefined }}>
      <Testata
        occhiello={occhiello}
        titolo={titolo}
        indietro={indietro}
        onIndietro={onIndietro}
        fotoProfilo={fotoProfilo}
        su={su}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          { paddingHorizontal: spazi.xl, paddingBottom, gap: spazi.l },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={ancoraInFondo ? () => scrollRef.current?.scrollToEnd({ animated: true }) : undefined}
      >
        {children}
      </ScrollView>
    </View>
  )
}

/**
 * Il guscio delle due schermate di accesso, prima del login: tastiera che non
 * copre il campo attivo, intestazione, e il link fantasma di chiusura in
 * fondo. `accedi.tsx` e `registrati.tsx` erano ~19 righe byte-identiche.
 */
export function GuscioAutenticazione({
  titolo,
  sottotitolo,
  errore,
  azione,
  onLinkFantasma,
  testoLinkFantasma,
  children,
}: {
  titolo: string
  sottotitolo: string
  errore?: string | null
  azione: ReactNode
  onLinkFantasma: () => void
  testoLinkFantasma: ReactNode
  children: ReactNode
}) {
  const bordi = useSafeAreaInsets()
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colori.sfondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: spazi.xl,
          paddingTop: bordi.top,
          paddingBottom: bordi.bottom,
          gap: spazi.l,
        }}
      >
        <View style={{ gap: spazi.xs, marginBottom: spazi.l }}>
          <Titolo>{titolo}</Titolo>
          <Corpo tono="tenue">{sottotitolo}</Corpo>
        </View>

        {children}

        {errore ? <TestoErrore>{errore}</TestoErrore> : null}

        {azione}

        <LinkTesto onPress={onLinkFantasma}>{testoLinkFantasma}</LinkTesto>
      </View>
    </KeyboardAvoidingView>
  )
}
