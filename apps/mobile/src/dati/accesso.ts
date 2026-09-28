/**
 * Entrare, uscire, e tutto quello che sta in mezzo: le funzioni di Supabase
 * Auth che le schermate di accesso chiamano. Chi è dentro lo dice
 * `sessione.tsx`, che ascolta i cambi di sessione: qui non si restituisce un
 * token a nessuno.
 *
 * **Prima si dimostra l'email, poi si sceglie la password.** La registrazione
 * e il recupero hanno la stessa forma: l'email, il codice che arriva lì, e solo
 * a sessione aperta la password. L'app non manda mai una password prima del
 * codice. Non è una preferenza: con la registrazione aperta a chi è negli
 * inviti, una password accettata prima della prova permetteva a chi conosceva
 * un'email invitata di sceglierla al posto del titolare (audit di `security`,
 * fase 3). Il database fa la sua metà: alla prima conferma dopo un codice la
 * password che c'era si toglie (`privato.password_solo_dopo_la_prova`).
 *
 * **Le email portano un codice, non un link** (`supabase/templates/`): niente
 * deep link, niente sito a cui tornare. Il codice può essere lungo da 6 a 10
 * cifre, secondo com'è impostato il progetto: nessuna schermata ne presuppone
 * una lunghezza.
 *
 * Gli errori arrivano come `ErroreDati` con un codice nostro e un testo per chi
 * usa l'app. I codici di Supabase sono quelli osservati sullo stack locale, non
 * indovinati; il rifiuto dell'hook degli inviti non ne ha uno suo — arriva come
 * `403` con `code: 'unknown'` e il testo scritto nella migrazione.
 */

import type { AuthError } from '@supabase/supabase-js'
import { ErroreDati } from './errori'
import { esciDaGoogle, idTokenGoogle } from './google'
import { clientAuth } from './supabase'

export { motivoGoogleSpento } from './google'

const TESTI: Record<string, string> = {
  invalid_credentials: 'Email o password sbagliate.',
  email_not_confirmed: 'Devi ancora confermare la tua email: ti mando un codice.',
  otp_expired: 'Il codice non è giusto, o è scaduto. Controlla l’ultima email, o chiedine un altro.',
  weak_password: 'La password deve avere almeno 8 caratteri.',
  same_password: 'È la password che hai già: scegline una diversa.',
  over_email_send_rate_limit: 'Ti ho appena mandato un codice: aspetta un momento prima di chiederne un altro.',
  over_request_rate_limit: 'Troppi tentativi: aspetta qualche minuto e riprova.',
  email_address_not_authorized: 'Non riesco ancora a mandare email a questo indirizzo.',
  reauthentication_not_valid: 'Il codice non è giusto, o è scaduto.',
  provider_disabled: 'L’accesso con Google non è ancora attivo.',
}

/** I codici di Supabase che diventano un codice nostro diverso: le schermate decidono su questi. */
const CODICI: Record<string, string> = {
  email_not_confirmed: 'email_da_confermare',
  reauthentication_needed: 'serve_codice',
}

function tradotto(errore: AuthError): ErroreDati {
  // L'hook degli inviti rifiuta con un 403 senza codice: è l'unico 403 che
  // una registrazione può ricevere, e il suo testo è già il nostro.
  if (errore.status === 403 && (!errore.code || errore.code === 'unknown')) {
    return new ErroreDati('non_invitato', errore.message || 'Questa email non è nella lista degli inviti.')
  }
  const codice = errore.code ?? 'errore_sconosciuto'
  if (!TESTI[codice] && !CODICI[codice]) console.warn('Supabase Auth:', codice, errore.message)
  return new ErroreDati(CODICI[codice] ?? codice, TESTI[codice] ?? 'Non è andata: riprova fra poco.')
}

function controlla(risposta: { error: AuthError | null }): void {
  if (risposta.error) throw tradotto(risposta.error)
}

const normale = (email: string) => email.trim().toLowerCase()

// ── con la password ─────────────────────────────────────────────────────────

