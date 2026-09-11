# Istruzioni per Claude Code

Il README spiega il prodotto e l'architettura (`## Struttura`, `## Le quattro scelte che
tengono su tutto`) — leggilo prima. Qui solo le convenzioni che un agente sbaglierebbe senza
istruzioni esplicite.

**Lo stato reale del progetto non è in questo file**: sta in `docs/PROGRESS.md`. Aprilo prima
di dare per esistente — o per inesistente — qualunque cosa.

## Prima di aggirare un problema, chiedi se puoi toglierlo

È la regola che viene prima di tutte le altre, comprese quelle scritte qui sotto.

Quando qualcosa non funziona, la prima risposta che viene in mente è quasi sempre
un modo per **conviverci**: una configurazione in più, un'eccezione, un flag, un
adattatore. Funziona, e per questo è pericolosa: da quel momento il problema è
ancora lì, ma ha un custode — e il custode va mantenuto, spiegato a chi arriva, e
non si può più togliere senza sapere perché c'era.

**Il test, in una domanda sola:**

> Se togliessi la mia soluzione, il problema tornerebbe?

Se la risposta è sì, hai messo un **tampone**: la causa è ancora dove era. Se è
no, hai tolto la causa — e non c'è più niente da mantenere.

**Un tampone resta legittimo**, perché non sempre la causa si può togliere
adesso. Ma allora:

1. si **dichiara** che è un tampone, dove sta, con una riga che dice qual è la
   causa vera;
2. si apre la voce del rimedio in `docs/DA_FARE.md`;
3. quando il rimedio arriva, **il tampone si toglie** — altrimenti restano
   entrambi, e il secondo nasconde il primo.

Un tampone non dichiarato diventa, in tre settimane, un pezzo di architettura che
nessuno osa toccare perché nessuno sa più cosa reggeva.

**L'esempio di questo repo**, perché il principio non resti astratto. I test
dell'app fallivano: due copie di React nel monorepo, dispatcher nullo al primo
hook.

| | |
|---|---|
| **Tampone** | un `moduleNameMapper` in `apps/mobile/package.json` che forza i test a risolvere una copia sola. Funziona. Ma le due copie restano, il mapper va mantenuto, e il problema si ripresenta ovunque *fuori* dai test |
| **Causa** | la root non dichiara `react`; decine di pacchetti hoisted lì lo chiedono come peer con `*`; npm, non avendo una risposta, installa l'ultima. `apps/mobile` ha il suo pin esatto, e le copie diventano due |
| **Rimedio** | dichiarare `react` nelle `dependencies` della root. Le peer `*` si accontentano di quella, resta una copia sola — **e il mapper si può cancellare** |

Il segnale che distingue i due casi è nell'ultima colonna: il rimedio **toglie
righe**, il tampone ne aggiunge.

## Dove stanno le regole

Qui c'è **l'invariante**; in `.claude/rules/` c'è **come si rispetta e cosa succede se lo
violi**. Se una riga di una rule è copiabile pari pari qui, sta nel file sbagliato; se una riga
di questo file ha bisogno di un esempio per essere capita, l'esempio va nella rule.

**L'unica eccezione è la regola qui sopra**, che è ripetuta di proposito in ogni file di
`.claude/rules/`, nei criteri degli agenti e in `docs/adr/0008`: è la regola che decide la forma
di ogni soluzione, e va incontrata da chiunque apra uno qualunque di quei file, non solo da chi
legge questo. Se cambia, cambia **ovunque nella stessa modifica** — una copia divergente di
quella regola è peggio di nessuna copia.

| Area | File | Chi lo legge |
|---|---|---|
| Backend Python: dominio, adapter, handler | `.claude/rules/python.md` | `api`, `test` |
| App React Native: schermate, primitive, token | `.claude/rules/react-native.md` | `mobile` |
| La catena dei contratti generati | `.claude/rules/contratti.md` | `contracts`, e chi attraversa il confine |
| CI, rilascio, versioni | `.claude/rules/ci-release.md` | `ci-cd` |
| Migrazioni SQL (**irreversibili**) | `.claude/rules/migrazioni.md` | `api`, quando tocca `migrations/` |

**Dove una regola di progetto e un docblock nel codice divergono, vince il codice** — e questo
file va corretto nella stessa modifica. È già successo una volta, con la regola di `su`.

## Lingua del dominio

Tutto il codice applicativo è in italiano: nomi di funzione, variabili, tabelle SQL, modelli
Pydantic, componenti React, messaggi di errore. È una scelta deliberata, non incoerenza — non
proporre di anglicizzare identificatori esistenti. Codice nuovo segue la stessa convenzione.
Le librerie esterne (`react`, `pydantic`, nomi di pacchetti npm/pip) restano ovviamente in
inglese, così come termini tecnici senza una resa italiana naturale.

Vale anche per quello che scrivi tu: titoli di PR, messaggi di commit, commenti.

## Backend: `domain/` è puro, `adapters/` fa I/O

`services/api/src/domain/` non deve mai importare `psycopg` o `httpx` — è un vincolo imposto
dal linter (`pyproject.toml`, `flake8-tidy-imports.banned-api`), non solo una convenzione: un
import vietato fa fallire `ruff check` in CI. Gli `handlers/` restano sottili: leggono
l'evento, chiamano una funzione pura, formattano la risposta.

Dettaglio in `.claude/rules/python.md`.

## I contratti si generano, non si copiano

`services/api/src/domain/models.py` è la fonte di verità. Se lo modifichi, esegui subito
`npm run contracts:generate` e committa i file rigenerati. Non scrivere mai a mano un tipo
TypeScript che duplica un modello Pydantic, e non modificare a mano i file sotto
`packages/contracts/src/generated/`.

Lo stesso vale per gli elenchi di valori di una enum e per le soglie: si importano, non si
ridigitano. Due copie divergono in silenzio — è già successo.

Dettaglio, e i sintomi di una catena rotta, in `.claude/rules/contratti.md`.

## Lo stato di una risorsa

Ci sono due meccanismi legittimi: `useRisorsa`/`useAzione` (`apps/mobile/src/dati/risorsa.ts`)
e lo store `useArmadio()` (`src/dati/archivio.tsx`), che espone già
`pronto`/`erroreCaricamento`. Una schermata usa uno dei due. Quello che non si fa è una terza
strada: una nuova coppia `useState<boolean>` per caricamento ed errore, o una sequenza di
chiamate API scritta a mano. Un `catch {}` vuoto — che ingoia l'errore perché la schermata non
ha dove metterlo — è il segnale che serviva uno dei due fin dall'inizio.

Dettaglio in `.claude/rules/react-native.md`.

## Design: i valori nei token, le forme nelle primitive

Due regole non negoziabili:

- **`colori.ambra` (`#F5B324`) compare solo dove parla il modello** — badge di match, «letto
  dalla foto» — mai su un'azione dell'utente.
