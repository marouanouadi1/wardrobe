/**
 * Cambiare la password, da dentro.
 *
 * Non chiede la vecchia: Supabase non la vuole (`supabase/config.toml`,
 * `secure_password_change`, e `Q-16` per chiederla). Chiede invece un codice
 * via email se l'accesso ha più di 24 ore: allora `cambiaPassword` lo fa
 * mandare, e qui compare il campo per scriverlo. Chi è entrato con Google e
 * non ha mai avuto una password ne sceglie una, e da lì può entrare anche con
 * quella.
 */

import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { cambiaPassword } from '../src/dati/accesso'
import { useArmadio } from '../src/dati/archivio'
import { ErroreDati, messaggioDiErrore } from '../src/dati/errori'
import { useAzione } from '../src/dati/risorsa'
import { spazi } from '../src/tema/tokens'
import { BottonePrimario, Campo } from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { Corpo, TestoErrore } from '../src/ui/testo'

/** Da 6 a 10 cifre: la lunghezza la decide il progetto Supabase, non l'app. */
const FORMATO_CODICE = /^\d{6,10}$/

export default function Password() {
  const { avvisa } = useArmadio()
  const [nuova, setNuova] = useState('')
  const [ripetuta, setRipetuta] = useState('')
  const [codice, setCodice] = useState('')
  const [serveCodice, setServeCodice] = useState(false)
  const { caricamento, errore, esegui } = useAzione<true>()

  const coincidono = nuova === ripetuta
  const pronto =
    nuova.length >= 8 && coincidono && (!serveCodice || FORMATO_CODICE.test(codice.trim())) && !caricamento

  async function salva() {
    const fatto = await esegui(
      async () => {
        await cambiaPassword(nuova, serveCodice ? codice : undefined)
        return true
      },
      (e) => {
        // Non è un fallimento: è il passo in più di chi è entrato da più di
        // un giorno. Il campo del codice compare, con la sua nota, e nessun
        // errore in rosso.
        if (e instanceof ErroreDati && e.codice === 'serve_codice') {
          setServeCodice(true)
          return ''
        }
        return messaggioDiErrore(e, 'Non riesco a raggiungere il server.')
      },
    )
    if (fatto) {
      avvisa('Password cambiata.')
      router.back()
    }
  }

  return (
    <Schermata occhiello="" titolo="Password" tavolozza="neutro" indietro contentStyle={{ gap: spazi.l }}>
      <Corpo taglia={13} tono="tenue">
        Almeno 8 caratteri. Da qui in poi entri con questa.
      </Corpo>

      <View style={{ gap: spazi.m }}>
        <Campo
          etichetta="Password nuova"
          value={nuova}
          onChangeText={setNuova}
          rivelabile
          textContentType="newPassword"
          placeholder="almeno 8 caratteri"
        />
        <Campo
          etichetta="Ripetila"
          value={ripetuta}
          onChangeText={setRipetuta}
          secureTextEntry
          textContentType="newPassword"
          placeholder="la stessa di sopra"
        />
        {ripetuta.length > 0 && !coincidono ? <TestoErrore>Le due password non coincidono.</TestoErrore> : null}
        {serveCodice ? (
          <>
            <Corpo taglia="micro" tono="tenue">
              Per sicurezza ti ho mandato un codice via email: scrivilo qui sotto.
            </Corpo>
            <Campo
              etichetta="Codice dall’email"
              value={codice}
              onChangeText={(testo) => setCodice(testo.replace(/\D/g, ''))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="le cifre dell’email"
            />
          </>
        ) : null}
        {errore ? <TestoErrore>{errore}</TestoErrore> : null}
      </View>

      <BottonePrimario testo="Salva" caricando={caricamento} onPress={() => void salva()} disabilitato={!pronto} />
    </Schermata>
  )
}
