# DA FARE — il lavoro trovato e non ancora fatto

Le cose che emergono **mentre si lavora ad altro**: un difetto notato di
sfuggita, un rimedio che si vede ma non si può fare adesso, un debito che
conviene sapere prima di toccare quel codice.

Si scrive **subito, nella stessa PR in cui la si trova**. Una cosa notata e non
scritta è una cosa persa, e il costo di ritrovarla la seconda volta è più alto
di quello di scriverla la prima.

## Cosa va qui, e cosa no

Il criterio è operativo, non di gusto:

> **Se un agente che sta per toccare quel file deve saperlo → sta qui.**
> **Se sei tu a dover decidere quando farlo → è una issue su GitHub.**

Una voce **non sta mai in entrambi i posti**. Quando un debito di questo file
diventa lavoro pianificato, si apre la issue e la voce qui **rimanda** con una
riga (`→ #12`), non si copia: due copie divergono, e questo progetto ha già
pagato quel prezzo.

E rispetto agli altri file di stato:

| | |
|---|---|
| `docs/PROGRESS.md` | cosa **esiste** e come è stato verificato |
| **questo file** | lavoro **identificato e non fatto**, con il rimedio già visto |
| `docs/QUESTIONI.md` | serve una **decisione dell'utente** su codice già scritto |
| `docs/DOMANDE_APERTE.md` | serve una **decisione di prodotto** |

Se una voce qui non ha un rimedio ma una scelta da fare, è nel file sbagliato:
va in `QUESTIONI.md`.

## Tampone o rimedio

Ogni voce che nasce da un problema aggirato lo dice, perché è la differenza che
decide se il lavoro è finito o solo spostato (`docs/adr/0008`):

> Se togliessi la soluzione, il problema tornerebbe? Se sì, è un **tampone**.

Una voce che descrive un tampone in piedi porta **dov'è il tampone**, così chi
applica il rimedio sa anche cosa andrà **cancellato**: un rimedio che lascia in
piedi il tampone non è un rimedio, è una terza cosa da mantenere.

**Il rimedio toglie righe. Il tampone ne aggiunge.**

## Come si chiude una voce

Si sposta in `## Fatte` con la data e il commit che l'ha chiusa. Non si cancella:
una voce sparita non si distingue da una dimenticata.

---

## Da fare

Le voci qui sotto vengono dall'audit di `security` e dalla review di `reviewer`
sul commit `b5ba358`, eseguiti il 2026-09-11, e da una seconda review dello
stesso giorno sull'intero branch — quella che ha **eseguito** i gate invece di
leggerli, e da cui vengono `T-26`, `T-27` e `T-28`.

### T-16 — Gli strumenti di test sono in `dependencies`
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/package.json:22-23,38-39` · **Gravità:** bassa · **Chi:** `mobile`

`jest`, `jest-expo`, `@types/jest` e `@testing-library/react-native` stanno in
`dependencies`, mentre `devDependencies` è due righe sotto. Impatto pratico
contenuto (Expo bundla per grafo di import), ma è una classificazione sbagliata su
un file che la pipeline di release riscrive.

**Cosa serve:** spostarli. Attenzione a non far cambiare il lock in modo
inatteso: va fatto in una modifica sua.

*Riconfermata il 2026-09-11*: spostarli riscrive i flag `dev` nel lock, e il
lock è esattamente il punto dove questo repo si è già fatto male (`T-23`,
`T-03`). Resta una modifica a sé, anche se nasce nella stessa PR delle altre.

### T-17 — `docs.yml` esegue il codice della PR: vincolo da non violare
**Trovato il:** 2026-09-11 · **Dove:** `.github/workflows/docs.yml` · **Gravità:** informativa · **Chi:** nessuno adesso

Senza `paths:`, gli step di conteggio eseguono `pytest --collect-only` (che
importa `conftest.py` e ogni modulo di test della PR) e `npx jest` anche su PR che
non farebbero partire gli altri due workflow.

Il contenimento c'è ed è quello giusto: `on: pull_request` e **non**
`pull_request_target`, più `permissions: contents: read`. Su PR da fork non ci
sono né segreti né token scrivibile.

*Dal 2026-09-12* il checkout ha anche `persist-credentials: false` (chiusura di
`T-13`): il token di lettura non resta su disco mentre gira quel codice.

**Nessuna azione.** Va scritto in `.claude/rules/ci-release.md` come vincolo: se
un domani questo workflow dovesse servire un secret, `pull_request_target`
sarebbe la strada sbagliata.

### T-18 — Il percorso dati che gira in produzione non ha nessun test
**Dove:** `services/api/src/adapters/postgres.py`, `filesystem.py`, `handlers/local_server.py` · **Gravità:** alta · **Chi:** `test`

Tutti i test del backend girano su `ArchivioInMemoria` (97%). `postgres.py` (123
istruzioni), `local_server.py` (120), `filesystem.py` (57) e
`scontorno/fal_provider.py` (25) sono a **0%**. Il 74% totale è una media che lo
nasconde.

Non è un incidente: è la stessa separazione che il linter impone, e coprirli
richiede un container. Ma il punto è saperlo, non alzare la media con dei mock.

**Cosa serve:** una decisione su quale container far girare in CI, oppure
l'accettazione esplicita che quel codice si prova solo a mano. Numeri in
`docs/TEST_COVERAGE.md`.

### T-33 — `Attributo` dipinge un fondo opaco senza asserirlo
**Trovato il:** 2026-09-13 · **Dove:** `apps/mobile/src/ui/capi.tsx:280` · **Gravità:** bassa · **Chi:** `mobile`

Il ramo `incerto` dipinge un fondo opaco (`colori.coralloTenue`, prima della
chiusura di T-20 era `#FFF1EC`), ma la primitiva non emette nessun `<Fondo>`, e
`Etichetta`/`Forte` al suo interno leggono `useFondo()`. Su una schermata scura
sarebbero testo chiaro su un fondo chiarissimo.

**Latente, non vivo — verificato:** c'è un solo punto di chiamata
(`app/capo/[id].tsx:213`), dentro una `Schermata` che non passa `su`, quindi su
fondo chiaro. Nessuno dei due gate di `primitive.test.ts` lo vedrebbe comunque:
`Attributo` non dichiara né `style` né `sfondo`.

**In più**, il docblock di `fondo.tsx:1-22` cita `Attributo` come esempio di chi
«dipinge in trasparenza» e quindi inoltra — vero per il ramo non-incerto, falso
per questo: è una divergenza fra la fonte normativa e il codice, e per
`CLAUDE.md` in quel caso vince il codice.

**Cosa serve:** o `Attributo` asserisce `<Fondo su="chiaro">` sul ramo opaco, o
il docblock di `fondo.tsx` smette di citarlo come esempio di chi inoltra.

**Aggiornamento del 2026-09-22 (palette «Aura»):** la divergenza si è chiusa da
sé, dal verso giusto. Il ramo `incerto` non dipinge più un fondo **opaco**
(`colori.coralloTenue`, `#FFE3DA`) ma una **velatura** — `velature.pericolo`,
cioè `velo(colori.pericoloVelato, 0.1)`. Chi vela inoltra, quindi il docblock di
`fondo.tsx` che cita `Attributo` fra chi inoltra adesso **dice il vero**, e non
c'è più niente da scegliere fra le due strade di questa voce. Resta da
verificare l'unico punto di chiamata (`app/capo/[id].tsx:213`) su una schermata
scura — oggi non ne esiste una, quindi la voce si chiude solo quando una c'è.
**Non chiusa d'ufficio**: nessuno ha ancora guardato quel chip su fondo scuro.

### T-34 — Tre primitive accettano `sfondo` e sfuggono al gate che lo controlla
**Trovato il:** 2026-09-13 · **Dove:** `apps/mobile/src/ui/base.tsx:525` (`Badge`), `:722` (`Bolla`), `:763` (`BottoneTondo`) · **Gravità:** bassa · **Chi:** `mobile`

Le tre dichiarano `sfondo` e lo dipingono in opaco senza asserire nessun
`<Fondo>`, con `colore` **cablato** a `colori.inchiostro` come default:
`<Badge sfondo={colori.inchiostro}>` darebbe inchiostro su inchiostro, e nessun
gate se ne accorgerebbe. `derivaPrimitiveConSfondo` in `primitive.test.ts`
richiede *anche* `<Fondo su=>`, quindi oggi trova solo `Scheda` e `SchedaFoto`.

**Cosa serve:** una decisione sul criterio — vale lo stesso ragionamento di
T-24 qui sotto, e i due vanno probabilmente risolti insieme.

### T-21 — La sequenza di caricamento e analisi, duplicata in tre punti (**chiusa**)
**Chiusa il 2026-09-23.** La strada scelta è quella che questa stessa voce
indicava dopo aver pesato le due alternative: **funzioni in `src/dati/`**, non
un hook. `src/dati/foto.ts` espone `caricaUnaFoto(uri)` e
`analizzaFoto(uri, segnale?)`, e i tre punti di chiamata le usano:

| Dove | Prima | Ora |
|---|---|---|
| `carica.tsx`, foto singola | le quattro chiamate a mano | `analizzaFoto` |
| `carica.tsx`, coda | le stesse quattro, copiate | `analizzaFoto` |
| `archivio.tsx`, `impostaFotoAvatar` | le prime due a mano | `caricaUnaFoto` |

**Il vincolo è conservato e dichiarato, non nascosto:** il docblock di
`analizzaFoto` dice che il segnale copre **solo la seconda metà** —
`api.caricaFoto` passa da `expo-file-system`, non da `fetch`, e non accetta un
`AbortSignal`. Chi annulla mentre la foto sale vede la schermata cambiare, ma
l'upload prosegue finché non finisce da solo. Era la cosa che questa voce
chiedeva esplicitamente di non far sparire.

**`useAzione` è stato scartato con i tre motivi già scritti qui:** `mappaErrore`
non sa dire «non mostrare niente»; la coda ingoia di proposito ogni errore; un
booleano `caricamento` si accenderebbe e spegnerebbe N volte dentro il ciclo,
mentre il segnale vero dell'interfaccia è adesso lo stato di **ogni singola
foto**.

