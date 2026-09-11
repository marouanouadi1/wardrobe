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
stesso giorno sull'intero branch — quella che ha **eseguito** gli hook invece di
leggerli, e da cui vengono `T-26`, `T-27` e `T-28`.

Sette voci sono state chiuse nella stessa PR e stanno in `## Fatte`; `T-08` e
`T-12` sono rimaste aperte ma più corte, con scritto cosa di preciso resta.

### T-08 — Due costrutti restano fuori dal gate delle migrazioni, e i commenti si tolgono dentro i literal
**Trovato il:** 2026-09-11 · **Ridotta il:** 2026-09-11 · **Dove:** `.claude/hooks/migrazione-idempotente.py` · **Gravità:** bassa · **Chi:** sessione principale

La gran parte di questa voce è chiusa: regola 5 (file già su `main`) e regola 6
(`drop`) adesso **chiedono**, `concurrently` non esenta più, `create type`,
`add constraint` e `create trigger` sono coperti, il path si risolve invece di
essere confrontato come stringa. Tutto verificato in `scripts/prova-hook.py`.

Resta:

- **`alter column … set not null`** non è coperto. È il terzo modo di mettere un
  vincolo su una tabella che ha già righe, e fallisce esattamente come gli altri
  due — ma la forma è diversa e il pattern non la vede;
- **`re.sub(r"--[^\n]*", …)` mangia dentro i literal**: un `insert` che contiene
  la stringa `'-- non è un commento'` perde tutto quello che segue sulla riga.
  Oggi nessuna migrazione lo fa; il giorno che succede il gate legge SQL diverso
  da quello che verrà eseguito, ed è il modo peggiore di sbagliare;
- **`create type` e `add constraint` si esentano se il file contiene la parola
  `exception`**, che è il segnale di un blocco `do $$ … exception … $$`. È
  un'approssimazione dichiarata, non un'analisi: un file con un `do/exception`
  altrove esenta anche un `create type` che non ne ha. Sta dalla parte
  permissiva di proposito — un gate nuovo che nega a torto viene disattivato —
  ma è bene sapere che è una parola cercata, non una struttura riconosciuta.

**Cosa serve:** il pattern per `set not null`, e uno stripper che salti i
literal fra apici invece di ignorarli. Entrambi con il loro caso nel banco.

### T-12 — Bash non è intercettato da niente, e i tre agenti «in sola lettura» ce l'hanno
**Trovato il:** 2026-09-11 · **Dove:** `.claude/settings.json:20,37`, `.claude/agents/{security,reviewer,orchestrator}.md` · **Gravità:** alta · **Chi:** sessione principale

Il `matcher` dei quattro hook è `"Write|Edit"`. **Non esiste nessun hook su
`Bash`**, e `Bash` scrive file: `sed -i`, `tee`, `> file`, `git apply`. Quindi
l'affermazione in `.claude/README.md` — «hanno `tools: Read, Bash, Glob, Grep` —
non possono scrivere, ed è deliberato» — **non è vera come scritta**.

Peggio: **nessuna regola `deny` copre `.claude/**`**, quindi un agente può
riscrivere i propri gate col tool più ovvio.

Il limite di Bash era **già dichiarato** in `.claude/README.md:45-47`. Il finding
non è il limite: è che **la mitigazione dichiarata non è un controllo** — in
`settings.json` non c'è `defaultMode`, non c'è `permissions.ask`, non c'è un hook
su `Bash`. Una sessione in auto-approvazione non incontra nulla.

**Fatto il 2026-09-11, la metà che si poteva fare senza un parser:**
`Edit(./.claude/**)` è nella `deny`, e con lui `git clean`, `git push -f`,
`docker compose down -v|--volumes`, `docker volume rm|prune` — tutti nominati da
CLAUDE.md fra le operazioni che si chiedono sempre prima, e tutti assenti dalla
lista. (Verificati dal reviewer eseguendoli davvero: `git clean -fdx` cancellava
un file non tracciato senza incontrare niente, e `git push --force:*` non
intercetta `-f`.)

**Resta aperta la parte che conta**, e va saputo che `deny` su Bash è un
confronto per prefisso: `cd x && git clean` non somiglia a `git clean`. Chiude
la strada distratta, non quella decisa.

