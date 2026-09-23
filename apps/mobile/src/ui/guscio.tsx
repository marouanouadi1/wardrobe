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
import { router, usePathname } from 'expo-router'
import type { ReactNode } from 'react'
import { useId, useRef } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colori, fondi, linee, ombre, raggi, spazi, testoSu, velo, type NomeFondo } from '../tema/tokens'
import { BottoneIndietro, Icona, LinkTesto, Toccabile, type NomeIcona } from './base'
import { Fondo, useFondo, type Su } from './fondo'
import { Corpo, Etichetta, TestoErrore, Titolo } from './testo'

/**
 * La barra in basso: pillola scura galleggiante, col «+» in primario al centro.
 *
 * È scritta a mano invece di usare quella di sistema perché la forma — una
 * pillola staccata dal fondo, cinque voci di cui una circolare al centro — è
 * parte dell'identità del design, e perché così il tocco ha lo stesso feedback
 * del resto dell'app.
 *
 * **Vive fuori dal navigatore**, montata una volta in `app/_layout.tsx`. Prima
 * stava nella prop `tabBar` di `<Tabs>` e quindi esisteva **solo dentro** il
 * gruppo `(tabs)`: sul dettaglio di un capo, in chat, sul calendario non era
 * spenta — non c'era. Il deck «Aura» invece la tiene sempre, con accesa la
 * scheda da cui ci si è arrivati, ed è la cosa che dice «non ti sei perso, sei
 * dentro l'Armadio» (scelta dell'utente del 2026-09-23, `Q-11`).
 *
 * Il prezzo di quel trasloco è che lo stato del navigatore non è più
 * disponibile: la scheda attiva si deduce dal percorso, con `SCHEDA_DI`.
 */

/** Le cinque destinazioni, nell'ordine in cui stanno nella pillola. */
const VOCI: { nome: string; etichetta: string; icona: NomeIcona; centrale?: boolean }[] = [
  { nome: 'oggi', etichetta: 'Oggi', icona: 'scintilla' },
  { nome: 'armadio', etichetta: 'Armadio', icona: 'griglia' },
  { nome: 'carica', etichetta: '', icona: 'piu', centrale: true },
  { nome: 'avatar', etichetta: 'Avatar', icona: 'maglietta' },
  { nome: 'profilo', etichetta: 'Profilo', icona: 'utente' },
]

/**
 * A quale scheda appartiene una rotta **fuori** dalle schede.
 *
 * È un elenco di ciò che c'è, non di ciò che va escluso: una rotta che non
 * compare qui non accende nessuna scheda **e non mostra la barra**. Il verso è
 * deliberato — con un elenco di esclusioni, una rotta nuova comparirebbe con la
 * barra addosso di default, e prima o poi sarebbe la schermata di accesso.
 */
const SCHEDA_DI: Record<string, string> = {
  'capo': 'armadio',
  'outfit': 'armadio',
  'suggeritore': 'oggi',
  'chat': 'oggi',
  'calendario': 'profilo',
  'segnalazioni': 'profilo',
  // Il deck la mette sotto l'Armadio, ed è dove si va a cercarla: sono capi
  // già dentro, con un dettaglio da sistemare.
  'darivedere': 'armadio',
  'impostazioni': 'profilo',
  'misure': 'profilo',
  'unita': 'profilo',
  'svuota': 'profilo',
  // `guidafoto` **non** è qui di proposito: è una deviazione dentro il gesto
  // di caricare — si apre, si legge, si torna. La barra offrirebbe cinque vie
  // di fuga proprio mentre si sta facendo una cosa sola.
}

/**
 * La scheda accesa per un percorso, o `null` se lì la barra non va.
 *
 * Lo leggono in due — la barra, per sapere cosa accendere, e `Schermata`, per
 * sapere se riservare lo spazio in fondo. Prima quel secondo conto era una
 * prop (`tab`) che ogni schermata doveva ricordarsi di passare, e un commento
 * in due file che diceva di tenerli allineati: due modi di sapere la stessa
 * cosa. Adesso è uno.
 */
export function schedaDi(percorso: string): string | null {
  const primo = percorso.split('/').filter(Boolean)[0]
  if (!primo) return null
  if (VOCI.some((voce) => voce.nome === primo)) return primo
  return SCHEDA_DI[primo] ?? null
}

/** Lo spazio che la barra occupa in fondo, per chi ci deve stare sopra. */
export function altezzaBarra(bordoInferiore: number): number {
  return Math.max(bordoInferiore, 10) + 6 + 48 + 8
}