**Onestà sui conteggi:** l'estrazione toglie 8 righe da `carica.tsx` e 3 da
`archivio.tsx`, e ne aggiunge 51 in `foto.ts` — di cui 35 di docblock. Il file
`carica.tsx` nel frattempo è **cresciuto** da 378 a 420 righe, ma per un'altra
ragione: la schermata `upload` del deck, che dà a ogni foto la sua riga. Le due
cose sono nello stesso passaggio e vanno lette separate.

### T-22 — `chat.ts` re-implementa la coppia caricamento/errore
**Dove:** `apps/mobile/src/dati/chat.ts:46-47` · **Gravità:** bassa · **Chi:** `mobile`

`useChat` tiene `caricamento`/`inAttesa` per conto proprio invece di comporre
`useRisorsa`. È un'astrazione sorella dentro `dati/`: la duplicazione più
strutturale del frontend, perché non è in una schermata ma accanto all'astrazione
che dovrebbe usare.

**Verificato il 2026-09-13: non è streaming né polling** — `api.chat.invia` è
una singola POST. I blocchi veri per comporre `useRisorsa` sono concreti, non
un'impressione: (1) `useState(scelta.tipo !== 'nuova')` contro l'hardcoded
`useState(true)` di `useRisorsa` — il ramo `'nuova'` non deve fare nessuna
fetch, ma l'effetto di `useRisorsa` ne farebbe partire una comunque; (2) una
fetch riuscita scrive **tre** stati (`messaggi`, `conversazione`, un ref),
mentre `useRisorsa` espone solo `dati` in sola lettura — l'eco ottimistico di
`invia` e il suo rollback non ci vivrebbero sopra; (3) gli errori vanno al
coriandolo `avvisa`, non trattenuti per un `<StatoRisorsa>`; (4) la guardia
`attivo` non è ridondante, perché `useRisorsa.esegui` non cancella nessuna
richiesta in volo — una risposta stantia atterrerebbe comunque dopo un cambio
di `scelta`.

Per lo stesso motivo `useAzione` non copre pulito l'invio (`inAttesa`):
cattura l'errore e basta, ma qui serve anche il rollback dell'eco ottimistico
e restituire il testo a `bozza` — compensazione che resterebbe comunque scritta
a mano dentro l'azione passata.

**Il filo comune con T-21, che nessuna delle due voci diceva finché non è
stato verificato:** sia `carica.tsx` sia `chat.ts` instradano gli errori sul
**coriandolo** `avvisa`, mentre `useRisorsa`/`useAzione` li *trattengono* per
renderizzarli. `.claude/rules/react-native.md` elenca due meccanismi legittimi
e non nomina questa terza via — che quindi è essa stessa da decidere, non solo
da chiudere caso per caso.

**Cosa serve:** una chiusura scritta che elenchi **entrambi** i tentativi
(`useRisorsa` per il caricamento, `useAzione` per l'invio) col motivo
specifico per cui ciascuno non regge — non un «non si può» generico — oppure
la decisione, a monte, se il coriandolo è un terzo meccanismo legittimo da
scrivere nella regola.

### T-24 — Il criterio della derivazione è più stretto di quello vero
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/test/convenzioni/primitive.test.ts` · **Gravità:** bassa · **Chi:** `mobile`

Il gate deriva le primitive da «contiene `<Fondo su=…>` **e** destruttura
`style`». Il criterio definitivo sarebbe «dipinge un `backgroundColor` che non
eredita», che è più largo: `BottoneSecondario` ci rientra e infatti è tenuto come
eccezione a mano in `RIDIPINGIBILI_SENZA_FONDO`.

Allargare il criterio va fatto **potendo eseguire il gate prima**, per vedere
quanti falsi positivi porta.

**È un tampone** (`docs/adr/0008`): `RIDIPINGIBILI_SENZA_FONDO` esiste perché il
criterio derivato è più stretto del vero. Il rimedio — allargare il criterio —
**cancella quella costante**. Se la chiusura di questa voce la lascia in piedi, il
problema è stato spostato, non tolto.

**Provato in locale il 2026-09-13** (senza applicarlo — questa voce resta
aperta): il criterio va scritto come **unione**,
`(<Fondo su=> OR backgroundColor) AND style`, **non** come sostituzione del
primo con il secondo. `PiedeFoto` dipinge con `LinearGradient` (via `velo()`
dopo T-19) e non ha **nessun** `backgroundColor`: un criterio «solo bg»
la perderebbe, e il test cadrebbe sul suo stesso `arrayContaining` a riga 210.
Con l'unione l'insieme derivato passa da 6+1 (l'eccezione a mano) a **8**:
entrano `BottoneSecondario` e `Blocco` (`scheletri.tsx`), **e
`RIDIPINGIBILI_SENZA_FONDO` si cancella senza toccare nessuna asserzione** —
la chiusura pulita che questa voce esige. Simulato sui 37 file di `app/` +
`src/`: **zero falsi positivi** — nessuno dei 17 usi di `<Blocco>` passa
`style={{ backgroundColor }}`. **Attenzione:** il qualificatore «che non
eredita» è una trappola — filtrare i fondi trasparenti/velati ri-escluderebbe
proprio `BottoneSecondario` (`sfondo ?? 'transparent'`), cioè il componente
per cui questa voce esiste. Il criterio giusto è solo «la chiave c'è», senza
distinguere l'opacità.

**Cosa serve:** applicare l'unione sopra a `derivaPrimitiveRidipingibili` in
`primitive.test.ts`, verificare che i test restino tutti verdi, e togliere
`RIDIPINGIBILI_SENZA_FONDO`.

### T-25 — `dichiaraProp` guarda solo la destrutturazione del primo parametro
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/test/convenzioni/primitive.test.ts` · **Gravità:** bassa · **Chi:** `mobile`

Un componente che usasse `props.style` (o `props.sfondo`) senza destrutturare
sfuggirebbe a entrambe le derivazioni — la funzione si chiama `dichiaraProp` da
quando serve anche a `sfondo`. Nessuno lo fa oggi, e il pavimento a sei nomi è la difesa contro una
regressione silenziosa, ma il buco esiste.

**Riverificato il 2026-09-13: il buco è oggi vuoto.** In `src/ui` non esiste
nessun componente esportato come arrow function o function expression — sono
tutte `FunctionDeclaration`, quindi il vincolo «solo `isFunctionDeclaration`»
non perde niente da solo. Gli otto componenti con un rest param (`...props`)
destrutturano comunque `style` esplicitamente accanto al rest, quindi
`dichiaraProp` li vede. Le due sole funzioni con un primo parametro non
destrutturato in `src/ui` sono `useColore(props: Props)` e
`risolviTaglia(taglia: …)` in `testo.tsx`, entrambe non componenti.

**Cosa serve:** guardare anche gli accessi `props.style`, o accettarlo e dirlo
nel commento (oggi non è scritto) — la scelta non è urgente perché il buco non
nasconde oggi nessun punto di chiamata reale.

### T-26 — Il gate sulle primitive non risolve un identificatore né uno spread
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/test/convenzioni/primitive.test.ts` · **Gravità:** bassa · **Chi:** `mobile`

`contieneBackgroundColor` cerca la chiave `backgroundColor` **dentro
l'inizializzatore dell'attributo**. Quindi vede `style={{ backgroundColor: … }}`
e `style={[…]}`, ma non `style={unaVariabile}`, non `style={styles.card}` e non
`{...props}` — quest'ultimo perché `ts.isJsxAttribute` esclude di suo un
`JsxSpreadAttribute`.

Nessun punto di chiamata lo fa oggi (verificato), e il gate non è inutile per
questo: prende la forma con cui il difetto è davvero arrivato in PR #4. Ma il
buco è reale e la scorciatoia per aggirarlo è di una riga.

**Riverificata il 2026-09-13** la stessa cosa, cercando attivamente
`JsxSpreadAttribute` e `style={identificatore}`/`style={oggetto.proprietà}`
sulle otto primitive, in tutti i 37 file di `app/` + `src/`: **zero
occorrenze**. La scorciatoia esiste ma nessuno l'ha ancora presa.

**Cosa serve:** risolvere gli identificatori dichiarati nello stesso file
(`const styles = StyleSheet.create({…})` è il caso vero), e decidere sugli
spread — o si ispezionano, o si nega lo spread su una primitiva ridipingibile e
lo si dice.

### T-27 — `types` in `tsconfig.json` è globale al programma, non ai soli test
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/tsconfig.json:5-9` · **Gravità:** bassa · **Chi:** `mobile`

`"types": ["jest", "node", "expo"]` vale per **tutto** il programma, e
l'`include` prende `app/` e `src/`. Quindi `describe`, `expect` e `jest.fn()`
typecheckano dentro il codice di produzione: un `describe` lasciato lì per
sbaglio non lo prende nessuno. Verificato compilando una sonda in `src/`:
`tsc --noEmit` esce 0.

**Cosa serve:** un `test/tsconfig.json` che estende quello dell'app e aggiunge
solo lì i tipi di jest, `exclude: ["test"]` nella radice, e `typecheck` che
lancia entrambi. Non fatto adesso perché aggiunge un file e una riga di script
per chiudere una fuga che nessuno sta usando: è la forma che va discussa prima,
non applicata di rimbalzo.

### T-28 — La regola sulle percentuali di coverage è più larga del suo gate
**Trovato il:** 2026-09-11 · **Dove:** `docs/TEST_COVERAGE.md:5`, `.github/workflows/docs.yml` · **Gravità:** bassa · **Chi:** `ci-cd` + `doc-writer`

`TEST_COVERAGE.md` si dichiara «l'unico posto del repo in cui è lecito scrivere
un numero di test **o una percentuale di coverage**». Il gate di `docs.yml`
copre i conteggi (`\b[0-9]+ test\b`) e, da oggi, la sola forma testuale
`[0-9]+% di coverage`. Fuori restano `97%`, `74%`, `0%` scritti in altri modi —
e ce ne sono, **in questo file**, dentro `T-18`, dove i numeri *sono* il
contenuto del debito.

Quindi o la regola è più stretta di com'è scritta (le percentuali dentro una
voce di debito sono lecite perché spiegano perché la voce esiste), o i quattro
punti vanno riscritti. È una decisione, non un rimedio: per questo la voce dice
*cosa manca*, e la scelta sta a chi legge.

