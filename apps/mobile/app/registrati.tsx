/**
 * La registrazione: email, password, conferma password.
 *
 * Pubblica ma non aperta: l'allowlist vive sul server (`EMAIL_AMMESSE`), non
 * qui — questa schermata non sa in anticipo chi può registrarsi, lo scopre
 * dalla risposta del backend, come qualunque altro errore.
 */

import type { TokenAccesso } from '@wardrobe/contracts'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { ErroreApi, api, messaggioDiErrore } from '../src/dati/api'
import { useAzione } from '../src/dati/risorsa'
import { useSessione } from '../src/dati/sessione'
import { colori, spazi } from '../src/tema/tokens'
import { BottonePrimario, Campo } from '../src/ui/base'
import { Corpo, Forte } from '../src/ui/testo'
import { GuscioAutenticazione } from '../src/ui/guscio'

/** Solo una verifica di forma, come sul backend (`domain/autenticazione.py`):
 * basta a scartare un errore di battitura prima di scomodare la rete. */
const FORMATO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function Registrati() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const { caricamento, errore, esegui } = useAzione<TokenAccesso>()
  const { entra } = useSessione()

  const emailValida = FORMATO_EMAIL.test(email.trim())
  const passwordValida = password.length >= 8
  const passwordCorrispondono = password === conferma
  const pronto = emailValida && passwordValida && passwordCorrispondono && !caricamento

  async function registrati() {
    const risposta = await esegui(
      () => api.auth.registrati({ email: email.trim(), password }),
      (e) => {
        if (e instanceof ErroreApi && e.codice === 'registrazione_non_ammessa') {
          return 'Questa email non è nella lista degli inviti: chiedi a chi gestisce il server.'
        }
        if (e instanceof ErroreApi && e.codice === 'email_gia_registrata') {
          return "C'è già un account con questa email: prova ad accedere invece."
        }
        return messaggioDiErrore(e, 'Impossibile contattare il server.')
      },
    )
    if (risposta) {
      // `ArchivioProvider` osserva il token e carica l'armadio (vuoto, per un
      // account nuovo) da solo quando cambia.
      entra(risposta.token)
      router.replace('/')
    }
  }

  return (
    <GuscioAutenticazione
      titolo="Crea il tuo account."
      sottotitolo="Serve un invito: la tua email deve essere nella lista."
      errore={errore}
      onLinkFantasma={() => router.back()}
      testoLinkFantasma={
        <>
          Hai già un account? <Forte taglia={13.5}>Accedi</Forte>
        </>
      }
      azione={
        <BottonePrimario
          testo="Crea account"
          caricando={caricamento}
          onPress={() => void registrati()}
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
    </GuscioAutenticazione>
  )
}