**Cosa serve:** un hook `PreToolUse` con `matcher: "Bash"` che legga
`tool_input.command` e neghi le scritture sui path protetti e le letture di
`*.env*`. Non è stato scritto qui di proposito: una guardia che decide su una
riga di shell con dei regex è essa stessa un tampone col custode (`docs/adr/0008`),
e va disegnata con calma e con il suo banco di prova — non di rimbalzo, nella
stessa sessione che stava riscrivendo gli altri quattro hook. Va rifatta anche
la frase di `.claude/README.md:45-47`: dice «Bash va lasciato in modalità con
conferma», che è una raccomandazione, non un controllo — in `settings.json` non
c'è né `defaultMode` né `permissions.ask`.

### T-13 — `contents: write` dichiarato a livello di workflow invece che di job
**Trovato il:** 2026-09-11 · **Dove:** `.github/workflows/api.yml:25-26`, `mobile.yml:25-26` · **Gravità:** media-alta · **Chi:** `ci-cd` · **Pre-esistente**

Serve al job `deploy`/`release`, ma i job `quality`, `contracts` e `checks` lo
ereditano — e sono quelli che eseguono codice della PR (`pytest`, `npm ci` con i
suoi script di lifecycle, `jest`). `actions/checkout@v5` lascia
`persist-credentials: true`, quindi il token scrivibile resta in `.git/config` del
runner mentre quel codice gira.

Per le PR da fork GitHub declassa comunque il token; ma questo repo lavora su
branch interni, e lì è pieno.

**`docs.yml` usa `contents: read`** — è il confronto che rende questo un fatto e
non un'opinione di stile.

**Cosa serve:** `contents: read` alla radice, `write` dentro il job che rilascia,
e `persist-credentials: false` sui checkout che non pushano.

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

### T-19 — Letterali `rgba()` che ricalcolano token esistenti — schermate *e* primitive
**Dove:** `app/calendario.tsx:94,99`, `app/(tabs)/_layout.tsx:58,80`, `app/intro.tsx:77`, `app/capo/[id].tsx:156`, `app/(tabs)/carica.tsx:289`, **`src/ui/base.tsx:93,165,171,820`** · **Gravità:** bassa · **Chi:** `mobile`

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

**Cosa serve:** sostituirli con i token o con `velo()`, poi aggiungere la regola
al gate delle convenzioni (T-01/T-02).

### T-20 — Un esadecimale vive dentro una primitiva
**Dove:** `apps/mobile/src/ui/capi.tsx:280` · **Gravità:** bassa · **Chi:** `mobile`

`incerto ? '#FFF1EC' : 'rgba(21,21,26,0.04)'` — un rosa vicino a
`colori.coralloTenue` ma non identico, mai promosso a token. È il posto che la
vecchia regola («niente esadecimali nelle schermate») considerava al sicuro.

**Cosa serve:** promuoverlo a token, o usare quello che c'è già se il
discostamento non è voluto.

### T-21 — `carica.tsx` scrive a mano una sequenza di quattro chiamate, duplicata
**Dove:** `apps/mobile/app/(tabs)/carica.tsx:149-152` e `:224-227` · **Gravità:** media · **Chi:** `mobile`

`firmaUpload → caricaFoto → avviaAnalisi → statoAnalisi`, scritta due volte in due
percorsi, in un file di 378 righe con stato di caricamento fatto a mano. È il
debito più grosso dell'app, ed è la terza strada che `.claude/rules/react-native.md`
dice di non prendere.

**Cosa serve:** un hook che incapsuli la sequenza, componendo `useAzione`.

### T-22 — `chat.ts` re-implementa la coppia caricamento/errore
**Dove:** `apps/mobile/src/dati/chat.ts:46-47` · **Gravità:** bassa · **Chi:** `mobile`

`useChat` tiene `caricamento`/`inAttesa` per conto proprio invece di comporre
`useRisorsa`. È un'astrazione sorella dentro `dati/`: la duplicazione più
strutturale del frontend, perché non è in una schermata ma accanto all'astrazione
che dovrebbe usare.

**Cosa serve:** comporre `useRisorsa`, o dire per iscritto perché non si può.

### T-23 — Due copie di React nel monorepo
**Dove:** `package.json:36-39`, `apps/mobile/package.json` (jest.moduleNameMapper) · **Gravità:** media · **Chi:** `mobile`

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

**Cosa serve:** provare il criterio largo in locale, e se è pulito togliere
l'eccezione a mano.

### T-25 — `dichiaraProp` guarda solo la destrutturazione del primo parametro
**Trovato il:** 2026-09-11 · **Dove:** `apps/mobile/test/convenzioni/primitive.test.ts` · **Gravità:** bassa · **Chi:** `mobile`