**Cosa serve:** decidere il confine, e poi renderlo un pattern solo — oggi la
regola è più larga della macchina che la fa rispettare, che è la cosa contro cui
`.claude/rules/ci-release.md` mette in guardia.

### T-30 — Niente in CI impedisce a `contents: write` di tornare alla radice
**Trovato il:** 2026-09-12 · **Dove:** `.github/workflows/*.yml` · **Gravità:** bassa · **Chi:** `ci-cd`

Chiudendo `T-13` il privilegio è stato tolto, ma **nessun job diventa rosso** se
qualcuno lo rimette alla radice, o toglie `persist-credentials: false` a un
checkout che non pusha. Oggi la regola vive in `.claude/rules/ci-release.md` e
nei commenti dentro i workflow — cioè è una regola scritta, ed è esattamente
ciò contro cui mette in guardia quel file: *una regola che la CI non fa fallire
non è una regola*.

Non è stato fatto insieme al rimedio, e la ragione è quella di `docs/adr/0008`:
l'asserzione debole («nessun `permissions:` di workflow dichiara
`contents: write`») è una manciata di righe, ma quella vera («solo i job che
pushano ce l'hanno») richiede di modellare **quali job pushano** — un custode
da mantenere. Il rimedio di T-13 toglieva righe; il gate ne aggiunge, e va
deciso sapendolo.

**Cosa serve:** decidere se la forma debole basta, e in tal caso metterla in
`docs.yml` — l'unico workflow senza `paths:`, quindi l'unico che vede anche una
PR che tocca solo l'altro. Oggi passerebbe verde, che è la condizione per
accendere un gate.

### T-31 — `jest-expo` chiede una versione di `@react-native/jest-preset` più nuova di quella installata
**Trovato il:** 2026-09-13 · **Dove:** `node_modules/@react-native/jest-preset` risolto a `0.86.2`, richiesto `^0.86.3` da `jest-expo@57.0.5` — i due pin da cambiare sono `jest-expo` e `react-native` in `apps/mobile/package.json` · **Gravità:** bassa · **Chi:** `mobile` · **Pre-esistente**

`npm ls` segna `@react-native/jest-preset@0.86.2 invalid: "^0.86.3" from
node_modules/jest-expo`: `jest-expo@57.0.5` dichiara
`peerDependencies["@react-native/jest-preset"]: "^0.86.3"`, ma
`react-native@0.86.2` — pin esatto in `apps/mobile/package.json` — porta la
`0.86.2`. Trovato lavorando su `T-23`, non causato da quella modifica:
**verificato confrontando il lock prima e dopo** (`git show 4473db3` vs
`HEAD`), `jest-expo` era già risolto a `57.0.5` e `@react-native/jest-preset`
già a `0.86.2` sul `main` originale, identico peer range compreso.

Non rompe niente oggi: **verificato** con `npm run mobile:test` su
un'installazione pulita, 21 verdi (conteggio in `docs/TEST_COVERAGE.md`) — npm
segnala l'incoerenza ma jest la tollera.

**Cosa serve:** allineare `react-native` alla versione che `jest-expo` si
aspetta (o viceversa, se è `jest-expo` a essere avanti rispetto al resto della
SDK), quando si aggiorna Expo SDK 57 — non prima, per non disallineare il pin
di RN dal resto dell'app senza motivo.

### T-32 — Niente impedisce che tornino due copie di React
**Trovato il:** 2026-09-13 · **Dove:** `package.json`, `apps/mobile/package.json` · **Gravità:** bassa · **Chi:** `ci-cd` + `mobile`

`T-23` ha tolto la causa (`react`/`react-dom` dichiarati anche in root), non
un gate che la tenga tolta. Se domani qualcuno rimuove quella dichiarazione da
`dependencies` di root — o aggiunge un pacchetto che richiede una versione di
`react` incompatibile con `19.2.3` — **nessun job diventa rosso**: le due copie
tornerebbero silenziosamente, e il prossimo sintomo sarebbe di nuovo un
dispatcher nullo scoperto a mano, non un gate che lo dice.

È lo stesso caso di `T-30`: l'asserzione debole («`node_modules/react` risolve
a una versione sola nel lock») è poche righe; quella robusta («ogni pacchetto
che dichiara `react` come peer è soddisfatto senza doppioni») richiede
modellare l'intero albero delle peer, che è quello che npm già fa da solo a
ogni `install`. Non deciso in questa PR: **il rimedio di T-23 toglieva righe,
un gate le aggiunge**, e va deciso sapendolo — non acceso di rimbalzo dentro
la stessa modifica che ha appena chiuso il tampone.

**Cosa serve:** decidere se basta un controllo in CI che conti le occorrenze di
`"version"` sotto le chiavi `node_modules/react` e
`apps/mobile/node_modules/react` nel lock (dovrebbe essercene una sola, e la
seconda non dovrebbe esistere), o se è sufficiente affidarsi a `npm ls react
react-dom` con `--all` che esce diverso da zero se ci sono `invalid`/duplicati
— e in tal caso in quale workflow (`mobile.yml` ha già `paths:` su
`apps/mobile/**`, ma la causa può tornare anche toccando solo la root).

### T-51 — Un corpo di richiesta non UTF-8 uccide il thread invece di dare 400
**Trovato il:** 2026-09-16 · **Dove:** `services/api/src/handlers/local_server.py:104` · **Gravità:** bassa · **Chi:** `api`

```python
corpo = self.rfile.read(lunghezza).decode("utf-8") if lunghezza else ""
```

La decodifica è fuori da qualunque guardia, e soprattutto **prima** che
`@endpoint` entri in gioco: un `UnicodeDecodeError` non diventa mai un errore
di dominio e non passa dall'unico punto che traduce in HTTP. Risale fino a
`socketserver`, che chiude la connessione e scrive un traceback nel log. Il
client non riceve nessuna risposta, nemmeno un 400.

Trovato leggendo i log di produzione mentre se ne cercava un altro: una sola
occorrenza in sette giorni, da uno scanner automatico (nelle righe vicine
`GET /.git/HEAD`, `GET /.svn/entries`), `byte 0x84 in position 99`. Nessun
utente vero l'ha incontrato — l'app manda solo JSON — ma il traceback nei log
somiglia a un guasto del backend e ruba attenzione quando si cerca un guasto
vero, che è esattamente com'è stato trovato.

**Cosa serve:** decodificare con una guardia e alzare `RichiestaNonValida`
(esiste già in `domain/errors.py`, 422) invece di lasciar passare
l'eccezione — oppure `errors="replace"`, lasciando che sia la validazione
Pydantic di `corpo()` a rifiutare. La prima è più onesta: il corpo *non* era
leggibile, non era JSON sbagliato. Un test in
`tests/handlers/` che manda un byte non UTF-8 chiude la voce.

### T-50 — `rsync` senza `--delete`: sul VPS restano migrazioni che il repo non ha più
**Trovato il:** 2026-09-16 · **Dove:** `.github/workflows/api.yml` (step «Rsync codice sul VPS»), `docs/deploy.md` · **Gravità:** media · **Chi:** `ci-cd`

Il comando di deploy — lo stesso in CI e nel runbook — copia senza cancellare:

```
rsync -avz --exclude node_modules --exclude .venv --exclude .git --exclude .env -e ssh ./ marouan@89.167.15.22:~/wardrobe/
```

Un file tolto dal repo **resta sul server per sempre**. Non è teorico:
`services/api/migrations/` sul VPS contiene ancora `0003_valutazioni.sql` e
`0004_valutazioni_immagini.sql`, rimossi dal repo insieme al playground. Il
`Dockerfile` fa `COPY migrations ./migrations`, quindi finiscono anche
nell'immagine, e `applica_migrazioni.py` — che esegue *tutti* i `.sql` della
cartella — li esegue davvero: si vedono nell'output del deploy del 2026-09-16.

Oggi è innocuo **per un accidente lessicografico**, non per costruzione: `0003`
e `0004` ricreano due tabelle che `0008_rimuovi_playground.sql`, arrivando
dopo, ridroppa. Bastava che il file morto ordinasse dopo il suo `drop`, o che
toccasse una tabella viva, perché ogni avvio riportasse indietro lo schema. E
vale per qualunque file, non solo per le migrazioni: un adapter cancellato
resta importabile sul server.

**Cosa serve:** decidere se aggiungere `--delete` — e con quali esclusioni.
Non è un'aggiunta banale e **per questo non è stata fatta qui**: sul server
vivono due `.env` scritti a mano che non esistono da nessun'altra parte
(`docs/deploy.md`), più il volume delle foto. `--delete` con un `--exclude`
sbagliato, o dimenticato, li cancella senza appello. La strada prudente è
`--delete` con `--exclude` espliciti e una prima esecuzione con `--dry-run`
letta a mano.

Nel frattempo i due file morti si possono togliere a mano dal VPS
(`rm ~/wardrobe/services/api/migrations/000{3,4}_*.sql` + rebuild), ma da soli
non chiudono la voce: la causa è il comando, non quei due file.

### T-49 — Due foto della giostra non hanno una fonte (tampone dichiarato)
**Trovato il:** 2026-09-23 · **Dove:** `apps/mobile/assets/intro/giacca-pelle.png`, `apps/mobile/assets/intro/borsa-nera.png` · **Gravità:** media · **Chi:** `mobile`

La giostra del passo 1 dell'intro ha otto tessere. Sei sono capi generati con
Gemini, e la loro riga in `assets/intro/FONTI.md` dice da dove vengono. **Queste
due no.** Le ha fornite l'utente senza fonte, e dai file sembrano foto da catalogo
di un negozio online; la giacca portava un marchio leggibile, che è stato
cancellato. L'utente, avvisato, ha deciso di montarle come eccezione: la decisione
è sua e sta scritta in `FONTI.md`, ma il diritto d'autore delle due foto resta di
chi le ha scattate, e finiscono in un APK distribuito.

È un tampone: la giostra ha giacca e borsa, ma il motivo per cui mancavano — non
c'era un'immagine di cui sapessimo la licenza — è ancora lì.

**Rimedio:** due immagini con una riga in `FONTI.md` (una tavola Gemini con una
giacca e una borsa, nello stesso stile a colori pieni degli altri sei capi, basta).
Si sostituiscono i due PNG, si cancella la sezione «Eccezione» di `FONTI.md`, e
questa voce passa fra le fatte.

