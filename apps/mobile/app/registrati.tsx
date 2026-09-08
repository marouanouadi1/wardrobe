/**
 * La registrazione: email, password, conferma password.
 *
 * Pubblica ma non aperta: l'allowlist vive sul server (`EMAIL_AMMESSE`), non
 * qui — questa schermata non sa in anticipo chi può registrarsi, lo scopre
 * dalla risposta del backend, come qualunque altro errore.
 */

import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ErroreApi, api } from '../src/dati/api'
import { useSessione } from '../src/dati/sessione'
import { colori, spazi } from '../src/tema/tokens'
import { BottonePrimario, Campo, Toccabile } from '../src/ui/base'
import { Corpo, Forte, Titolo } from '../src/ui/testo'

/** Solo una verifica di forma, come sul backend (`domain/autenticazione.py`):
 * basta a scartare un errore di battitura prima di scomodare la rete. */
const FORMATO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function Registrati() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const bordi = useSafeAreaInsets()
  const { entra } = useSessione()

  const emailValida = FORMATO_EMAIL.test(email.trim())
  const passwordValida = password.length >= 8
  const passwordCorrispondono = password === conferma
  const pronto = emailValida && passwordValida && passwordCorrispondono && !caricamento

  async function registrati() {
    setErrore(null)
    setCaricamento(true)
    try {
      const risposta = await api.auth.registrati({ email: email.trim(), password })
      // `ArchivioProvider` osserva il token e carica l'armadio (vuoto, per un
      // account nuovo) da solo quando cambia.
      entra(risposta.token)
      router.replace('/')
    } catch (e) {
      if (e instanceof ErroreApi && e.codice === 'registrazione_non_ammessa') {
        setErrore('Questa email non è nella lista degli inviti: chiedi a chi gestisce il server.')
      } else if (e instanceof ErroreApi && e.codice === 'email_gia_registrata') {
        setErrore('C\'è già un account con questa email: prova ad accedere invece.')
      } else {
        setErrore(e instanceof ErroreApi ? e.message : 'Impossibile contattare il server.')
      }
    } finally {
      setCaricamento(false)
    }
  }

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
          <Titolo>Crea il tuo account.</Titolo>
          <Corpo tono="tenue">Serve un invito: la tua email deve essere nella lista.</Corpo>
        </View>

        <Campo
          etichetta="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="nome@esempio.it"
        />

        <Campo
          etichetta="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="almeno 8 caratteri"
        />

        <View style={{ gap: spazi.s }}>
          <Campo
            etichetta="Conferma password"
            value={conferma}
            onChangeText={setConferma}
            secureTextEntry
            textContentType="newPassword"
            placeholder="ripetila"
            onSubmitEditing={() => {
              if (pronto) void registrati()
            }}
          />
          {conferma.length > 0 && !passwordCorrispondono ? (
            <Corpo taglia={12.5} style={{ color: colori.corallo }}>
              Le due password non coincidono.
            </Corpo>
          ) : null}
        </View>

        {errore ? <Corpo style={{ color: colori.corallo }}>{errore}</Corpo> : null}

        <BottonePrimario
          testo={caricamento ? 'Creazione in corso…' : 'Crea account'}
          onPress={() => void registrati()}
          disabilitato={!pronto}
        />

        <Toccabile
          onPress={() => router.back()}
          scala={0}
          style={{ alignItems: 'center', paddingVertical: 8 }}
        >
          <Corpo taglia={13.5} tono="tenue">
            Hai già un account? <Forte taglia={13.5}>Accedi</Forte>
          </Corpo>
        </Toccabile>
      </View>
    </KeyboardAvoidingView>
  )
}
