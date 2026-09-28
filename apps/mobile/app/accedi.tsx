/**
 * L'accesso: email e password, o Google.
 *
 * Chi non ha ancora un account passa da «Registrati». Chi può crearne uno lo
 * decide la lista degli inviti sul database (l'hook di Supabase Auth), non
 * questa schermata. Un account che c'è ma non è stato confermato torna al passo
 * del codice della registrazione, con un codice nuovo: la password la sceglie
 * lì, dopo il codice (`registrati.tsx` spiega perché).
 */

import { router } from 'expo-router'
import { useState } from 'react'
import { accedi, accediConGoogle, chiediCodiceDiIngresso, motivoGoogleSpento } from '../src/dati/accesso'
import { ErroreDati, messaggioDiErrore } from '../src/dati/errori'
import { useAzione } from '../src/dati/risorsa'
import { BottonePrimario, Campo } from '../src/ui/base'
import { Forte } from '../src/ui/testo'
import { GuscioAutenticazione, PiedeAccesso } from '../src/ui/guscio'

export default function Accedi() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const conPassword = useAzione<true>()
  const conGoogle = useAzione<boolean>()

  const pronto = email.trim().length > 0 && password.length > 0 && !conPassword.caricamento

  async function entra() {
    let daConfermare = false
    const dentro = await conPassword.esegui(
      async () => {
        await accedi(email, password)
        return true
      },
      (errore) => {
        daConfermare = errore instanceof ErroreDati && errore.codice === 'email_da_confermare'
        return messaggioDiErrore(errore, 'Non riesco a raggiungere il server.')
      },
    )
    if (daConfermare) {
      // Il codice della registrazione può essere scaduto: se ne manda uno
      // nuovo, e lo si aspetta dove si aspetta sempre.
      void chiediCodiceDiIngresso(email).catch(() => undefined)
      router.push({ pathname: '/registrati', params: { conferma: email.trim() } })
      return
    }
    // Chi è dentro lo annuncia `sessione.tsx`, e `ArchivioProvider` carica da
    // solo: qui basta tornare all'ingresso, che sa dove mandare.
    if (dentro) router.replace('/')
  }

  async function entraConGoogle() {
    const dentro = await conGoogle.esegui(() => accediConGoogle())
    if (dentro) router.replace('/')
  }

  return (
    <GuscioAutenticazione
      occhiello="IL TUO ARMADIO TI ASPETTA"
      titolo="Accedi"
      sottotitolo="Con la tua email, o con Google."
      errore={conPassword.errore ?? conGoogle.errore}
      piede={
        <PiedeAccesso
          onRecupero={() => router.push({ pathname: '/recupero', params: { email: email.trim() } })}
          google={{
            onPress: () => void entraConGoogle(),
            caricando: conGoogle.caricamento,
            motivo: motivoGoogleSpento,
          }}
        />
      }
      onLinkFantasma={() => router.push('/registrati')}
      testoLinkFantasma={
        <>
          Non hai un account? <Forte taglia="corpo">Registrati</Forte>
        </>
      }
      azione={
        <BottonePrimario
          testo="Entra"
          caricando={conPassword.caricamento}
          onPress={() => void entra()}
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
        rivelabile
        textContentType="password"
        placeholder="••••••••"
        onSubmitEditing={() => {
          if (pronto) void entra()
        }}
      />
    </GuscioAutenticazione>
  )
}