### T-48 — Due JPG dell'intro vecchia sono rimasti nel repo senza lettori
**Trovato il:** 2026-09-23 · **Dove:** `apps/mobile/assets/intro-passo-1.jpg`, `apps/mobile/assets/intro-passo-2.jpg` · **Gravità:** bassa · **Chi:** `mobile`

Sono le «due foto a tutto schermo» dell'apertura di prima (il docblock di
`app/intro.tsx` la racconta). `grep -rn "intro-passo" apps/mobile` non trova
nessun `require`, e `app.json` non dichiara `assetBundlePatterns`: con Metro
finisce nel bundle solo ciò che un `require` raggiunge, quindi **nell'APK non
viaggiano**. Restano nel repo (88 KB e 237 KB), e chi le trova non sa se servono.

Trovata durante la riscrittura della giostra del passo 1, che non le tocca.

**Cosa serve:** cancellarle, dopo aver riverificato il `grep` — un file che nessuno
legge si toglie, non si documenta.

### T-47 — `POST /capi/analisi` non controlla di chi sia la `chiave_foto`

**Gravità alta.** Trovata da `security` il 2026-09-23, sull'audit
dell'esportazione. **Non nasce con l'esportazione**: nasce con
`handlers/analisi.py`. La catena, verificata riga per riga:

1. `avvia` (`handlers/analisi.py:44-49`) prende `chiave_foto` **dal corpo** e la
   infila nella pipeline. Nessun controllo di proprietà.
2. `analizza` (`:97`) la legge dall'archivio; `_percorso`
   (`adapters/filesystem.py:81-85`) confina dentro `CARTELLA_FOTO`, **non**
   dentro il sottoalbero di chi chiama.
3. `salva` (`:138-142`) la persiste come `capo.foto.chiave` **del chiamante**:
   A ottiene un capo nel proprio armadio che punta al file di B.
4. `GET /capi` di A firma quella chiave con `url_lettura` → sette giorni di
   lettura sulla foto di B, rinnovabili a ogni chiamata.
5. E con `T-46` — la stessa firma vale per `PUT` — A **sovrascrive** la foto di
   B. Con `FAL_KEY` configurata scrive anche `<chiave di B>-scontornata`
   dentro l'albero di B.

**Il prerequisito è conoscere una chiave**, e finché le chiavi stavano solo
nelle risposte di `GET /capi` e nei log era difficile. Da qui il legame con
l'esportazione: uno zip pensato per essere conservato e girato ad altri le
avrebbe messe in chiaro. **Non succede**: `senza_campi_interni` toglie
`chiave`, `chiave_scontornata` e `avatar_foto_chiave` dal `dati.json`, e un
test pretende che non ci siano. Ma il difetto resta, e resta alto.

**Il rimedio toglie**, e sono due righe di causa, non un filtro in più:
- `avvia` **non deve accettare** una chiave dal client: o la ricalcola da chi
  chiama, o rifiuta ciò che non comincia per il prefisso di quell'utente;
- la firma delle foto deve portare **il verbo** nel messaggio (`T-46`), così
  una capability di lettura smette di essere una di scrittura.

**Quando diventa urgente, e il segnale è preciso.** L'attaccante di questa
catena è **un account registrato**: senza, non c'è nessun passo 1. Al
2026-09-23 `EMAIL_AMMESSE` contiene le persone che lavorano al progetto, e
l'APK si distribuisce a mano da un link di GitHub — quindi la gravità resta
alta ma la probabilità è quella di farsi male da soli. **Il giorno che
`EMAIL_AMMESSE` smette di essere una lista di persone che si conoscono, questa
voce è bloccante**: non «al lancio», non «quando saremo tanti» — quella
variabile. È lo stesso interruttore di `T-46` e della scelta registrata in
`Q-12`.

**La catena di `CLAUDE.md`**: `security` ha trovato → tocca ad `api` correggere
→ `test` per la regressione. I test che servono, già scritti nell'audit: A
chiede l'analisi di una chiave di B → 4xx **e nessun capo creato** (si guarda il
repository, non solo lo status); una firma emessa da `url_lettura` **non** è
accettata da `_foto_put`.

### T-46 — Un URL firmato di lettura di una foto vale anche come **scrittura**

**Trovata** il 2026-09-23 costruendo l'esportazione, guardando se fosse sicuro
metterne uno dentro un file che l'utente può girare a chiunque. Non lo è.

`local_server._firma_valida(chiave, query)` è **la stessa funzione** per
`_foto_get` (riga 174) e `_foto_put` (riga 160): entrambe chiamano
`firma_foto.firma_valida` sullo stesso messaggio `f"{chiave}:{scade}"`. Non c'è
niente, nel firmato, che dica se quell'indirizzo era per leggere o per
scrivere.

**Conseguenza.** `url_lettura` firma a **sette giorni** (`adapters/filesystem.py`),
e quell'indirizzo sta dentro ogni `Capo` che l'app riceve. Chi lo intercetta —
o chi legge la cronologia del browser, o un log di proxy — può fare `PUT` su
quella chiave per una settimana, cioè **sostituire la foto di un capo**. Il
docblock di `url_lettura` afferma il contrario: *«Il rischio che questo apre è
indovinare una chiave firmata, non scriverla: la PUT anonima resta chiusa da
`scade_in_s` corto»*. Vale per l'URL di upload, che è corto; **non** per quello
di lettura, che è lungo e passa dalla stessa verifica.

**Rimedio**, ed è lo stesso schema già applicato una volta in questo repo il
giorno in cui la voce è stata scritta: una **separazione di contesto** nel
messaggio firmato — `firma_foto(chiave, scade, segreto, verbo)`, con `verbo` in
`{"GET", "PUT"}` dentro l'HMAC. Una firma di lettura smette di valere per la
PUT senza cambiare niente di come si costruiscono gli URL.
`domain/esportazione.py` lo fa già con `_CONTESTO`, e i suoi test mostrano cosa
prova una separazione che funziona.

**Precede questa voce**: non è nata con l'esportazione, è di quando le foto
hanno avuto una firma. L'esportazione **non la allarga** — `senza_url_firmati`
toglie gli indirizzi dal `dati.json`, e c'è un gate che pretende che in
quell'archivio non compaia mai `firma=`.

**Quando diventa urgente:** insieme a `T-47`, e per lo stesso motivo — chi
sfrutta questa firma deve prima ottenerla, e oggi gli URL delle foto circolano
solo fra gli account di `EMAIL_AMMESSE`, che sono le persone che lavorano al
progetto. **Il segnale è quella variabile**, non una data (`Q-12`).

**Va data a `security`** prima che a `api`: la catena di `CLAUDE.md` è
finding → `security` (trova) → `api` (corregge) → `test` (regressione).

### T-45 — L'esportazione è sincrona, e ha un tetto che nessuno dichiara

**Trovata** il 2026-09-23 costruendo «Scarica i tuoi dati».

`GET /esportazione` compone lo zip **dentro la richiesta**: legge ogni foto
dall'archivio, la comprime e la scrive. Su un armadio piccolo è istantaneo. Su
uno grande ci sono due tetti, e nessuno dei due parla:

1. **`write_timeout 150s`** nel `Caddyfile` — è lì per l'analisi di una foto, e
   vale per tutte le risposte dell'host. Oltre quello il download si tronca: il
   browser mostra uno zip corrotto, e l'utente non sa perché.
2. **La memoria.** `componi_esportazione` costruisce l'archivio in un
   `BytesIO`: tutte le foto di un utente stanno in RAM contemporaneamente, due
   volte (i byte letti e lo zip). Su un VPS piccolo è il vincolo che morde
   prima del tempo.

**Perché va bene adesso e non per sempre.** `ThreadingHTTPServer` dà a ogni
richiesta il suo thread, quindi un'esportazione lenta non blocca le altre —
verificato, è la classe che `local_server.main()` istanzia. E un armadio
realistico oggi è decine di foto, non migliaia.

**Il rimedio, quando servirà**, in ordine di costo: scrivere lo zip in streaming
sul socket invece che in un `BytesIO` (toglie il tetto di memoria, non quello
di tempo); poi, se serve ancora, renderla asincrona — ma quella strada
**rimette in piedi il problema che il disegno attuale evita**, cioè una copia
dei dati in giacenza da far scadere e da cancellare insieme all'armadio. Non
si prende senza rileggere `docs/PROGRESS.md` su questa fetta.

**Cosa non fare intanto:** alzare `write_timeout` nel `Caddyfile`. È un
tampone, e quel file porta modifiche non committate dell'utente.

### T-44 — `Taglia` conosce solo le lettere, e il sistema di taglie non le cambia

**Aperta il:** 2026-09-23, scrivendo `Misure`. **Decisione prima del lavoro:**
`D-09` in `docs/DOMANDE_APERTE.md` — questa voce è il come, non il se.

`Misure` chiede due cose che non si parlano: `sistema_taglie`
(donna/uomo/unisex) e `taglia` (XS…XL). Ma le lettere sono le stesse in tutti e
tre i sistemi, quindi oggi la prima domanda **non cambia la seconda**: l'app
chiede una cosa e poi non la usa. È il deck che semplifica — nelle sue schede i
cinque bottoni sono identici sotto tutti e tre i sistemi.

**Il rimedio ha due forme, e `D-09` sceglie quale.** O i valori ammessi
dipendono dal sistema — e allora `Taglia` non è più una enum piatta, ma una
mappa `SistemaTaglie → valori`, con la validazione che ci va dietro. O la
domanda sul sistema serve ad altro (come si parla dei capi, non come si
misurano) e allora va detto nell'occhiello invece che lasciato implicito.

**Perché la enum e non un `str` libero**, visto che la enum è quella che poi
costa: un `str` avrebbe fatto entrare «medium», «42» e «M» come tre valori
diversi della stessa taglia, e nessuno li avrebbe normalizzati mai più. E il
verso in cui si sbaglia conta: allargare una enum a `str` **lascia valide le
righe già scritte** in `profili.dati`, mentre stringere un `str` a enum le
invalida. Il costo di questa voce è un cambio di contratto — tre file generati
e un typecheck — non una migrazione.

### T-43 — `linee.chevron` **è** `testoSu.chiaro.debole`, scritto due volte

