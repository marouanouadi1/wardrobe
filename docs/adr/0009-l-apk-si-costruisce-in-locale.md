# 0009 — L'APK si costruisce in locale, finché non si decide altrimenti

**Stato:** accettata, provvisoria · **Data:** 2026-09-24

## Contesto

`mobile.yml` rilascia l'app a ogni merge su `main` che tocca `apps/mobile/**`:
bump, commit, tag, poi `eas build` **sui server di Expo**, download dell'APK e
GitHub Release. La build in cloud sta nel piano gratuito di Expo, che ha un
**numero fisso di build Android al mese**.

Il 2026-09-23 la quota è finita. Da lì ogni rilascio si è fermato allo step
«Build Android preview» con *«This account has used its Android builds from
the Free plan this month»*: quattro di fila (`0.7.0`, `0.8.0`, `0.9.0`,
`0.9.1`), tutti col bump e il tag già pushati e **nessun APK**. L'ultima
Release scaricabile è rimasta la `0.6.6` del 2026-09-13, undici giorni e
tre feature indietro. La quota si rinnova il 1° del mese.

Il punto non è quel mese: con un rilascio per merge, un mese di lavoro
normale la finisce di nuovo. Il flusso non può dipendere da un contatore che
si esaurisce senza avvisare.

## Decisione

**L'APK da distribuire si costruisce sul computer locale**, con
`eas build --local`, e si pubblica a mano come GitHub Release. La procedura
sta in `docs/deploy.md`, sezione «Build locale dell'APK».

`--local` esegue la stessa build del cloud sulla macchina che la lancia:
stesso profilo `preview` di `eas.json` (quindi le stesse variabili, comprese
le sole ABI dei telefoni), **stesse credenziali di firma** scaricate da Expo,
stesso `versionCode` incrementato in remoto (`appVersionSource: "remote"`).
L'APK che ne esce si installa sopra quelli già distribuiti. **Non consuma
quota**: il limite riguarda i server di Expo, non la CLI.

Il resto della pipeline resta com'è. Un merge su `main` continua a fare
bump, commit e tag della versione dell'app — quella parte non dipende da
Expo, e tiene la versione legata ai commit (ADR 0005). La build locale parte
**da quel tag**, così l'APK porta esattamente il numero che la storia dice.

## Conseguenze

- Finché la quota è esaurita, il job `release` di `mobile.yml` **diventa rosso
  allo step «Build Android preview» a ogni merge**. È atteso, non è un guasto
  da correggere: bump e tag sono già su `main`, manca solo l'APK, e lo si
  costruisce in locale.
- Quando la quota c'è, la build in cloud riparte da sola e pubblica la
  Release. In quel caso la build locale non serve: prima di lanciarla si
  guarda se la Release di quel tag esiste già.
- I tag rimasti senza APK (`mobile-v0.7.0`, `0.8.0`, `0.9.0`) restano senza
  Release: conta l'ultima versione, non ricostruire la storia.
- La macchina locale diventa un pezzo della catena di rilascio: JDK 17,
  Android SDK, `eas-cli` loggato sull'account Expo del progetto, `gh`
  autenticato. Su un'altra macchina va preparata prima.

## Cosa resta da decidere

Questa decisione è **provvisoria** apposta. Il rimedio vero è che il rilascio
non resti bloccato quando la quota finisce, senza che qualcuno se ne accorga
e lo faccia a mano: per esempio che il job ripieghi da solo su una build sul
runner di GitHub (`eas build --local` o Gradle) quando EAS rifiuta per quota,
oppure un piano Expo a pagamento. È una scelta dell'utente, anche di costo, e
sta nella issue #26. Quando arriva, questo ADR passa a «superata».