- **Una schermata compone le primitive di `apps/mobile/src/ui/`**: non ridefinisce una card, un
  bottone o un badge a mano, e non compone un colore da sé. Se manca una forma si aggiunge lì;
  se manca un colore si aggiunge a `src/tema/tokens.ts`, o si compone con `velo()`.

Le primitive sono **nove**, e la convenzione di `su` vive in `src/ui/fondo.tsx`: entrambe le
cose sono elencate in `.claude/rules/react-native.md`.

## Versioni: non toccarle a mano

`apps/mobile/app.json` (`expo.version`) e `services/api/pyproject.toml` (`version`) sono
scritti solo dalla pipeline di release (`scripts/bump-versione.mjs`) — vedi
`docs/adr/0005-le-versioni-vengono-dai-commit.md`. Un hook nega la scrittura di quei campi.

## Commit: conventional commit obbligatorio

Il titolo di ogni PR deve rispettare
`^(feat|fix|chore|docs|refactor|test|perf|build|ci|revert)(\(...\))?!?: .+`
(`pr-title.yml` lo valida in CI e fallisce altrimenti). Il tipo del commit determina anche il
livello di bump: `feat:` alza il minor, un `!` o `BREAKING CHANGE` alza il major.

## Rilascio: due pipeline indipendenti, e un merge è un rilascio