**Trovata** il 2026-09-23 mentre `RigaImpostazione` veniva sganciata dal fondo
fisso. Entrambi valgono `velo(colori.inchiostro, 0.45)` — non due numeri simili:
la stessa espressione, copiata.

È esattamente la classe che `test/convenzioni/colori.test.ts` esiste per
rifiutare (`T-19`/`T-20`), e il gate **non la vede**: legge `app/` e `src/` con
l'AST cercando letterali di colore, e `src/tema/tokens.ts` è l'unico file che
esenta — necessariamente, perché è lì che i colori si scrivono. Quindi il
duplicato vive nell'unico posto dove nessuno lo controlla.

**Rimedio** (toglie righe, non ne aggiunge): cancellare `linee.chevron` e
lasciare che i tre punti che lo usano — `src/ui/righe.tsx:68`,
`app/(tabs)/profilo.tsx:120`, e la sua stessa definizione — leggano
`testoSu[fondo].debole`. Fatto per `RigaImpostazione` in questa passata: gli
altri due restano, e finché restano il token resta.

**Perché non l'ho tolto subito.** `profilo.tsx:120` è dentro una riga che
disegna il chevron a mano invece di usare `RigaNavigabile`: toglierlo bene vuol
dire capire perché quella riga esiste, e non è il lavoro di adesso. Toglierlo
male vuol dire sostituire un token con un altro token e lasciare il chevron
disegnato a mano — cioè spostare il problema.

### T-42 — «La riprovo io appena il servizio torna» non esiste, e non va scritta finché non esiste
**Chiesto dall'utente il 2026-09-23**, a voce, mentre si decideva la schermata
d'errore della fase 3: *«se non va lo stesso a buon fine diciamo all'utente che
la foto la abbiamo e faremo noi un tentativo appena sarà di nuovo
disponibile»*.

**Cosa è stato fatto, perché è vero.** La schermata dice «La foto ce l'ho già:
riprovare non la ricarica», e il bottone «Riprova» chiama `analizzaCaricata`,
che riparte da `avviaAnalisi` sulla chiave esistente. La foto **è** sul server:
sale per URL firmato prima che il modello la guardi.

**Cosa non è stato fatto, e perché non è stato scritto lo stesso.** Il tentativo
*automatico* «appena il servizio torna» non ha niente dietro: non esiste una
tabella dei tentativi in sospeso, non esiste un processo che li ripesca, e la
chiave della foto vive solo nello stato di una schermata React — chiusa l'app,
è persa. Scriverlo in interfaccia sarebbe una promessa che nessuno mantiene,
e l'utente scoprirebbe domani che la foto non è mai diventata un capo.

**La frase è scelta: «ci penso io, anche se chiudi»** (utente, 2026-09-23).
Cioè il tentativo lo rifà il **server**, non l'app al prossimo avvio. Questo è
lavoro di fase 5, con la catena obbligata `domain/models.py` →
`npm run contracts:generate` → app, e **non si comincia senza un accordo**.

**Cosa serve, verificato nel codice il 2026-09-23:**

1. **La chiave della foto nell'esito.** `handlers/analisi.py:63,71` salva un
   `EsitoAnalisi` fallito con `esecuzione_id`, `stato` ed `errore` — e basta:
   `richiesta.chiave_foto` esiste nello scope ma viene scartata. Senza,
   riprovare è impossibile: non si sa quale foto guardare.

2. **Sapere di chi è.** `analisi_esiti` è `(esecuzione_id, dati jsonb,
   creato_il)`, e il commento di `0005_analisi_esiti.sql` dichiara la scelta:
   *«Riga per esecuzione, non per utente: l'`esecuzione_id` è già univoco e non
   c'è bisogno di sapere di chi è per rispondere al polling»*. Quel «non c'è
   bisogno» **smette di essere vero** appena si vogliono elencare i falliti di
   qualcuno.
   `utente_id` **non va dentro `dati`**: sarebbe un filtro su jsonb senza
   indice, contro la regola dello schema ibrido (colonne vere solo per ciò su
   cui si filtra o si ordina). Serve una **migrazione** — `0010_`, la prossima
   libera — con `utente_id text` e `stato text` come colonne vere più il loro
   indice, nullable e idempotente come impone `.claude/rules/migrazioni.md`.
   E `utente_id` **non va nel modello `EsitoAnalisi`**: quel modello sta in
   `RISPOSTE`, quindi finirebbe in TypeScript e nella risposta al client. Va
   passato a parte: `salva_esito_analisi(utente_id, esito)`.

3. **Una rotta che li elenchi** — `GET /capi/analisi/fallite` — più la sua riga
   in `ROTTE` (`handlers/local_server.py`), o l'endpoint esiste e non risponde.

4. **Chi riprova.** Un processo periodico lato server. **È il pezzo che non
   esiste per niente**: oggi il backend non ha nessuno scheduler, nessun worker,
   nessun cron. `docker-compose.yml` ha un servizio solo. Questa è la parte più
   grossa delle quattro, ed è quella che la stima non deve sottovalutare.

**Fino ad allora la schermata non promette niente che non faccia:** dice che la
foto è già sul server — vero — e offre «Riprova» subito.

### T-41 — `in_lavaggio` non era impostabile da nessuna parte (trovata **e chiusa**)
`StatoCapo` ha tre valori — `pulito`, `da_lavare`, `in_lavaggio` — e tutti e tre
erano già veri ovunque: nell'enum del backend, in `ETICHETTE.stato` con la resa
italiana «In lavatrice», e nel filtro dell'armadio, che mostra fra i «da lavare»
tutto ciò che non è pulito.

**Ma nessun punto dell'app impostava `in_lavaggio`.** `app/capo/[id].tsx` era
l'unica schermata che chiama `cambiaStato` su un capo — verificato con un grep
su `app/` e `src/` — e lo faceva con un interruttore solo:

```
onPress={() => cambiaStato(capo.id, capo.stato === 'pulito' ? 'da_lavare' : 'pulito')}
```

Due valori raggiungibili su tre. L'etichetta diceva «In lavatrice» quando il
capo *non* era pulito, quindi il terzo stato si poteva **leggere** ma non
**scrivere**: un valore di dominio che esiste dappertutto tranne che nel punto
in cui lo si sceglierebbe.

**Chiusa il 2026-09-23**: i tre stati sono tre pillole, e l'elenco viene da
`VALORI_STATO_CAPO` (`@wardrobe/contracts`), non ridigitato — così un valore
nuovo nell'enum del backend compare da sé invece di restare irraggiungibile
un'altra volta.

**Nessun gate lo impedisce**, e va detto: «ogni valore di un'enum è
raggiungibile dall'interfaccia» non è un invariante che si sappia verificare
staticamente. Quello che c'è adesso è l'elenco preso dalla fonte, che è la metà
del problema — la metà che conta.

### T-40 — La barra delle schede fuori dal navigatore (**fatta**)
**Chiusa il 2026-09-23.** `BarraSchede` sta in `src/ui/guscio.tsx` ed è montata
una volta in `app/_layout.tsx`, sopra lo `Stack`; `(tabs)/_layout.tsx` passa
`tabBar={() => null}` — non l'assenza della prop, o il navigatore disegnerebbe
la sua barra di sistema sotto la nostra.

`schedaDi(percorso)` decide **due** cose: quale scheda si accende, e se
`Schermata` riserva lo spazio in fondo. La prop `tab` è stata **tolta** da tutti
e cinque i suoi chiamanti: era un promemoria che ogni schermata doveva
ricordarsi, e da oggi non basterebbe più comunque — anche una rotta spinta sopra
le schede ha la barra sotto.

Il «+» porta a «Carica» **da ovunque**, anche da una schermata che non è una
scheda: scelta dell'utente del 2026-09-23.

Il gate è `test/convenzioni/navigazione.test.ts`, **visto rosso per davvero**
capovolgendo la mappa in «tutto tranne»: cinque casi rossi, fra cui `/accedi`,
`/registrati` e il banco 3D.

### T-39 — `MotiviProposta` non ha più lettori
Era usata **solo** dalla lista di proposte di `app/suggeritore.tsx`, rimossa il
2026-09-22 (`Q-10`). Oggi la primitiva esiste e nessuno la monta: `oggi.tsx`
mostra il primo «perché» come testo semplice, non l'elenco.

**Aggiornata il 2026-09-23: il lettore non è arrivato.** La disposizione
`dettaglio` del deck non ha un elenco di motivi — ha «STA BENE CON», che è una
striscia di miniature, e nell'app resta «Altri capi del tuo armadio».

Il lettore vero è **`app/(tabs)/oggi.tsx`**: il deck ci disegna «IL CONSIGLIO»
con i motivi a pallino, che è esattamente questa forma. Oggi quella schermata
mostra **solo il primo** `perche` come testo semplice.

Quindi la scadenza si sposta, e resta una scadenza vera: **se la fetta che porta
«Oggi» sulla disposizione del deck non monta `MotiviProposta`, la primitiva si
toglie.** Una forma senza consumatori è codice morto che il prossimo agente
legge come se fosse in uso.

### T-38 — Il rename a «Aura» degli identificatori (deciso, non ancora fatto)
**Deciso dall'utente il 2026-09-22** (`Q-06` in `docs/QUESTIONI.md`): il rename
arriva anche a pacchetti, cartelle e tabelle. I **testi visibili** e
`app.json → name` sono già cambiati; tutto il resto no, ed è lavoro a sé.

Cosa resta, in ordine di rischio crescente:

| Cosa | Nota |
|---|---|
| gli scope npm `@wardrobe/contracts`, `@wardrobe/mobile` | tocca ogni `import` e il lockfile; niente si vede da fuori |
| le cartelle e il nome del repo | tocca i remote, i filtri `paths:` dei due workflow e i percorsi in `docs/deploy.md` |
| i nomi dei container e dei volumi | ricreare un volume **perde i dati**: va fatto con una procedura, non con un `sed` |
| le tabelle SQL | una migrazione di rename dev'essere idempotente come tutte le altre (`.claude/rules/migrazioni.md`) |
| `app.json` → `slug`, `scheme` | lo `slug` tocca il progetto EAS; lo `scheme` rompe i deep link già in giro |
| `bundleIdentifier` iOS e `android.package` (`com.wardrobe.armadio`) | **non è un rename**: è l'identità dell'app per lo store. Cambiarlo pubblica un'app nuova e chi ha la vecchia non riceve più aggiornamenti. Probabilmente **non va toccato**, e la decisione è dell'utente |

