/**
 * «Continua con Google», sul web: non c'è. La libreria gratuita accede solo da
 * Android e iOS, e il web serve allo sviluppo. Il pulsante resta spento, con
 * il motivo; sul telefono è `google.ts`.
 */

import { ErroreDati } from './errori'

export const motivoGoogleSpento: string | null = 'Con Google si entra dall’app sul telefono, non dal browser.'

export async function idTokenGoogle(): Promise<string | null> {
  throw new ErroreDati('google_non_disponibile', motivoGoogleSpento ?? '')
}

export async function esciDaGoogle(): Promise<void> {}