`api.yml` e `mobile.yml` hanno filtri `paths:` distinti e possono scattare entrambi sulla
stessa PR (es. toccando `packages/contracts/**`). Non serve un gruppo di concorrenza condiviso,
e aggiungerne uno con `cancel-in-progress` romperebbe di nuovo tutto: una release cancellerebbe
l'altra invece di metterla in coda.

**Un merge su `main` rilascia da solo**: sul backend rideploya sul VPS, sull'app builda un APK
e pubblica una Release. Dettaglio in `.claude/rules/ci-release.md`.

## Migrazioni: irreversibili, e rieseguite a ogni avvio

`applica_migrazioni.py` esegue **tutti** i file `.sql` in ordine lessicografico **a ogni
avvio**, senza tabella di versione e senza rollback. Regge solo perché ogni file è idempotente
per costruzione. Una migrazione non idempotente non rompe un deploy: **rompe ogni avvio
successivo**.

Prima di scriverne una, leggi `.claude/rules/migrazioni.md` per intero.

## Operazioni distruttive

**Mai eseguire un'operazione distruttiva o irreversibile senza accordo esplicito e preventivo
dell'utente** — vale in modalità autonoma, dentro un task lungo e per semplice comodità
operativa. Nessuna eccezione.

Sono distruttive, e si chiede sempre prima:

- `drop` / `drop column` in una migrazione, e qualunque `DELETE`/`TRUNCATE` massivo
- `docker compose down -v`, `docker volume rm` / `prune`, e ogni ricreazione che perde volumi
- sovrascrivere i `.env` **del server**: `rsync` li esclude di proposito, non sono nel repo e
  non hanno copia
- git che scarta lavoro: `reset --hard`, `clean -fdx`, force-push
- alzare a mano un numero di versione
- qualunque scrittura verso un servizio esterno (Sentry, fal.ai, provider LLM) fuori dal flusso
  previsto: un effetto fuori dal nostro sistema non lo annulla nessun ripristino

**Procedura:** fermarsi, dire cosa viene toccato o perso, proporre l'alternativa non
distruttiva, chiedere — *prima* di eseguire. Se il disordine viene da una propria operazione
(righe di prova), si puliscono *quelle* righe, non la tabella.

È invece **reversibile**, e non va trattato come distruttivo per paura: rigenerare
`packages/contracts/src/generated/` e rilanciare le migrazioni su un database sano.

## `apps/web` è vuoto apposta

Due file e un `dev` che esce con 1. Non è un lavoro da finire: `apps/mobile` è già React Native
Web. Nessun agente ci scrive — il quando e il perché aprirlo stanno in `apps/web/README.md`, e
riaprirlo è una decisione dell'utente.

## Gli agenti e l'instradamento

| Agente | Quando |
|---|---|
| `api` | dominio, adapter, handler, migrazioni |
| `mobile` | schermate, primitive, token, navigazione |
| `contracts` | ogni volta che `domain/models.py` si muove, o `contracts:check` è rosso |
| `ci-cd` | workflow, deploy, Docker, Caddy, logica di bump |
| `test` | i test del backend, e quelli dell'app sotto `apps/mobile/test/` |
| `doc-writer` | README, `docs/**`, ADR — **non** questo file né `.claude/**` |
| `security` | auth, IDOR, segreti, injection — **sola lettura: non corregge** |
| `reviewer` | qualità, prima di una PR — **sola lettura** |
| `orchestrator` | task che attraversano più di un proprietario |

**Tre catene non si spezzano:**

1. `domain/models.py` cambia → `api` → **`contracts`** → `mobile` (typecheck) → `test`
2. `migrations/` → `api` col protocollo, poi `reviewer`
3. finding di sicurezza → `security` (trova) → `api`/`mobile` (corregge) → `test` (regressione)