**Non farlo dentro il redesign**: va in una PR sua, e l'ultima riga va
contrattata prima, non dopo. Va aperta una issue — `gh` non era raggiungibile
nella sessione in cui questa voce è stata scritta (il server MCP di GitHub
rispondeva 400), quindi la voce resta qui finché la issue non esiste.

### T-37 — Il calendario mostrava sei giorni per riga (trovata **e chiusa**)
**Trovata il:** 2026-09-22 · **Dove:** `apps/mobile/src/tema/tokens.ts`, `griglie.mese` · **Gravità:** media · **Chi:** `mobile` · **Pre-esistente**

`griglie.mese` chiedeva `7 × 13.1% + 6 × 6px` di distanza. La larghezza utile di
`Schermata` è lo schermo meno due `spazi.xl`, quindi la riga entrava solo con
434px utili — **uno schermo da 478pt, che non esiste**. In React Native
`flexShrink` vale **0** di default (al contrario del web): la settima cella non
si stringeva per entrare, andava a capo. Risultato su ogni telefono: sei giorni
per riga, con le lettere `L M M G V S D` disallineate rispetto ai numeri sotto.

Nessuno strumento lo vedeva: non è un errore, non è un avviso, non è un tipo
sbagliato. Trovata mentre si scriveva il conto per la griglia dell'armadio a tre
colonne, dove lo stesso errore stava per essere introdotto da capo (`31.4%`
lasciava **0.0px** a 320pt).

**Chiusa nella stessa modifica** perché la regola di `.claude/rules/ci-release.md`
è che un gate non si accende rosso: `griglie.mese.colonna` passa a `12.2%` e
`griglie.armadio.colonna` a `30.8%`, poi si accende
`test/convenzioni/griglie.test.ts`. **Il gate è stato visto fallire davvero**:
rimesso `13.1%`, i sette casi del mese diventano rossi su tutte le larghezze
provate; ripristinato, verdi.

**Cosa resta:** il calendario ora disegna sette colonne un filo più strette, e
**nessuno l'ha ancora guardato su un telefono** — il conto dice che entra, non
come si vede.

### T-35 — Due istanze di `three` da una sola copia installata (tampone in piedi)
**Trovato il:** 2026-09-15 · **Dove il tampone:** `apps/mobile/metro.config.js` (il `resolver.resolveRequest`) · **Gravità:** media · **Chi:** `mobile`

Sintomo: «`THREE.WARNING: Multiple instances of Three.js being imported`»
all'avvio del banco `app/dev/prova-3d.tsx`.

**Non è il caso di `T-23`**: la copia installata è **una sola**. `find` ne trova
una (`node_modules/three`) e `npm ls three --all` la dà `deduped`. A duplicarsi è
la *risoluzione*, non l'installazione.

Prima cosa fatta, e da non rifare al contrario: `three` era stato dichiarato
**anche in `dependencies` di root**, per analogia con il rimedio di `T-23`. Lì
serviva perché decine di pacchetti hoisted chiedono `react` come peer con `*` e
npm, senza una risposta in root, installava l'ultima. Qui il peer è **uno solo**
— `@react-three/fiber`, con `>=0.156`, soddisfatto dal pin esatto di
`apps/mobile` — quindi quella riga non impediva niente: tolta, `npm install`
lascia sempre una copia sola, hoistata in `node_modules/three`. Non va
reintrodotta pensando di curare questo warning: non lo tocca.

La catena vera è un'altra:

1. `three` pubblica due build della stessa libreria e le distingue con le sole
   condizioni `import`/`require` del campo `exports` — **nessuna `default`,
   nessuna `react-native`**;
2. Metro asserisce quella condizione **per modulo importatore**, non una volta
   per pacchetto: `context.isESMImport === true ? 'import' : 'require'`, in
   `metro-resolver/src/utils/matchSubpathFromExportsLike.js`;
3. Expo lascia `unstable_conditionNames` a `[]` (verificato stampando la config
   risolta), quindi niente sovrascrive quella scelta;
4. `@react-three/fiber` non ha un campo `exports`, e per android/ios
   `resolverMainFields` vale `['react-native','browser','main']` — senza
   `module`. Il suo entry `/native` è quindi il **CJS**, e chiede `require`.

Risultato: fiber prende `build/three.cjs`; l'app e i file dentro
`three/examples/jsm/` (ESM, perché `three` è `"type": "module"`) prendono
`build/three.module.js` + `build/three.core.js`. Due istanze in un bundle.

**Solo sul nativo.** Sul web i main field arrivano all'entry ESM di fiber
(`react-three-fiber-native.esm.js`), tutto converge già su `three.module.js` e
l'istanza era una sola anche prima — verificato confrontando le source map dei
due bundle web. Il punto 4 è quindi l'anello che rompe, e vale per l'APK: la
piattaforma su cui il banco gira davvero.

Il danno non è il warning: è che le mesh che `GLTFLoader` costruisce vengono da
una `three` e il renderer che le monta sotto `<primitive>` dalla **`instanceof`
di un'altra**. Più ~2 MB di sorgente duplicato (528 KB di bytecode Hermes sul
bundle Android — misurato **con `--no-minify`**, come il comando di ricontrollo
qui sotto; l'APK passa da EAS che minifica, quindi il risparmio reale è un
altro numero. La minificazione non cambia la risoluzione: a discriminare è
l'elenco dei moduli, non i byte).

**Il tampone**: un `resolveRequest` che, per il solo `moduleName === 'three'`,
forza `isESMImport: false` — così ogni richiesta finisce sul ramo `require`.
Narrow di proposito: `unstable_conditionNames = ['require']` o l'aggiunta di
`'module'` a `resolverMainFields` avrebbero riscritto la risoluzione di **ogni**
pacchetto del grafo per un problema che ne riguarda uno.

Non è ristretto al nativo pur essendo un difetto del nativo: «`three` è sempre la
build CJS» si spiega in una riga, «`three` è CJS sul telefono ed ESM sul web» no
— e su web il pin è comunque innocuo (una istanza prima, una dopo) e toglie
83 KB dal bundle. Se un domani quel verso desse problemi sul web, la
restrizione è `platform !== 'web'`, non un secondo tampone.

**Perché è un tampone e non un rimedio:** togliendolo, il problema torna. La
causa è a monte e da qui non si raggiunge.

**Cosa serve (e cosa cancellare quando arriva):** basta **una** delle tre, e in
tutti i casi le righe del `resolveRequest` in `metro.config.js` vanno **tolte**,
non lasciate accanto al rimedio:

- `three` aggiunge una chiave `default` (o `react-native`) al suo `exports`, che
  farebbe convergere i due rami — è l'anomalia vera, un `exports` con solo
  `import`/`require` non è risolvibile da un bundler che non asserisce da sé;
- `@react-three/fiber` pubblica un campo `exports`, o Expo aggiunge `module` a
  `resolverMainFields`, così l'entry `/native` smette di essere CJS;
- Expo popola `unstable_conditionNames` per le piattaforme native.

**Da ricontrollare a ogni bump di `three` o di `@react-three/fiber`**, con il
comando che ha prodotto la misura qui sopra:

```bash
npx expo export --platform android --output-dir /tmp/x --no-minify --source-maps
jq -r '.sources[] | select(startswith("/node_modules/three"))' /tmp/x/_expo/static/js/android/*.map
```

Deve comparire `build/three.cjs` e **non** `build/three.module.js`.

### T-36 — Il banco `app/dev/prova-3d.tsx` è una rotta, e viaggia nell'APK rilasciato
**Trovato il:** 2026-09-15 · **Dove:** `apps/mobile/app/dev/prova-3d.tsx` · **Gravità:** bassa · **Chi:** `mobile`

`main` è `expo-router/entry`: ogni file sotto `app/` è una **rotta**, anche senza
un link che ci porti. `app/dev/prova-3d.tsx` compare infatti nella source map del
bundle Android — quello che `mobile.yml` impacchetta nell'APK della Release — e
si tira dietro `three` e `@react-three/fiber` (~2 MB di sorgente anche dopo
`T-35`). Lo stesso vale per il `build:web` di CI, che però è solo un check: non
c'è un sito pubblicato.

Non è una violazione: `.claude/rules/react-native.md` vieta i **test** sotto
`app/`, non una schermata di sviluppo, e il docblock del file dichiara già che è
temporanea. È un costo che conviene sapere, non un difetto.

**Cosa serve:** decidere se il banco va tolto a Cancello 1 chiuso (è la via
naturale: il file nasce dichiarato temporaneo), oppure — se serve tenerlo — se
vale la pena escluderlo dai build di rilascio. Non c'è una scelta ovvia finché
il Cancello 1 non ha risposto, quindi la voce sta qui e non in una issue.

---

## Fatte

Chiuse il **2026-09-11**, commit `f08e2a7`, dall'agente `mobile` — verifiche
eseguite a parte perché la sua sessione non aveva i permessi per `npm`.

### T-01 — Il gate sulle primitive è cieco dopo la prima freccia
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/test/convenzioni/primitive.test.ts:58` · **Gravità:** alta · **Chi:** `mobile`

`new RegExp('<${primitiva}\\b[^>]*?>')` — `[^>]` non attraversa un `>`, e in una
chiamata su più righe il primo `>` è quasi sempre quello di `onPress={() => …}`.
Tutto ciò che segue è fuori da quello che il test ispeziona.

Il guaio serio: il gate era stato «provato» reintroducendo la violazione di
`avviso.tsx`, che aveva `style` **prima** di `onPress` — l'unico ordine di props
che il regex sopravvive. La verifica del gate e il suo punto cieco sono lo stesso
fatto.

**Cosa serve:** catturare fino alla chiusura vera del tag contando le graffe,
oppure smettere di leggere i sorgenti come testo e usare l'AST — `typescript` è
già una dipendenza del workspace.

### T-02 — `PRIMITIVE` è un elenco scritto a mano, e sbagliato in entrambi i versi
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/test/convenzioni/primitive.test.ts:20-31` · **Gravità:** alta · **Chi:** `mobile`

