/**
 * Il login: email e password, niente altro.
 *
 * Non c'è un self-signup qui dentro di proposito — gli account per questa
 * beta li crea chi gestisce il server (`scripts/crea_utente.py`), non un
 * modulo di registrazione raggiungibile da chiunque trovi l'indirizzo
 * dell'app. Vedi `docs/adr` per il perché di questa scelta.
 */

import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ErroreApi, api, impostaToken } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { colori, linee, raggi, spazi } from '../src/tema/tokens'
import { BottonePrimario } from '../src/ui/base'
import { Corpo, Etichetta, Titolo } from '../src/ui/testo'

const stileCampo = {
  paddingHorizontal: 16,
  paddingVertical: 14,
  borderRadius: raggi.piccolo,
  borderWidth: 1,
  borderColor: linee.chiara,
  backgroundColor: colori.scheda,
  fontFamily: 'Manrope_500Medium',
  fontSize: 15,
  color: colori.inchiostro,
} as const

export default function Accedi() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const bordi = useSafeAreaInsets()
  const { ricarica } = useArmadio()

  const pronto = email.trim().length > 0 && password.length > 0 && !caricamento

  async function accedi() {
    setErrore(null)
    setCaricamento(true)
    try {
      const risposta = await api.auth.accedi({ email: email.trim(), password })
      impostaToken(risposta.token)
      // Il caricamento iniziale dell'armadio, all'avvio dell'app, era partito
      // vuoto proprio perché non c'era ancora un token: va rifatto adesso,
      // altrimenti l'utente entra e vede un armadio vuoto finché non riavvia.
      await ricarica()
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

        <View style={{ gap: spazi.s }}>
          <Etichetta>Email</Etichetta>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="nome@esempio.it"
            placeholderTextColor="rgba(21,21,26,0.4)"
            style={stileCampo}
          />
        </View>

        <View style={{ gap: spazi.s }}>
          <Etichetta>Password</Etichetta>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor="rgba(21,21,26,0.4)"
            style={stileCampo}
            onSubmitEditing={() => {
              if (pronto) void accedi()
            }}
          />
        </View>

        {errore ? <Corpo style={{ color: colori.corallo }}>{errore}</Corpo> : null}

        <BottonePrimario
          testo={caricamento ? 'Accesso in corso…' : 'Accedi'}
          onPress={() => void accedi()}
          disabilitato={!pronto}
        />
      </View>
    </KeyboardAvoidingView>
  )
}