## I file di stato: quale si tocca, dopo cosa

L'agente non ha memoria fra le sessioni: lo stato del progetto vive in questi file, e un file
non aggiornato è uno stato perso. Si aggiornano **nella stessa PR** del cambiamento.

| Hai fatto questo | Tocchi |
|---|---|
| implementato o finito qualcosa | `docs/PROGRESS.md` (la riga dice **come** è stata verificata) + `CHANGELOG.md` |
| **trovato qualcosa fuori dallo scope di quello che stai facendo** | `docs/DA_FARE.md`, **subito** — vedi sotto |
| scoperto che qualcosa è bloccato da una dipendenza esterna | `docs/PROGRESS.md`: `[!]`, e la riga dice **da cosa** |
| aggiunto o tolto un test | `docs/TEST_COVERAGE.md` — **altrimenti `docs.yml` fa cadere la PR** |
| incontrato una scelta dell'utente su codice **già scritto** | `docs/QUESTIONI.md`, **subito**: una questione ricordata a voce è una questione persa |
| incontrato qualcosa che la **specifica** non dice | `docs/DOMANDE_APERTE.md` |
| ricevuto una risposta dall'utente | sposti la voce fra le chiuse con la data. Non la cancelli: la risposta senza la domanda non si capisce |
| preso una decisione che un domani qualcuno ridiscuterebbe | un ADR nuovo in `docs/adr/`. **`DECISION_LOG.md` non esiste e non va creato** — vedi ADR 0007 |
| cambiato prodotto o architettura | `README.md`. **Mai** un numero di test, di righe o di schermate |

## Quello che trovi mentre fai altro

Lavorando a una cosa se ne notano altre: un difetto di sfuggita, un rimedio che si
vede ma non si può fare adesso. **Si scrivono subito, nella stessa PR.** Una cosa
notata e non scritta è persa, e ritrovarla la seconda volta costa più che
scriverla la prima.

Ci sono due posti, e il criterio è operativo:

> **Se un agente che sta per toccare quel file deve saperlo → `docs/DA_FARE.md`.**
> **Se è l'utente a dover decidere quando farlo → una issue su GitHub.**

Una voce **non sta mai in entrambi**: quando un debito diventa lavoro pianificato,
si apre la issue e la voce nel file rimanda con una riga (`→ #12`). Due copie
divergono.

Non ci vanno: una **scelta** che aspetta l'utente (è `QUESTIONI.md`) e una lacuna
di **specifica** (è `DOMANDE_APERTE.md`). Se una voce di `DA_FARE.md` non ha un
rimedio ma una decisione da prendere, è nel file sbagliato.

Una voce chiusa si sposta in `## Fatte` con la data e il commit. Non si cancella:
una voce sparita non si distingue da una dimenticata.

## Come si riferisce il lavoro

Quattro voci, nessuna opzionale:

1. **cosa è stato fatto**, una riga per punto
2. **cosa è stato verificato**, col comando e l'esito reale
3. **cosa è rimasto fuori**, e perché
4. **cosa serve dall'utente**: una decisione, una credenziale, una conferma

La terza è quella che si tende a omettere, ed è quella che decide se ci si può fidare delle
altre. Se i test falliscono, si dice, con l'output. Se un passaggio è stato saltato, si dice.

## Test e verifica

- `npm run typecheck && npm run lint` — su tutti i workspace
- `npm run api:test` — dominio e handler, offline, senza container
- `npm run api:cov` — con la coverage e le soglie che impone la CI
- `npm run api:lint` — ruff check + format + `mypy --strict`
- `npm run mobile:test` — i test dell'app (leggibilità e convenzioni delle primitive)
- `npm run contracts:check` — da rilanciare dopo ogni modifica a `domain/models.py`
- `npm run dev:app` — stack locale completo (Postgres + API + Expo) per provare un flusso a
  mano prima di considerarlo finito