Mancano **`Campo`** (`base.tsx:84,91,102,109`) e **`BarraChiedi`**
(`base.tsx:145,148,159,162`): dipingono un fondo, asseriscono `<Fondo su=…>` e
**fondono lo `style` del chiamante dopo il proprio fondo**. Sono esattamente la
forma di PR #4, e nessuno li guarda.

All'opposto, sette dei dieci nomi elencati non dichiarano nessuna prop `style`:
su quelli `tsc` rifiuta già la chiamata e la riga è inerte. Copertura reale: **3
componenti sui 5 ridipingibili**.

Aggravante: `test.each(PRIMITIVE)` fa sì che aggiungere un nome cambi
`numTotalTests` e renda rosso `docs.yml` finché non si aggiorna
`TEST_COVERAGE.md` — un attrito che scoraggia proprio la manutenzione
dell'elenco.

**Cosa serve:** derivare l'elenco invece di scriverlo: i componenti da
controllare sono quelli che contengono `<Fondo su=` e dichiarano una prop `style`.

### T-03 — Due `overrides` deliberati sono stati cancellati, non estesi
**Trovato il:** 2026-09-11 · **Dove:** `package.json:36-39` · **Gravità:** alta · **Chi:** `mobile`

`b5ba358` ha **sostituito** il blocco `overrides` invece di aggiungersi:
spariti `typescript: ~6.0.3` e `react-native-worklets: 0.10.1`. Il secondo era
deliberato e documentato in `5766462`: *«si muovono insieme, come impone la nota
su libworklets.so legata alla SDK»*, con l'avvertenza che quella classe di guasto
(SIGSEGV pre-render) è invisibile ai controlli statici.

Oggi non rompe niente — il lock risolve ancora 0.10.1 perché
`apps/mobile/package.json` lo dichiara come dipendenza diretta esatta. **È
sparita la garanzia**, non il valore: al prossimo `npm install` che ricalcola
l'albero, un transitivo può portarsi una seconda copia.

In più `"react": "19.2.3"` è **inerte**: la root risolve ancora 19.2.8. Dei due
override aggiunti, uno solo fa qualcosa.

**Cosa serve:** ripristinare i due pin accanto ai nuovi. Se la nota su
`libworklets.so` è superata, va detto per iscritto — non tolto in silenzio.

**Aggiornamento del 2026-09-13 (commit `501d6e8`, chiusura di `T-23`):** «react
inerte» non è più vero. `react` è uscito dagli `overrides` ed è entrato in
`dependencies` di root — la dichiarazione diretta lo rende effettivo, la root
risolve 19.2.3. `react-test-renderer` è uscito da `overrides` insieme a lui:
il ricalcolo del lock non ne ha avuto bisogno. I due pin rimasti in questa
voce — `typescript` e `react-native-worklets` — non sono toccati.

### T-04 — `BottonePrimario`: la scala che calcola `su` non è quella che calcola `sfondo`
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/src/ui/base.tsx:374-387` vs `:409` · **Gravità:** media · **Chi:** `mobile`

Nella prima ternaria `disabilitato` e `ambra` vincono su `pericolo`; nella
seconda `pericolo` vince su tutto. Quindi `pericolo + disabilitato` dipinge un
fondo **chiaro** e dichiara `su="scuro"` a chi sta dentro.

Latente: nessun punto di chiamata combina le varianti, e il testo del bottone ha
comunque un `colore` esplicito. Ma il commento a `base.tsx:405-408` dice che il
`<Fondo>` esiste proprio «per chi in futuro infila un `Corpo` qui dentro senza
pensarci» — e per quella persona l'asserzione è sbagliata.

**Cosa serve:** ricavare `su` dalla **stessa** ternaria che produce `sfondo`. Una
riga. E un caso in `leggibilita.test.tsx` che provi una combinazione, non una
variante sola.

---

Chiusa il **2026-09-11**, nella stessa PR che l'ha trovata.

### T-05 — I file di stato raccontano il gate più forte di quello che è
**Trovato il:** 2026-09-11 · **Dove:** `docs/PROGRESS.md:128-134`, `docs/TEST_COVERAGE.md:104-108` · **Gravità:** media · **Chi:** `doc-writer`

Due affermazioni verificabili e oggi false:

- «tamponata da un `moduleNameMapper` più **due `overrides`**»: uno è inerte
  (vedi T-03). `TEST_COVERAGE.md` lo dice correttamente, `PROGRESS.md` no;
- «un test impedisce che torni, su **tutte e dieci** le primitive»: sono tre
  (vedi T-01, T-02).

Una riga di `PROGRESS.md` che dichiara una copertura che il codice non ha vale
**meno di nessuna riga**, perché la sessione dopo non riaprirà il file per
controllare.

**Cosa serve:** riscrivere le due affermazioni su quello che i gate fanno
davvero, e rifarlo quando T-01 e T-02 sono chiuse.

**Chiusa il 2026-09-11.** Le due affermazioni citate non esistono più nei file di stato (verificato con `grep`: «due `overrides`» e «tutte e dieci» compaiono solo qui dentro, dentro la voce che le cita). T-01 e T-02, da cui questa voce dipendeva, sono chiuse. `PROGRESS.md` e `TEST_COVERAGE.md` sono stati riallineati a quello che i gate fanno adesso — incluso il quarto test su `sfondo`.

---

Chiusa il **2026-09-12**, commit `1c45085`.

### T-14 — L'URL che arriva da EAS è interpolato dentro `run:`
**Trovato il:** 2026-09-11 · **Dove:** `.github/workflows/mobile.yml:155` · **Gravità:** media · **Chi:** `ci-cd` · **Pre-esistente**

`curl -L -o wardrobe.apk "${{ steps.eas.outputs.apk_url }}"`, dove il valore nasce
da `jq -r` sul JSON che risponde EAS. `${{ }}` in un `run:` è sostituzione
testuale *prima* che la shell parta: un `buildUrl` con `"; curl … | sh; #`
diventa comando. Il job ha `contents: write` e `GH_TOKEN`.

È la violazione letterale della regola che il repo applica già al titolo delle
PR, scritta in `.claude/rules/ci-release.md`.

Verificato **non** sfruttabile, e quindi da non toccare:
`${{ steps.bump.outputs.version }}` — `bump-versione.mjs:164-183` valida
`^\d+\.\d+\.\d+$`.

**Cosa serve:** passare l'URL via `env:` e usarlo come `"$APK_URL"`; e verificare
che l'host sia quello atteso prima di seguirlo.

**Chiusa il 2026-09-12.** L'URL passa da `env:` e si usa come `"$APK_URL"`:
resta un dato invece di finire nel testo dello script. Prima di seguirlo si
controllano schema e dominio — non la forma del percorso, che oggi è
`https://expo.dev/artifacts/eas/<hash>.apk` (letto nei log della run
`34641460562`) ma che un cambio di EAS renderebbe rosso un rilascio che non si
può provare prima del merge.

**Verificato eseguendo lo script vero dello step**, estratto dal YAML con un
parser e lanciato con `curl` sostituito da uno stub: l'URL vero e un
sottodominio di `expo.dev` passano e arrivano a `curl` come **un solo**
argomento; `https://evil.example/x"; touch …; #`, `https://expo.dev.evil.example/…`
e un `http://` in chiaro escono 1 senza scaricare. **E verificato al contrario**,
che è la parte che conta: la riga com'era prima, con lo stesso valore sostituito
nel testo, esegue davvero il comando iniettato — la sentinella viene creata.

Nello stesso step `curl` ha preso anche `--fail`, che non era nel testo di
questa voce: senza, un 404 scriveva il corpo dell'errore dentro `wardrobe.apk` e
la Release pubblicava una pagina HTML col nome di un APK.

**Quello che resta non verificato, e non lo poteva essere:** lo step vive nel
job `release`, che gira solo su `main` (`if: github.ref == 'refs/heads/main'`).
Il primo rilascio dopo il merge è la sua prima esecuzione vera.

Chiusa il **2026-09-12**, commit `efa4490`.

### T-13 — `contents: write` dichiarato a livello di workflow invece che di job
**Trovato il:** 2026-09-11 · **Dove:** `.github/workflows/api.yml:25-26`, `mobile.yml:25-26` · **Gravità:** media-alta · **Chi:** `ci-cd` · **Pre-esistente**

Serviva al job `deploy`/`release`, ma i job `quality`, `contracts` e `checks` lo
ereditavano — e sono quelli che eseguono codice della PR (`pytest`, `npm ci` con
i suoi script di lifecycle, `jest`). `actions/checkout@v5` lascia
`persist-credentials: true`, quindi il token scrivibile restava in `.git/config`
del runner mentre quel codice girava.

Per le PR da fork GitHub declassa comunque il token; ma questo repo lavora su
branch interni, e lì era pieno.

**`docs.yml` usava `contents: read`** — è il confronto che rende questo un fatto
e non un'opinione di stile.

**Chiusa applicando esattamente le tre cose scritte qui**: `contents: read` alla
radice dei due workflow, `permissions: contents: write` dentro `deploy` e
`release`, `persist-credentials: false` sui tre checkout che non pushano. In
`release` il `write` copre due scritture, non una: il push del tag e la GitHub
Release, che è `contents` anche lei per quanto la pubblichi `gh`.

**Oltre il «Dove» di questa voce**, con la stessa riga e la stessa ragione:
il checkout di `docs.yml`, che ha già `contents: read` ma esegue comunque
`npm ci`, la raccolta di pytest e `jest` della PR con una credenziale su disco.

**Verificato** parsando i quattro YAML e stampando permessi e `with:` di ogni
checkout job per job: radice `contents: read` ovunque, `write` solo su `deploy`
e `release`, `persist-credentials: false` sui checkout non pushanti e su nessuno
dei due che pushano.

**Quello che non si poteva verificare prima del merge:** `deploy` e `release`
girano solo su `main` (`if: github.ref == 'refs/heads/main'`). Che il permesso
di job basti al push e a `gh release create` lo dice la prima esecuzione vera —
la stessa nota che porta `T-14`.

**L'invariante è scritto dove lo si va a cercare**: `.claude/rules/ci-release.md`
passa da sei a sette, e il numero nel titolo cambia nella stessa modifica.