export function BarraSchede() {
  const bordi = useSafeAreaInsets()
  const percorso = usePathname()
  const attivaOra = schedaDi(percorso)
  if (!attivaOra) return null

  return (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(bordi.bottom, 10) + 6,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          padding: 8,
          borderRadius: raggi.pillola,
          backgroundColor: velo(colori.inchiostro, 0.96),
          ...ombre.alta,
        }}
      >
        {VOCI.map((voce) => {
          const attiva = voce.nome === attivaOra
          return (
            <Toccabile
              key={voce.nome}
              scala={0.92}
              // Il «+» porta a «Carica» **da ovunque**, anche da una schermata
              // che non è una scheda: un bersaglio che fa sempre la stessa cosa
              // è quello di cui ci si fida (scelta dell'utente, 2026-09-23).
              onPress={() => router.navigate(`/(tabs)/${voce.nome}` as '/(tabs)/oggi')}
              style={{
                flex: voce.centrale ? 0 : 1,
                width: voce.centrale ? 60 : undefined,
                height: 48,
                borderRadius: raggi.pillola,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                backgroundColor: voce.centrale
                  ? colori.primario
                  : attiva
                    ? velo(colori.scheda, 0.14)
                    : 'transparent',
              }}
            >
              <Icona
                nome={voce.icona}
                misura={voce.centrale ? 22 : 19}
                colore={voce.centrale ? colori.scheda : attiva ? colori.scheda : testoSu.scuro.tenue}
              />
              {voce.etichetta ? (
                <Etichetta
                  taglia="nano"
                  colore={attiva ? colori.scheda : testoSu.scuro.tenue}
                  style={{ letterSpacing: 0.4 }}
                >
                  {voce.etichetta}
                </Etichetta>
              ) : null}
            </Toccabile>
          )
        })}
      </View>
    </View>
  )
}

/**
 * Il fondo di una schermata: un gradiente a tre fermate e due aloni radiali,
 * come nel deck. I colori stanno in `fondi` (`tema/tokens.ts`), la geometria
 * qui — un token che portasse anche le coordinate costringerebbe a duplicarle
 * il giorno in cui una schermata vuole tre aloni invece di due.
 *
 * Le posizioni vengono dal deck: il primo alone esce dall'angolo in alto a
 * sinistra (300px, centro a -50/-70), il secondo dal bordo destro più in basso
 * (270px, centro a destra -80 / top 210). Sono in pixel e non in percentuale
 * di proposito: un alone che si allarga col telefono smette di essere una luce
 * e diventa una tinta.
 *
 * `pointerEvents="none"`: è pittura, non deve mangiare un tocco.
 *
 * Gli `id` dei due gradienti sono unici per istanza (`useId`), non costanti:
 * durante una transizione di `expo-router` due schermate sono montate insieme,
 * e su web quegli `id` finiscono nello stesso documento — due `aloneA` e il
 * secondo vincerebbe su entrambi, dando alla schermata che entra gli aloni di
 * quella che esce.
 */
