/**
 * Il login: email e password, niente altro.
 *
 * Chi non ha ancora un account passa da «Registrati» — l'allowlist del
 * server (`EMAIL_AMMESSE`) decide chi può crearne uno, non questa schermata.
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

export default function Accedi() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const bordi = useSafeAreaInsets()
  const { entra } = useSessione()

  const pronto = email.trim().length > 0 && password.length > 0 && !caricamento

  async function accedi() {
    setErrore(null)
    setCaricamento(true)
    try {
      const risposta = await api.auth.accedi({ email: email.trim(), password })
      // `ArchivioProvider` osserva il token e ricarica da solo quando cambia:
      // non serve chiamarlo qui, e farlo ora chiamerebbe comunque la sua
      // closure di questo render, con il token ancora quello di prima.
      entra(risposta.token)
      router.replace('/')
    } catch (e) {
      setErrore(e instanceof ErroreApi ? e.message : 'Impossibile contattare il server.')
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
          <Titolo>Bentornato.</Titolo>
          <Corpo tono="tenue">Accedi con le credenziali che ti sono state date.</Corpo>
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
          textContentType="password"
          placeholder="••••••••"
          onSubmitEditing={() => {
            if (pronto) void accedi()
          }}
        />

        {errore ? <Corpo style={{ color: colori.corallo }}>{errore}</Corpo> : null}

        <BottonePrimario
          testo={caricamento ? 'Accesso in corso…' : 'Accedi'}
          onPress={() => void accedi()}
          disabilitato={!pronto}
        />

        <Toccabile
          onPress={() => router.push('/registrati')}
          scala={0}
          style={{ alignItems: 'center', paddingVertical: 8 }}
        >
          <Corpo taglia={13.5} tono="tenue">
            Non hai un account? <Forte taglia={13.5}>Registrati</Forte>
          </Corpo>
        </Toccabile>
      </View>
    </KeyboardAvoidingView>
  )
}
