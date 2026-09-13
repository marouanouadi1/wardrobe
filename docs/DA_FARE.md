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