export function SfondoAura({ tavolozza = 'neutro' }: { tavolozza?: NomeFondo }) {
  const { width } = useWindowDimensions()
  const istanza = useId().replace(/:/g, '')
  const idA = `aloneA${istanza}`
  const idB = `aloneB${istanza}`
  const t = fondi[tavolozza]
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={t.gradiente}
        locations={t.fermate}
        // I 170° del deck, quasi a piombo con una deriva a sinistra. In CSS
        // l'angolo è assoluto; qui `start`/`end` sono normalizzati sul
        // riquadro, quindi l'angolo vero dipende dalle proporzioni dello
        // schermo e i due non possono coincidere ovunque. Questi valori danno
        // 170° su un telefono di proporzioni comuni (misurato: 430×900).
        start={{ x: 0.444, y: 0 }}
        end={{ x: 0.556, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={idA} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={t.aloneA.colore} stopOpacity={t.aloneA.alfa} />
            <Stop offset="0.7" stopColor={t.aloneA.colore} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={idB} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={t.aloneB.colore} stopOpacity={t.aloneB.alfa} />
            <Stop offset="0.7" stopColor={t.aloneB.colore} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={100} cy={80} r={150} fill={`url(#${idA})`} />
        <Circle cx={width - 55} cy={345} r={135} fill={`url(#${idB})`} />
      </Svg>
    </View>
  )
}

export function Testata({
  occhiello,
  titolo,
  indietro,
  onIndietro,
  fotoProfilo,
  azioni,
  su,
}: {
  occhiello: string
  titolo: string
  indietro?: boolean
  /** Cosa fare al tocco: assente = `router.back()`, come sempre. Serve solo
   * a chi ha bisogno di tornare a un passo, non a una schermata (l'intro). */
  onIndietro?: () => void
  fotoProfilo?: string | null
  /** I bersagli a destra del titolo — il cuore e il «···» del dettaglio di un
   * capo. Occupano lo stesso posto di `fotoProfilo` e non si mettono insieme:
   * una schermata di scheda porta l'avatar dell'utente, una spinta sopra porta
   * le azioni di ciò che mostra. Se un giorno servissero entrambi, il posto
   * dove decidere è qui, non nella schermata. */
  azioni?: ReactNode
  su?: Su
}) {
  const bordi = useSafeAreaInsets()
  const ereditato = useFondo()
  const fondo = su ?? ereditato
  const scura = fondo === 'scuro'

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
      {indietro ? <BottoneIndietro onPress={onIndietro} su={fondo} /> : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Corpo taglia="micro" tono="tenue" su={fondo}>
          {occhiello}
        </Corpo>
        <Titolo taglia="testata" su={fondo} style={{ marginTop: 1 }}>
          {titolo}
        </Titolo>
      </View>

      {azioni ? <View style={{ flexDirection: 'row', gap: spazi.s }}>{azioni}</View> : null}

      {fotoProfilo !== undefined ? (
        <Toccabile
          onPress={() => router.push('/(tabs)/profilo')}
          scala={0.92}
          style={{
            width: 42,
            height: 42,
            borderRadius: raggi.pillola,
            overflow: 'hidden',
            backgroundColor: scura ? linee.scura : linee.tenue,
          }}
        >
          {fotoProfilo ? (
            <Image source={{ uri: fotoProfilo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icona nome="utente" misura={20} colore={scura ? testoSu.scuro.tenue : testoSu.chiaro.tenue} />
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
  azioni,
  su,
  tavolozza,
  ancoraInFondo,
  children,
  contentStyle,
}: {
  occhiello: string
  titolo: string
  indietro?: boolean
  onIndietro?: () => void
  fotoProfilo?: string | null
  /** Vedi `Testata`: i bersagli a destra del titolo. */
  azioni?: ReactNode
  su?: Su
  /** Quale delle quattro tavolozze del deck dipinge il fondo. Assente: nessun
   * gradiente, la schermata resta sulla tinta piatta di `colori.sfondo` —
   * così una schermata si converte per volta invece che tutte insieme.
   *
   * **Vince su `su`**, come `vetro` su `Scheda`: i gradienti di `fondi` sono
   * tutti chiari, quindi `su="scuro"` insieme a una tavolozza dipingerebbe
   * l'inchiostro, ci stenderebbe sopra un gradiente chiaro, e poi dichiarerebbe
   * `'scuro'` a tutto il contenuto — testo chiaro su fondo chiaro, la forma
   * esatta di PR #4 raggiungibile da una combinazione di prop lecita. */
  tavolozza?: NomeFondo
  /** Ancora la vista in fondo quando il contenuto cresce: la chat, dove
   * l'ultimo messaggio deve restare visibile senza uno scroll manuale. */
  ancoraInFondo?: boolean
  children: ReactNode
  contentStyle?: ViewStyle
}) {
  const bordi = useSafeAreaInsets()
  // Era una prop, `tab`, che ogni schermata di scheda doveva ricordarsi di
  // passare — e da quando la barra vive fuori dal navigatore non basterebbe
  // più comunque: anche il dettaglio di un capo ce l'ha sotto. Adesso lo
  // spazio lo decide la stessa funzione che decide se la barra si vede.
  const percorso = usePathname()
  const paddingBottom = schedaDi(percorso) ? altezzaBarra(bordi.bottom) : 60
  const scrollRef = useRef<ScrollView>(null)
  // Il fondo pagina, asserito: è la sola ragione per cui `su="scuro"` esiste,
  // ed è il punto più esterno da cui ogni `Scheda`/testo nudo dentro
  // `children` eredita — oggi nessuna schermata lo passa ancora. Con una
  // `tavolozza` il fondo è per forza chiaro: vedi la prop.
  const fondo: Su = tavolozza ? 'chiaro' : (su ?? 'chiaro')

  return (
    <Fondo su={fondo}>
      <View style={{ flex: 1, backgroundColor: fondo === 'scuro' ? colori.inchiostro : undefined }}>
        {tavolozza ? <SfondoAura tavolozza={tavolozza} /> : null}
        <Testata
          occhiello={occhiello}
          titolo={titolo}
          indietro={indietro}
          onIndietro={onIndietro}
          fotoProfilo={fotoProfilo}
          azioni={azioni}
          su={fondo}
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
    </Fondo>
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
    <Fondo su="chiaro">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colori.sfondo }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* La tavolozza neutra, come `LIGHT.login` nel deck. */}
        <SfondoAura tavolozza="neutro" />
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
    </Fondo>
  )
}
