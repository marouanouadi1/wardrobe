/**
 * «Continua con Google», sul telefono: la scelta dell'account la fa Google, e
 * da lì arriva un `idToken` che Supabase Auth verifica (`accesso.ts`,
 * `signInWithIdToken`). Nessun client secret nell'app, nessun redirect.
 *
 * La libreria è `@react-native-google-signin/google-signin`, nella versione
 * gratuita: è quella che indica la guida di Supabase per Expo. Tre cose da
 * sapere, prima di toccarla:
 *
 * - **Non manda un nonce, e va bene così.** GoTrue rifiuta solo un nonce
 *   presente da una parte e assente dall'altra: senza nonce né nel token né
 *   nella richiesta, «Skip nonce check» nel pannello resta spento.
 * - **Il config plugin in `app.json` non c'è, di proposito.** Senza opzioni
 *   applica il plugin Google Services di Firebase, che vorrebbe un
 *   `google-services.json`; con le opzioni tocca solo iOS. Su Android basta
 *   l'autolinking. Quando arriverà iOS, il plugin torna con il suo
 *   `iosUrlScheme`.
 * - **Poggia sull'SDK Android di Google Sign-In che Google ha dichiarato
 *   superato.** Il ripiego, se un giorno Play Services lo togliesse, è una
 *   libreria su Credential Manager — ma allora il nonce diventa obbligatorio.
 *
 * **Si carica solo quando serve** (`import()` dentro le funzioni): il suo modulo
 * nativo si registra all'import, e chi non tocca «Continua con Google» — i
 * test delle primitive compresi, che arrivano fin qui passando dall'armadio —
 * non ha motivo di caricarlo.
 *
 * Sul web la libreria gratuita non accede: `google.web.ts`.
 */

import { ErroreDati } from './errori'

const libreria = () => import('@react-native-google-signin/google-signin')

/**
 * L'ID del client **Web** di Google Cloud: è l'`aud` del token, e Supabase lo
 * pretende primo nell'elenco «Client IDs» del provider. Serve anche un client
 * **Android** su Google Cloud, con il pacchetto `com.wardrobe.armadio` e lo
 * SHA-1 della chiave che firma l'APK (`apksigner verify --print-certs`, o `eas
 * credentials`): senza, Google risponde `DEVELOPER_ERROR`. Il suo ID non va
 * scritto da nessuna parte.
 */
const ID_CLIENT_WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

/** `null` se l'accesso con Google c'è; altrimenti il motivo, che il pulsante spento mostra. */
export const motivoGoogleSpento: string | null = ID_CLIENT_WEB
  ? null
  : 'L’accesso con Google non è ancora configurato su questa versione.'

let configurato = false

/**
 * La libreria, configurata una volta per processo: la chiamano sia l'ingresso
 * sia l'uscita. Dopo un riavvio la sessione torna dal portachiavi senza passare
 * dall'ingresso, e un'uscita che non configurasse da sé non uscirebbe da Google.
 */
async function configurata() {
  const moduli = await libreria()
  if (!configurato && ID_CLIENT_WEB) {
    moduli.GoogleSignin.configure({ webClientId: ID_CLIENT_WEB })
    configurato = true
  }
  return moduli
}

/** Il token di Google, o `null` se la persona ha chiuso la scelta dell'account. */
export async function idTokenGoogle(): Promise<string | null> {
  if (!ID_CLIENT_WEB) throw new ErroreDati('google_non_configurato', motivoGoogleSpento ?? '')
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await configurata()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const risposta = await GoogleSignin.signIn()
    if (!isSuccessResponse(risposta)) return null
    const token = risposta.data.idToken
    if (!token) throw new ErroreDati('google_senza_token', 'Google non mi ha dato un accesso valido: riprova.')
    return token
  } catch (errore) {
    if (errore instanceof ErroreDati) throw errore
    if (isErrorWithCode(errore)) {
      if (errore.code === statusCodes.SIGN_IN_CANCELLED) return null
      if (errore.code === statusCodes.IN_PROGRESS) return null
      if (errore.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new ErroreDati('google_senza_play', 'Su questo telefono mancano i servizi di Google.')
      }
    }
    console.warn('Google: accesso non riuscito', errore)
    throw new ErroreDati('google_fallito', 'L’accesso con Google non è riuscito. Riprova.')
  }
}

/** All'uscita: senza, la volta dopo Google riproporrebbe lo stesso account senza chiedere. */
export async function esciDaGoogle(): Promise<void> {
  if (!ID_CLIENT_WEB) return
  const { GoogleSignin } = await configurata()
  await GoogleSignin.signOut().catch(() => undefined)
}
