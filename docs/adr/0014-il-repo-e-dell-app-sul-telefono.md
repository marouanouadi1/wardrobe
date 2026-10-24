# 0014 — Il repo è dell'app sul telefono: un solo progetto npm, niente web

**Stato:** accettata · **Data:** 2026-10-24

## Contesto

La parte JavaScript del repo era nata come un monorepo di npm per più frontend:
i workspace `apps/*` e `packages/*`, cioè `apps/mobile`, `apps/web` (un
segnaposto vuoto, `Q-04`) e `packages/contracts`. In più `apps/mobile` portava
React Native Web: `npm run mobile:web` in sviluppo, e `build:web` come
controllo di build in CI.

Quella struttura ha prodotto `T-23`: due copie di React. La radice non
dichiarava `react`, decine di pacchetti finiti in `node_modules/` della radice
lo chiedono come peer con `*`, e npm, non avendo una risposta, installava
l'ultima pubblicata accanto al pin esatto di `apps/mobile`. Il rimedio di
allora è stato dichiarare `react` e `react-dom` **anche** nella radice.

`T-32` diceva che niente teneva in piedi quel rimedio: se un giorno la
dichiarazione in radice sparisse, le due copie tornerebbero senza un job rosso.
Con l'SDK 58 la voce pesava di più, perché `metro.config.js` non ha più
`disableHierarchicalLookup`, e una copia annidata finirebbe nel bundle.

Il 2026-10-24 l'utente ha deciso che una versione web non è in programma, e
che il repo è dell'app sul telefono.

## Decisione

**Un solo progetto npm, `apps/mobile`, con il suo `package.json` e il suo
`package-lock.json`.** Niente workspace. La radice tiene un `package.json` di
soli script (`npm run dev`, `api:*`, `supabase:*`, `mobile*`, `contracts:*`),
senza dipendenze e senza lock.

- **I contratti stanno in `apps/mobile/contracts/`**, legati all'app come
  `"@wardrobe/contracts": "file:./contracts"`: gli import non cambiano. Il
  generatore usa le dipendenze dell'app (`json-schema-to-typescript` è fra le
  sue `devDependencies`), e i tipi li controlla il `tsc` dell'app.
- **Niente web.** Sono usciti `apps/web`, `react-native-web`, `mobile:web`,
  `build:web`, i tre file `*.web.ts`, i rami `Platform.OS === 'web'` e la
  chiave `web` di `app.json`. In CI l'export web è diventato
  `expo export --platform android` (`npm run export:android`): il bundle della
  piattaforma vera, sempre senza Gradle né credenziali EAS.
- **`react-dom` resta dichiarato**, anche senza web: `expo-router` lo chiede
  come peer obbligatoria (attraverso `@radix-ui`). Provato togliendolo: npm
  installa l'ultima, la 19.3.1, che pretende `react ^19.3.1` contro il pin
  19.3.0 (`ERESOLVE overriding peer dependency`).
- **`apps/mobile` resta dov'è.** Portare l'app nella radice avrebbe cambiato
  centinaia di percorsi nella documentazione e nei workflow, per nessun
  guadagno sulla causa.

## Perché toglie la causa, e cosa resta

Con un progetto solo, `react` è dichiarato in un posto, e ogni peer `*` si
risolve su quella dichiarazione: non c'è più una radice che possa dimenticarlo.
È il caso di `docs/adr/0008`, in cui il rimedio toglie righe: escono le
dipendenze e i workspace della radice, `tsconfig.base.json`, il `tsconfig`
dei contratti, `apps/web`, i tre file web, e la regola «React dichiarato in due
punti, da alzare insieme».

Verificato su un'installazione pulita, senza `node_modules` nella radice:
- `npm ls react react-dom` trova una copia sola di entrambi, alla 19.3.0;
- il lock nuovo è quello di prima con le stesse versioni. Escono solo
  `react-native-web`, le 13 dipendenze che usava lui e i link dei workspace.

**Cosa resta, e non lo copre nessun job:** un pacchetto difettoso che
dichiarasse `react` come dipendenza normale, con un intervallo incompatibile,
verrebbe annidato da npm sotto di sé, e Metro lo metterebbe nel bundle. Era
vero anche prima, ed è il caso raro di un pacchetto scritto male, non una
conseguenza della struttura. Lo mostra `npm ls react react-dom` in
`apps/mobile`.

## Conseguenze

- Le dipendenze si installano in `apps/mobile` (`npm ci --prefix apps/mobile`).
  Un `node_modules` nella radice non serve più a niente, e se c'è nasconde gli
  errori: Node cerca i moduli risalendo le cartelle.
- La CI installa in `apps/mobile` (`cache-dependency-path` punta al suo lock).
  `mobile.yml` filtra solo `apps/mobile/**` e sé stesso, `api.yml` filtra
  `apps/mobile/contracts/**`. Lo script di bump scrive la versione nel lock
  dell'app, in cima e nella voce `packages[""]`.
- Si perde la prova delle schermate nel browser. Le schermate si provano sul
  telefono, e le convenzioni nei test di `apps/mobile/test/`. La pagina di
  revisione dei cursori dell'avatar resta nel browser: è uno strumento di
  `tools/avatar/`, non l'app.
- `T-32` si chiude, `T-66` (il trascinamento col mouse sul web) decade, `Q-04`
  ha la sua risposta.
- **Se un giorno serve un web** (una landing, un pannello interno), nasce come
  progetto a sé, con il suo `package.json`. Rimettere i workspace per
  condividere i contratti vuol dire riaprire `T-23`: va deciso rileggendolo.