**Resta aperta la macchina che lo fa rispettare:** `T-30`.

---

Chiusa il **2026-09-13**, commit `501d6e8`.

### T-23 — Due copie di React nel monorepo
**Trovato il:** 2026-09-11 · **Dove:** `package.json:36-39`, `apps/mobile/package.json` (jest.moduleNameMapper) · **Gravità:** media · **Chi:** `mobile`

19.2.3 in `apps/mobile` e 19.2.8 in root. Due React danno un dispatcher nullo al
primo hook. Oggi è **tamponato** da un `moduleNameMapper` e da un override su
`react-test-renderer` — vedi T-03 per l'override inerte.

**Perché esistono due copie** (verificato il 2026-09-11, e **precedono i test**:
erano già nel lock a `b5ba358^`):

1. `apps/mobile/package.json` dichiara `react: 19.2.3` — versione **esatta**,
   pinnata da Expo SDK 57;
2. il `package.json` della root **non dichiara `react`**;
3. decine di pacchetti finiscono hoisted in `node_modules/` della root —
   `@expo/devtools`, `@expo/ui`, `@expo/metro-runtime`, `@radix-ui/*` — e
   dichiarano `react` come **peerDependency con `*`**;
4. npm deve soddisfare quelle peer, non trova `react` dichiarato in root, e ne
   installa una copia scegliendo l'**ultima pubblicata**: 19.2.8.

Le due copie convivevano innocue finché nessuno faceva rendering React dalla
root. `react-test-renderer` lo ha fatto, e ha reso il conflitto osservabile:
**non l'ha creato**.

Nota: `*` accetterebbe benissimo anche la 19.2.3. Non c'è un conflitto di range —
c'è solo che niente, in root, dice a npm quale scegliere.

**Causa individuata il 2026-09-11:** il nodo radice di `package-lock.json` **non
ha il campo `overrides`** — npm ce lo scrive quando li applica, e non c'è. Al
`npm install` si è appoggiato al lock esistente senza ricalcolare quel ramo. In
più `node_modules/react` è installato come **peer** (`"peer": true`), richiesto da
una dozzina di pacchetti Expo che dichiarano `react: "*"` e quindi accettano
qualunque versione: niente spinge npm a sceglierne una in particolare.

**Cosa serve:** rigenerare il lock (`npm install --package-lock-only`) perché gli
`overrides` mordano, sapendo che ricalcola l'albero. Poi verificare che
`node_modules/react` sia 19.2.3 e che i test restino verdi — se lo sono, il
`moduleNameMapper` in `apps/mobile/package.json` diventa superfluo e va tolto:
è il tampone, non il rimedio.

**Una scoperta non prevista da questa voce, fatta prima di applicare il
rimedio:** anche `node_modules/react-dom` era hoisted a 19.2.8 (`peer: true`,
`peerDependencies.react: "^19.2.8"`), per la stessa identica catena (`expo`,
`expo-router`, `@expo/metro-runtime`, `@expo/ui`, `react-native-web` lo
chiedono con `*`). Pinnare il solo `react` avrebbe lasciato `react-dom` a
pretendere un React che non esiste più. **Il rimedio è quindi `react` *e*
`react-dom`**, dichiarati insieme in root.

**Chiusa applicando esattamente questo**: `react` e `react-dom` aggiunti a
`dependencies` di root (19.2.3, stesso pin esatto di `apps/mobile`); `react` e
`react-test-renderer` tolti da `overrides` **nella stessa modifica** (npm
applica gli override prima di risolvere l'albero: lasciarli avrebbe reso il
lock ricalcolato illeggibile rispetto a cosa faceva davvero la dichiarazione).
npm ha stampato `npm warn ERESOLVE overriding peer dependency` per
`react-dom@19.2.8` che pretendeva `react ^19.2.8`: un warning, non un blocco —
risolto forzando entrambi a 19.2.3, che è esattamente quello che la
dichiarazione in `dependencies` chiede. Nessuno dei due override si è rivelato
necessario, quindi **restano fuori** — la voce che li citava (`T-03`) va
riletta di conseguenza. Il `moduleNameMapper` è stato rimosso nello stesso
commit.

**Effetto collaterale accettato, non scoperto dopo**: il ricalcolo del lock
aggiorna anche ~90 pacchetti Expo/Metro/radix non pinnati a versione esatta
(dichiarati con `^` o `*`) alle ultime versioni compatibili — verificato
riproducendo lo stesso ricalcolo in un clone pulito, per escludere che fosse
un artefatto di `node_modules` locale. Segnalato all'utente **prima** di
procedere, con la soglia decisa in anticipo («se il diff esce dalla famiglia
React, ci si ferma»); ha scelto di proseguire.

**Verificato su un'installazione pulita** (`npm ci` in un clone a parte, non
solo `--package-lock-only`, che non tocca `node_modules`): `npm ls react
react-dom` mostra una copia sola in tutto l'albero, e
`apps/mobile/node_modules/react`/`react-dom` non esistono più. Poi, senza il
mapper: `npm run typecheck`, `npm run lint`, `npm run mobile:test` (verde,
conteggio in `docs/TEST_COVERAGE.md`) ed `expo export --platform web`
(`build:web`, il comando che gira in CI) tutti verdi.

**Quello che non si è potuto verificare:** l'avvio reale dell'app
(`npm run dev:app`) su un dispositivo o un emulatore — nessuno disponibile in
questa sessione. È il sintomo originale (dispatcher nullo al primo hook), e
resta da provare alla prima sessione con un ambiente che lo permetta.

---

Chiuse il **2026-09-13**, commit `c7810fc` (sanatoria) e `45877de` (gate).

### T-19 — Letterali `rgba()` che ricalcolano token esistenti — schermate *e* primitive
**Trovato il:** 2026-09-11 · **Dove:** `app/calendario.tsx:94,99`, `app/(tabs)/_layout.tsx:58,80`, `app/intro.tsx:77`, `app/capo/[id].tsx:156`, `app/(tabs)/carica.tsx:289`, **`src/ui/base.tsx:93,165,171,820`** · **Gravità:** bassa · **Chi:** `mobile`

Il caso più netto è `calendario.tsx:99` → `rgba(21,21,26,0.4)`, che **è**
`testoSu.chiaro.debole`. Per una velatura esiste `velo(colore, alfa)`.

**I quattro in `base.tsx` sono stati trovati il 2026-09-11** e non erano in
questa voce: `placeholderTextColor="rgba(21,21,26,0.4)"` due volte,
`'rgba(21,21,26,0.45)'` sull'icona di `BarraChiedi`, e
`'rgba(247,244,239,0.1)'` — che è `velo(colori.crema, 0.1)`. Contano più degli
altri, perché la regola dice «primitive incluse» e stanno proprio lì. Il quinto,
in `PALETTE_BOTTONE_PRIMARIO`, è stato convertito nella PR che ha scritto la
regola: il refactor l'aveva trasportato lì dentro invece di risolverlo.

Non sono gatati perché il gate fallirebbe oggi: **prima si sanano, poi si
accende** — un gate rosso al primo giro viene disattivato.

**Chiusa applicando esattamente questo, in due commit distinti.** Il primo
sana i 18 letterali trovati — non 16: **due non erano in questa voce**,
`src/ui/capi.tsx:106` (il gradiente di `PiedeFoto`, un `TemplateExpression`
`` `rgba(21,21,26,${opacita})` ``) e `:279`, entrambi dentro una primitiva. E
`app/capo/[id].tsx:156` era **157**. Ogni sostituzione è o un token identico
già esistente (`testoSu.chiaro.debole`, 3 siti) o `velo(colore, alfa)` con
l'alfa esatto — mai un token *vicino* ma diverso, per non spostare un pixel
che questa voce non chiedeva di spostare.

Il secondo commit accende il gate: `test/convenzioni/colori.test.ts`, che
legge `app/` e `src/` con l'AST di TypeScript (lo stesso motivo per cui
`primitive.test.ts` ha smesso di usare un regex, T-01) e rifiuta ogni
`rgb()`/`rgba()`/esadecimale scritto a mano, con due esenzioni dichiarate:
`src/tema/tokens.ts` (la fonte) e `src/dati/dominio.ts` (`PALETTE_COLORI`,
dati di dominio). `RADICE`/`sorgenti()`/`analizza()` sono state estratte in
`test/convenzioni/fonti.ts` e condivise con `primitive.test.ts`, invece di
duplicate.

**Il gate è stato visto diventare rosso davvero**: reintrodotto
`rgba(21,21,26,0.4)` in `calendario.tsx:99`, `npm run mobile:test` ha fallito
nominando file e riga; ripristinata la riga, di nuovo verde e `calendario.tsx`
tornato byte-identico al commit precedente (`git diff` vuoto). Poi
`npm run typecheck`/`lint --workspace @wardrobe/mobile` ed `expo export
--platform web` (`build:web`) tutti verdi. Test dell'app: 21 → 23.

**Quello che non si è potuto verificare:** nessuno dei siti toccati è coperto
da `test/ui/leggibilita.test.tsx` (che esercita altre primitive), quindi
l'identità del pixel per queste sostituzioni si appoggia sulla lettura del
codice di `velo()` (produce `rgba(r,g,b,α)` senza spazi, byte-identico ai
letterali rimossi) e non su un'asserzione automatica.

### T-20 — Un esadecimale vive dentro una primitiva
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/src/ui/capi.tsx:280` · **Gravità:** bassa · **Chi:** `mobile`

`incerto ? '#FFF1EC' : 'rgba(21,21,26,0.04)'` — un rosa vicino a
`colori.coralloTenue` ma non identico, mai promosso a token. È il posto che la
vecchia regola («niente esadecimali nelle schermate») considerava al sicuro.

**Chiusa riusando `colori.coralloTenue`** invece di promuovere `#FFF1EC` a
token nuovo per un solo punto di chiamata. **È l'unico pixel che questa PR
sposta di proposito**: il fondo dell'attributo «incerto» passa da `#FFF1EC` a
`#FFE3DA`, leggermente più saturo — deciso con l'utente prima di applicarlo,
non scoperto dopo. Il ramo non-incerto della stessa riga (`rgba(21,21,26,0.04)`)
è diventato `velo(colori.inchiostro, 0.04)`, senza cambiare pixel.