export async function accedi(email: string, password: string): Promise<void> {
  controlla(await clientAuth.signInWithPassword({ email: normale(email), password }))
}

// ── registrazione: email, codice, password ─────────────────────────────────

/**
 * Manda il codice per entrare, creando l'account se non c'è: la lista degli
 * inviti la applica l'hook, come a ogni account nuovo. Per un account che c'è
 * già arriva un codice d'accesso, e da lì si sceglie una password nuova: è la
 * stessa prova del recupero, l'email.
 */
export async function chiediCodiceDiIngresso(email: string): Promise<void> {
  controlla(await clientAuth.signInWithOtp({ email: normale(email), options: { shouldCreateUser: true } }))
}

/** Il codice dell'email: da qui si è dentro, e la password si sceglie con `cambiaPassword`. */
export async function verificaCodice(email: string, codice: string): Promise<void> {
  controlla(await clientAuth.verifyOtp({ email: normale(email), token: codice.trim(), type: 'email' }))
}

// ── password dimenticata: email, codice, password ──────────────────────────

/**
 * Manda il codice per una password nuova. Per un'email che non ha un account
 * Supabase non manda niente e **non lo dice**, e la schermata risponde a tutti
 * con le stesse parole.
 *
 * Un tampone, dichiarato: il limite d'invio (`over_email_send_rate_limit`)
 * scatta solo per un'email che un account ce l'ha, e mostrarlo direbbe chi è
 * iscritto. Qui vale come riuscito — il codice di prima c'è, ed è quello da
 * usare. La differenza resta visibile a chi chiama l'API a mano: la causa è in
 * GoTrue, e dall'app non si toglie.
 */
export async function chiediRecupero(email: string): Promise<void> {
  const risposta = await clientAuth.resetPasswordForEmail(normale(email))
  if (risposta.error?.code === 'over_email_send_rate_limit') return
  controlla(risposta)
}

/**
 * Il codice apre una sessione di recupero. La password nuova si sceglie dopo,
 * con `cambiaPassword`, **in un passo a sé**: il codice è consumato qui, e un
 * secondo tentativo della password non deve ripresentarlo.
 */
export async function verificaRecupero(email: string, codice: string): Promise<void> {
  controlla(await clientAuth.verifyOtp({ email: normale(email), token: codice.trim(), type: 'recovery' }))
}

// ── la password, a sessione aperta ─────────────────────────────────────────

/**
 * La password nuova. Passate 24 ore dall'accesso Supabase vuole prima un
 * codice via email (`secure_password_change`): allora questa funzione lo fa
 * mandare e lancia `serve_codice`, e la schermata richiama con il codice.
 */
export async function cambiaPassword(nuova: string, codice?: string): Promise<void> {
  const risposta = await clientAuth.updateUser(codice ? { password: nuova, nonce: codice.trim() } : { password: nuova })
  if (risposta.error?.code === 'reauthentication_needed') {
    controlla(await clientAuth.reauthenticate())
    throw new ErroreDati('serve_codice', 'Per sicurezza ti ho mandato un codice via email: scrivilo qui sotto.')
  }
  controlla(risposta)
}

// ── Google ──────────────────────────────────────────────────────────────────

/**
 * «Continua con Google». `false` se la persona ha chiuso la scelta
 * dell'account: non è un errore, e non si mostra niente. Un'email Google fuori
 * dalla lista degli inviti la rifiuta lo stesso hook della registrazione.
 */
export async function accediConGoogle(): Promise<boolean> {
  const token = await idTokenGoogle()
  if (!token) return false
  controlla(await clientAuth.signInWithIdToken({ provider: 'google', token }))
  return true
}

// ── uscita ──────────────────────────────────────────────────────────────────

/**
 * Esce da questo telefono **e dagli altri**: `signOut()` di Supabase revoca le
 * sessioni ovunque. Se sia la scelta giusta per l'app è `Q-17`. Anche senza
 * rete la sessione di qui si toglie: lo fa supabase-js da sé.
 */
export async function esci(): Promise<void> {
  await esciDaGoogle()
  await clientAuth.signOut()
}
