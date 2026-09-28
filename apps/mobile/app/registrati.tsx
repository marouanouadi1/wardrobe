/**
 * La registrazione, in tre passi: l'email, il codice che arriva lì, la password.
 *
 * **La password viene per ultima, di proposito.** Si sceglie a sessione
 * aperta, dopo che il codice ha dimostrato di chi è l'email: una password
 * accettata prima permetterebbe a chi conosce un'email invitata di sceglierla al
 * posto del titolare (audit di `security`, fase 3; `accesso.ts`).
 *
 * Pubblica ma non aperta: la lista degli inviti vive nel database (l'hook di
 * Supabase Auth), non qui — questa schermata non sa in anticipo chi può
 * registrarsi, lo scopre dalla risposta, come qualunque altro errore.
 *
 * **I passi sono stati, non rotte** (`.claude/rules/react-native.md`). Ci si
 * arriva anche dall'accesso con `?conferma=<email>`, quando un account non
 * ancora confermato prova a entrare: allora il codice è già partito, e si parte
 * da lì.
 */

import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import {
  accediConGoogle,
  cambiaPassword,
  chiediCodiceDiIngresso,
  motivoGoogleSpento,
  verificaCodice,
} from '../src/dati/accesso'
import { useAzione } from '../src/dati/risorsa'
import { spazi } from '../src/tema/tokens'
import { BottonePrimario, Campo, LinkTesto } from '../src/ui/base'
import { Corpo, Forte, TestoErrore } from '../src/ui/testo'
import { GuscioAutenticazione, PiedeAccesso } from '../src/ui/guscio'

/** Solo una verifica di forma: basta a scartare un errore di battitura prima di scomodare la rete. */
const FORMATO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Da 6 a 10 cifre: la lunghezza la decide il progetto Supabase, non l'app. */
const FORMATO_CODICE = /^\d{6,10}$/

type Passo = 'email' | 'codice' | 'password'

export default function Registrati() {
  const { conferma } = useLocalSearchParams<{ conferma?: string }>()
  const [email, setEmail] = useState(conferma ?? '')
  const [codice, setCodice] = useState('')
  const [password, setPassword] = useState('')
  const [ripetuta, setRipetuta] = useState('')
  const [passo, setPasso] = useState<Passo>(conferma ? 'codice' : 'email')
  const [rimandato, setRimandato] = useState(false)
  const invio = useAzione<true>()
  const verifica = useAzione<true>()
  const scelta = useAzione<true>()
  const conGoogle = useAzione<boolean>()

  const emailPronta = FORMATO_EMAIL.test(email.trim()) && !invio.caricamento
  const codicePronto = FORMATO_CODICE.test(codice.trim()) && !verifica.caricamento
  const coincidono = password === ripetuta
  const passwordPronta = password.length >= 8 && coincidono && !scelta.caricamento

  async function manda() {
    const fatto = await invio.esegui(async () => {
      await chiediCodiceDiIngresso(email)
      return true
    })
    if (fatto) {
      setRimandato(passo === 'codice')
      setPasso('codice')
    }
  }

  async function verificaIlCodice() {
    const dentro = await verifica.esegui(async () => {
      await verificaCodice(email, codice)
      return true
    })
    if (dentro) setPasso('password')
  }

  async function scegliPassword() {
    const fatto = await scelta.esegui(async () => {
      await cambiaPassword(password)
      return true
    })
    // Un account nuovo: `index.tsx` lo manda ai passi del primo accesso.
    if (fatto) router.replace('/')
  }

  async function entraConGoogle() {
    const dentro = await conGoogle.esegui(() => accediConGoogle())
    if (dentro) router.replace('/')
  }

  function tornaAllEmail() {
    setCodice('')
    setRimandato(false)
    setPasso('email')
  }

  if (passo === 'password') {
    return (
      <GuscioAutenticazione
        occhiello="PASSO 1 DI 3"
        titolo="Scegli la password"
        sottotitolo="L’email è tua: adesso la password con cui entrerai."
        errore={scelta.errore}
        onLinkFantasma={() => router.replace('/')}
        testoLinkFantasma={
          <>
            Preferisci sceglierla dopo? <Forte taglia="corpo">Entra</Forte>
          </>
        }
        azione={
          <BottonePrimario
            testo="Continua"
            caricando={scelta.caricamento}
            onPress={() => void scegliPassword()}
            disabilitato={!passwordPronta}
          />
        }
      >
        <Campo
          etichetta="Password"
          value={password}
          onChangeText={setPassword}
          rivelabile
          textContentType="newPassword"
          placeholder="almeno 8 caratteri"
        />
        <View style={{ gap: spazi.s }}>
          <Campo
            etichetta="Conferma password"
            value={ripetuta}
            onChangeText={setRipetuta}
            secureTextEntry
            textContentType="newPassword"
            placeholder="ripetila"
            onSubmitEditing={() => {
              if (passwordPronta) void scegliPassword()
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
        occhiello="PASSO 1 DI 3"
        titolo="Controlla la tua email"
        sottotitolo={`Ti ho mandato un codice a ${email.trim()}. Scrivilo qui.`}
        errore={verifica.errore ?? invio.errore}
        piede={
          rimandato ? (
            <Corpo taglia="micro" tono="debole" style={{ textAlign: 'center' }}>
              Te ne ho mandato uno nuovo: vale l’ultimo arrivato.
            </Corpo>
          ) : (
            <LinkTesto taglia="micro" onPress={invio.caricamento ? undefined : () => void manda()}>
              Non è arrivato? Mandamene un altro
            </LinkTesto>
          )
        }
        onLinkFantasma={tornaAllEmail}
        testoLinkFantasma={
          <>
            Email sbagliata? <Forte taglia="corpo">Torna indietro</Forte>
          </>
        }
        azione={
          <BottonePrimario
            testo="Conferma"
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
      occhiello="PASSO 1 DI 3"
      titolo="Crea il tuo account"
      sottotitolo="Serve un invito: la tua email deve essere nella lista. Ti mando un codice per confermarla."
      errore={invio.errore ?? conGoogle.errore}
      piede={
        <PiedeAccesso
          google={{
            onPress: () => void entraConGoogle(),
            caricando: conGoogle.caricamento,
            motivo: motivoGoogleSpento,
          }}
        />
      }
      onLinkFantasma={() => router.back()}
      testoLinkFantasma={
        <>
          Hai già un account? <Forte taglia="corpo">Accedi</Forte>
        </>
      }
      azione={
        <BottonePrimario
          testo="Mandami il codice"
          caricando={invio.caricamento}
          onPress={() => void manda()}
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
          if (emailPronta) void manda()
        }}
      />
    </GuscioAutenticazione>
  )
}