Un componente che usasse `props.style` (o `props.sfondo`) senza destrutturare
sfuggirebbe a entrambe le derivazioni — la funzione si chiama `dichiaraProp` da
quando serve anche a `sfondo`. Nessuno lo fa oggi, e il pavimento a sei nomi è la difesa contro una
regressione silenziosa, ma il buco esiste.

**Cosa serve:** guardare anche gli accessi `props.style`, o accettarlo e dirlo
nel commento (oggi non è scritto).

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

Chiuse il **2026-09-11**, nella stessa PR che le ha trovate: sono i difetti
degli hook di `.claude/`, venuti fuori **eseguendoli** invece che leggendoli.
Verifica comune: `python3 scripts/prova-hook.py` verde, più i comandi indicati
voce per voce.

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

### T-06 — `contratti-allineati.py` è inerte nel flusso di lavoro che lo ha prodotto
**Trovato il:** 2026-09-11 · **Dove:** `.claude/hooks/contratti-allineati.py:28-33` · **Gravità:** media · **Chi:** sessione principale

`git status --porcelain` vede solo il **non committato**. Se `models.py` è stato
modificato **e committato** nella sessione, il working tree è pulito, l'hook esce
prima di eseguire `contracts:check`, e il disallineamento arriva intatto al job
`contracts` — cioè esattamente il guasto che l'hook cita nel proprio docstring.

Non è teorico: i commit `b5ba358`, `437089c` e `1a35d83` portano lo stesso
trailer `Claude-Session`. **Una sessione, tre commit.** Committare dentro la
sessione è il flusso normale di questo repo, ed è quello in cui l'hook non scatta
mai.

Secondo difetto: l'hook non legge `stop_hook_active`. Se `contracts:check`
continua a fallire, il `Stop` viene bloccato a ogni giro — la ricetta per un
ciclo infinito.

**Cosa serve:** `git diff --name-only origin/main...HEAD -- <models.py>` unito a
`git status`, e la guardia di rientro.

**Chiusa il 2026-09-11.** `modelli_mossi()` guarda il working tree **e** il branch rispetto a `origin/main`/`main`, quindi vede anche il lavoro già committato in sessione; `stop_hook_active` viene letto e chiude il rientro; il timeout del sottoprocesso (240s) sta sotto quello dell'hook (300s) e `TimeoutExpired` produce un `block` con la diagnosi invece di un traceback.

### T-07 — I due hook che devono *impedire* falliscono aperti
**Trovato il:** 2026-09-11 · **Dove:** `.claude/hooks/versioni-non-a-mano.py:36-38`, `migrazione-idempotente.py:57-59` · **Gravità:** media · **Chi:** sessione principale

`except Exception: return`, col commento «un hook che non capisce l'evento non
blocca il lavoro». Per una guardia che deve impedire, «non ho capito» e «non sono
partito» devono valere *deny* o almeno *ask*, mai *allow*: un payload malformato,
un `python3` assente, un bit di esecuzione perso, un timeout — tutte strade in
cui la scrittura passa senza che nessuno lo veda.

**Cosa serve:** emettere `permissionDecision: "ask"` con il motivo, invece di
`return`.

**Chiusa il 2026-09-11.** Entrambi gli hook rispondono `permissionDecision: "ask"` con il motivo quando non capiscono l'evento, invece di `return`. Provato con stdin non-JSON su tutti e due.

### T-09 — `versioni-non-a-mano.py`: un falso positivo e un terzo file non sorvegliato
**Trovato il:** 2026-09-11 · **Dove:** `.claude/hooks/versioni-non-a-mano.py:20,52-58` · **Gravità:** bassa · **Chi:** sessione principale

**(a)** Un `Write` non porta `old_string`, quindi la guardia «la riga c'è ma non
cambia» non scatta: qualunque riscrittura integrale di `pyproject.toml` o
`app.json` che *contenga* la versione — anche identica — viene negata. Contraddice
il docstring dello stesso file.

**(b)** `scripts/bump-versione.mjs:32-38` scrive **tre** campi, non due: anche
`apps/mobile/package.json`. Quel file si può alzare a mano senza incontrare
nessuna guardia. Qui è la **regola** a essere indietro rispetto allo script:
`CLAUDE.md` e `ci-release.md` nominano solo due file.

