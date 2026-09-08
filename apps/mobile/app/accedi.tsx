/**
 * Il login: email e password, niente altro.
 *
 * Chi non ha ancora un account passa da «Registrati» — l'allowlist del
 * server (`EMAIL_AMMESSE`) decide chi può crearne uno, non questa schermata.
 */

import type { TokenAccesso } from '@wardrobe/contracts'
import { router } from 'expo-router'
import { useState } from 'react'
import { api } from '../src/dati/api'
import { useAzione } from '../src/dati/risorsa'
import { useSessione } from '../src/dati/sessione'
import { BottonePrimario, Campo } from '../src/ui/base'
import { Forte } from '../src/ui/testo'
import { GuscioAutenticazione } from '../src/ui/guscio'

export default function Accedi() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { caricamento, errore, esegui } = useAzione<TokenAccesso>()
  const { entra } = useSessione()

  const pronto = email.trim().length > 0 && password.length > 0 && !caricamento

  async function accedi() {
    const risposta = await esegui(() => api.auth.accedi({ email: email.trim(), password }))
    if (risposta) {
      // `ArchivioProvider` osserva il token e ricarica da solo quando cambia:
      // non serve chiamarlo qui, e farlo ora chiamerebbe comunque la sua
      // closure di questo render, con il token ancora quello di prima.
      entra(risposta.token)
      router.replace('/')
    }
  }

  return (
    <GuscioAutenticazione
      titolo="Bentornato."
      sottotitolo="Accedi con le credenziali che ti sono state date."
      errore={errore}
      onLinkFantasma={() => router.push('/registrati')}
      testoLinkFantasma={
        <>
          Non hai un account? <Forte taglia={13.5}>Registrati</Forte>
        </>
      }
      azione={
        <BottonePrimario
          testo="Accedi"
          caricando={caricamento}
          onPress={() => void accedi()}
          disabilitato={!pronto}
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
    </GuscioAutenticazione>
  )
}
