/**
 * Le segnalazioni: come chi prova l'app ci dice che qualcosa non va.
 *
 * Sentry è qui per una cosa sola — il modulo di feedback — non per la
 * telemetria. Da qui due assenze deliberate: `app.json` non dichiara il
 * config plugin di Sentry e `metro.config.js` è rimasto quello del monorepo.
 * Quel pezzo serve solo a caricare le source map, che rendono leggibili gli
 * stack trace dei crash: senza crash da leggere sarebbe un passo di build in
 * più, un auth token da tenere su EAS e una riscrittura di `metro.config.js`
 * in cambio di niente.
 *
 * Sulla versione: la 7.x è l'unica serie allineata a Expo SDK 57, e non è
 * quella che descrive la documentazione online (ferma alla 8.x). Due
 * differenze che costano un pomeriggio se non le si sa: qui la funzione si
 * chiama `showFeedbackWidget` e non `showFeedbackForm`, e lo shake-to-report
 * non esiste — il modulo si apre solo da `apriSegnalazione()`.
 */

import * as Sentry from '@sentry/react-native'
import * as SelettoreImmagini from 'expo-image-picker'
import { colori, linee } from '../tema/tokens'

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN

/** Se il DSN manca non c'è dove mandare le segnalazioni: il profilo nasconde
 * il pulsante invece di offrire un tap che fallisce in silenzio. */
export const segnalazioniAttive = Boolean(DSN)

/**
 * Un adattatore invece di un cast, perché non è solo un capriccio dei tipi.
 *
 * `expo-image-picker` dichiara `fileName: string | null` — su Android la
 * galleria a volte non restituisce un nome — mentre Sentry si aspetta
 * `string | undefined`. Il punto è cosa succede a valle: `_hasScreenshot()`
 * considera «presente» qualunque filename diverso da `undefined`, quindi un
 * `null` passato di peso diventa un allegato con il nome rotto invece di un
 * campo assente. Il nome glielo diamo noi.
 */
const selettoreImmagini = {
  launchImageLibraryAsync: async (opzioni?: { mediaTypes?: 'images'[]; base64?: boolean }) => {
    const risultato = await SelettoreImmagini.launchImageLibraryAsync(opzioni)
    return {
      assets: risultato.assets?.map((scelta) => ({
        uri: scelta.uri,
        base64: scelta.base64 ?? undefined,
        fileName: scelta.fileName ?? scelta.uri.split('/').pop() ?? 'segnalazione.jpg',
      })),
    }
  },
}

/**
 * Va chiamata una sola volta, prima che l'app renderizzi.
 *
 * Anche senza DSN l'SDK viene inizializzato (spento, con `enabled: false`):
 * `Sentry.wrap` in `_layout.tsx` avvolge comunque l'albero e si aspetta un
 * client, quindi `npm run mobile` senza variabili d'ambiente deve trovarlo.
 */
export function avviaSegnalazioni() {
  Sentry.init({
    dsn: DSN,
    enabled: segnalazioniAttive,

    // Nessuna telemetria automatica: non stiamo raccogliendo crash, stiamo
    // raccogliendo quello che una persona si prende la briga di scriverci.
    enableNativeCrashHandling: false,
    enableAutoSessionTracking: false,
    enableAutoPerformanceTracing: false,
    enableCaptureFailedRequests: false,
    // La rete di sicurezza per gli errori JavaScript, che arrivano da
    // integrazioni attive di default e non da un'opzione che si spegne.
    // `beforeSend` in @sentry/core tocca solo gli eventi di tipo errore
    // (client.js, `isErrorEvent`): le segnalazioni hanno `type: 'feedback'`
    // e passano di qui indenni. Per accendere i crash un giorno: togliere
    // questa riga e rimettere `enableNativeCrashHandling`.
    beforeSend: () => null,

    integrations: [
      Sentry.feedbackIntegration({
        // Un solo tester, che conosciamo: nome ed email sarebbero due campi
        // di attrito per un'informazione che abbiamo già.
        showName: false,
        showEmail: false,
        showBranding: false,

        // Due strade per la prova visiva, perché servono a momenti diversi:
        // «cattura» funziona quando il problema è sotto gli occhi adesso,
        // «allega» quando lo screenshot l'ha già preso col telefono e il
        // momento è passato.
        enableScreenshot: true,
        enableTakeScreenshot: true,
        imagePicker: selettoreImmagini,

        formTitle: 'Segnala un problema',
        messageLabel: 'Cosa è successo',
        messagePlaceholder:
          "Es: ho caricato la foto di una maglietta e l'app si è chiusa. Prima avevo aperto l'armadio e...",
        submitButtonLabel: 'Invia',
        cancelButtonLabel: 'Annulla',
        addScreenshotButtonLabel: 'Allega una foto',
        removeScreenshotButtonLabel: 'Togli la foto',
        captureScreenshotButtonLabel: 'Cattura lo schermo',
        isRequiredLabel: '(serve)',
        successMessageText: 'Ricevuto. Grazie.',
        errorTitle: 'Non è partita',
        formError: 'Scrivi due righe su cosa è successo.',
        captureScreenshotError: 'Non sono riuscito a catturare lo schermo.',
        genericError: 'Invio fallito. Controlla la connessione e riprova.',

        // L'app è dichiarata `userInterfaceStyle: light` in `app.json`: un
        // modulo che segue il tema di sistema apparirebbe scuro su un telefono
        // in dark mode, dentro un'app che scura non è mai.
        colorScheme: 'light',
        themeLight: {
          background: colori.scheda,
          foreground: colori.inchiostro,
          border: linee.chiara,
          accentBackground: colori.inchiostro,
          accentForeground: colori.crema,
        },
      }),
    ],
  })
}

/** Apre il modulo di segnalazione. Il nome cambia tra major di Sentry: tenerlo
 * dietro questa funzione vuol dire che al prossimo bump si tocca solo qui. */
export function apriSegnalazione() {
  Sentry.showFeedbackWidget()
}