**Cosa serve:** sul `Write` confrontare con la versione su disco; aggiungere
`apps/mobile/package.json` ai sorvegliati **e** alla regola scritta.

**Chiusa il 2026-09-11.** **(a)** il confronto «la versione non cambia» si fa con il **file su disco**, non con `old_string`: una `Write` integrale a versione identica adesso passa, ed è quello che il docblock dell'hook prometteva. **(b)** `apps/mobile/package.json` è fra i sorvegliati, e la regola scritta in `CLAUDE.md` e `.claude/rules/ci-release.md` dice tre file invece di due. In più la regex TOML accetta anche gli apici singoli: `version = '0.4.2'` è TOML valido e passava.

### T-10 — I quattro hook sono gli unici gate del progetto senza copertura
**Trovato il:** 2026-09-11 · **Dove:** `.claude/hooks/` · **Gravità:** media · **Chi:** `test` + `ci-cd`

Nessun test li esercita, nessun job CI li invoca. Il commit dichiara «provati su
dieci casi»: quei dieci casi non esistono come artefatto, quindi **niente si
accorgerebbe se un hook smettesse di negare**.

È il criterio scritto in `.claude/rules/ci-release.md` rivolto contro chi l'ha
scritto: *«una regola che la CI non fa fallire non è una regola»*.

**Cosa serve:** i dieci casi resi test veri (uno script in `scripts/` richiamato
da `docs.yml`, che non ha filtri sui path), con la tabella completa: payload
lecito → nessun deny; illecito → deny; troncato → **non** silenzio.

**Chiusa il 2026-09-11.** `scripts/prova-hook.py` — la tabella dei casi è la specifica leggibile di cosa ciascun hook impedisce, e comprende le sette migrazioni vere del repo come difesa contro un pattern nuovo troppo largo. Gira nel job `hook` di `docs.yml`, che non ha filtri sui path. Verifica il canale oltre alla decisione: un `deny` senza motivo è un fallimento.

### T-11 — Quattro hook, tre convenzioni di output, e il canale non è stato verificato
**Trovato il:** 2026-09-11 · **Dove:** `.claude/hooks/` · **Gravità:** media · **Chi:** `ci-cd`

I due `PreToolUse` mettono tutto il messaggio in `systemMessage`; il `Stop` usa
`{"decision": "block", "reason": …}`; `lint-immediato.sh` stampa testo nudo ed
esce 0. «Provati su dieci casi» riguarda la **logica di decisione**, non il
**canale**: sono due cose diverse e solo la prima è stata verificata.

Il dubbio concreto: con `permissionDecision: "deny"`, il campo che il modello
legge potrebbe essere `permissionDecisionReason`, mentre `systemMessage` è un
avviso all'utente. Se è così, il modello viene fermato **senza sapere perché** — e
per l'hook delle migrazioni il messaggio *è* il valore dell'hook.

**Cosa serve:** una prova per hook in una sessione vera, e poi una convenzione
sola.

**Chiusa il 2026-09-11.** Una convenzione sola per evento, e provata: i due `PreToolUse` emettono `permissionDecisionReason` (il campo che torna **al modello**) oltre a `systemMessage`; `lint-immediato.sh` non stampa più su stdout — che su PostToolUse il modello non legge — ma emette `{"decision": "block", "reason": …}` come lo `Stop`. Il dubbio che la voce sollevava era fondato: i dinieghi arrivavano all'agente come «Hook PreToolUse:Write denied this tool», senza motivo. **Provato dal vivo, non solo sull'emissione**: una `Write` di un file in `src/domain/` con un `import sys` inutilizzato ha fatto arrivare nel contesto del modello l'intero rapporto di ruff (`F401`, con riga e suggerimento) come messaggio bloccante. Prima la stessa scrittura tornava indietro come un «file updated successfully» qualunque.

### T-15 — Estendere il divieto di lettura a tutti i file d'ambiente
**Trovato il:** 2026-09-11 · **Dove:** `.claude/settings.json:3-6` · **Gravità:** bassa · **Chi:** sessione principale

Oggi sono negati tre percorsi esatti. `apps/mobile/.env` non è coperto, e un
futuro `services/api/.env.production` nascerebbe scoperto.

**Cosa serve:** `Read(./**/.env*)`. (Non chiude il buco di Bash — vedi T-12.)

**Chiusa il 2026-09-11.** `Read(./.env*)` e `Read(./**/.env*)` sostituiscono i tre percorsi esatti: due righe al posto di tre, e un `.env` nuovo nasce coperto.
