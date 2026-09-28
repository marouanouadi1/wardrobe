/**
 * «Password dimenticata?»: l'email, il codice, la password nuova.
 *
 * Per un'email senza account Supabase non manda niente e non lo dice, perché
 * rispondere diversamente rivelerebbe chi è iscritto. Per questo il passo del
 * codice si apre per tutti, con le stesse parole: «se c'è un account, ti è
 * arrivato un codice».
 *
 * **Il codice e la password sono due passi.** Il codice si consuma quando lo si
 * verifica, e apre la sessione: se poi la password non va — troppo corta, la
 * stessa di prima, la rete — si riprova la password, non il codice, che non
 * varrebbe più. Come in `registrati.tsx`, i passi sono stati di una schermata,
 * non rotte.
 */

import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { cambiaPassword, chiediRecupero, verificaRecupero } from '../src/dati/accesso'
import { useAzione } from '../src/dati/risorsa'
import { spazi } from '../src/tema/tokens'
import { BottonePrimario, Campo, LinkTesto } from '../src/ui/base'
import { Corpo, Forte, TestoErrore } from '../src/ui/testo'
import { GuscioAutenticazione } from '../src/ui/guscio'

const FORMATO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Da 6 a 10 cifre: la lunghezza la decide il progetto Supabase, non l'app. */
const FORMATO_CODICE = /^\d{6,10}$/

type Passo = 'email' | 'codice' | 'password'

export default function Recupero() {
  const parametri = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(parametri.email ?? '')
  const [codice, setCodice] = useState('')
  const [nuova, setNuova] = useState('')
  const [ripetuta, setRipetuta] = useState('')
  const [passo, setPasso] = useState<Passo>('email')
  const [rimandato, setRimandato] = useState(false)
  const richiesta = useAzione<true>()
  const verifica = useAzione<true>()
  const scelta = useAzione<true>()

  const emailPronta = FORMATO_EMAIL.test(email.trim()) && !richiesta.caricamento
  const codicePronto = FORMATO_CODICE.test(codice.trim()) && !verifica.caricamento
  const coincidono = nuova === ripetuta
  const passwordPronta = nuova.length >= 8 && coincidono && !scelta.caricamento

  async function chiedi() {
    const fatto = await richiesta.esegui(async () => {
      await chiediRecupero(email)
      return true
    })
    if (fatto) {
      setRimandato(passo === 'codice')
      setPasso('codice')
    }
  }

  async function verificaIlCodice() {
    const dentro = await verifica.esegui(async () => {
      await verificaRecupero(email, codice)
      return true
    })
    if (dentro) setPasso('password')
  }

  async function salva() {
    const fatto = await scelta.esegui(async () => {
      await cambiaPassword(nuova)
      return true
    })
    if (fatto) router.replace('/')
  }

  if (passo === 'password') {
    return (
      <GuscioAutenticazione
        occhiello="PASSWORD NUOVA"
        titolo="Scegli la password nuova"
        sottotitolo="Il codice è giusto: sei dentro. Adesso la password con cui entrerai."
        errore={scelta.errore}
        onLinkFantasma={() => router.replace('/')}
        testoLinkFantasma={
          <>
            Preferisci sceglierla dopo? <Forte taglia="corpo">Entra</Forte>
          </>
        }
        azione={
          <BottonePrimario
            testo="Salva ed entra"
            caricando={scelta.caricamento}
            onPress={() => void salva()}
            disabilitato={!passwordPronta}
          />
        }
      >
        <Campo
          etichetta="Password nuova"
          value={nuova}
          onChangeText={setNuova}
          rivelabile
          textContentType="newPassword"
          placeholder="almeno 8 caratteri"
        />
        <View style={{ gap: spazi.s }}>
          <Campo
            etichetta="Ripetila"
            value={ripetuta}
            onChangeText={setRipetuta}
            secureTextEntry
            textContentType="newPassword"
            placeholder="la stessa di sopra"
            onSubmitEditing={() => {
              if (passwordPronta) void salva()
            }}
          />
          {ripetuta.length > 0 && !coincidono ? <TestoErrore>Le due password non coincidono.</TestoErrore> : null}
        </View>
      </GuscioAutenticazione>
    )
  }

  if (passo === 'codice') {
    return (
      <GuscioAutenticazione
        occhiello="PASSWORD DIMENTICATA"
        titolo="Controlla la tua email"
        sottotitolo={`Se c’è un account con ${email.trim()}, ti è arrivato un codice. Scrivilo qui.`}
        errore={verifica.errore ?? richiesta.errore}
        piede={
          rimandato ? (
            <Corpo taglia="micro" tono="debole" style={{ textAlign: 'center' }}>
              Te ne ho mandato uno nuovo: vale l’ultimo arrivato.
            </Corpo>
          ) : (
            <LinkTesto taglia="micro" onPress={richiesta.caricamento ? undefined : () => void chiedi()}>
              Non è arrivato? Mandamene un altro
            </LinkTesto>
          )
        }
        onLinkFantasma={() => {
          setCodice('')
          setRimandato(false)
          setPasso('email')
        }}
        testoLinkFantasma={
          <>
            Email sbagliata? <Forte taglia="corpo">Torna indietro</Forte>
          </>
        }
        azione={
          <BottonePrimario
            testo="Continua"
            caricando={verifica.caricamento}
            onPress={() => void verificaIlCodice()}
            disabilitato={!codicePronto}
          />
        }
      >
        <Campo
          etichetta="Codice"
          value={codice}
          onChangeText={(testo) => setCodice(testo.replace(/\D/g, ''))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          placeholder="le cifre dell’email"
          onSubmitEditing={() => {
            if (codicePronto) void verificaIlCodice()
          }}
        />
      </GuscioAutenticazione>
    )
  }

  return (
    <GuscioAutenticazione
      occhiello="PASSWORD DIMENTICATA"
      titolo="Ti mando un codice"
      sottotitolo="Scrivi l’email con cui ti sei registrato: ti arriva un codice per sceglierne una nuova."
      errore={richiesta.errore}
      onLinkFantasma={() => router.back()}
      testoLinkFantasma={
        <>
          Te la sei ricordata? <Forte taglia="corpo">Accedi</Forte>
        </>
      }
      azione={
        <BottonePrimario
          testo="Mandami il codice"
          caricando={richiesta.caricamento}
          onPress={() => void chiedi()}
          disabilitato={!emailPronta}
        />
      }
    >
      <Campo
        etichetta="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="nome@esempio.it"
        onSubmitEditing={() => {
          if (emailPronta) void chiedi()
        }}
      />
    </GuscioAutenticazione>
  )
}
