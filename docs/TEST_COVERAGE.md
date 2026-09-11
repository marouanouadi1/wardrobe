# Test e coverage

## Come si legge questo file

**È l'unico posto del repo in cui è lecito scrivere un numero di test o una
percentuale di coverage.** Altrove si scrive «i test», non «163 test»: un numero
in prosa invecchia in silenzio, e questo repo ne ha già avuti tre diversi per lo
stesso fatto nello stesso file.

Due tipi di numero, e si comportano diversamente:

- **Numeri correnti** — il conteggio dei test e le soglie. Sono **verificati in
  CI** da `.github/workflows/docs.yml`: se divergono dal repo, la PR non passa.
- **Numeri misurati** — la coverage per modulo. Portano data e id della run: sono
  una fotografia, non una promessa. Si rimisurano quando si tocca questo file.

## Numeri correnti

- **Test backend:** 163
- **Test app:** 21
- **Soglia coverage totale:** 73% — `services/api/pyproject.toml`
- **Soglia coverage `src/domain/`:** 97% — `.github/workflows/api.yml`
- **Soglia coverage `src/handlers/`:** 92% — idem, escluso `local_server.py`

Le soglie sono un **cricchetto**: si alzano nella stessa PR che alza la coverage
vera, non si abbassano mai. Abbassarne una non è un commit: è una voce in
`docs/QUESTIONI.md`.

## Backend — cosa è coperto

| File | Test | Righe |
|---|---:|---:|
| `tests/domain/test_wardrobe.py` | 30 | 196 |
| `tests/domain/test_vision.py` | 25 | 196 |
| `tests/domain/test_stylist.py` | 23 | 184 |
| `tests/domain/test_chat.py` | 15 | 164 |
| `tests/domain/test_firma_foto.py` | 5 | 39 |
| `tests/domain/test_segnalazioni.py` | 2 | 40 |
| `tests/handlers/test_handlers.py` | 38 | 432 |
| `tests/handlers/test_chat_handler.py` | 13 | 246 |
| `tests/handlers/test_analisi.py` | 4 | 125 |
| `tests/handlers/test_suggerimenti.py` | 2 | 88 |
| `tests/adapters/test_google_provider.py` | 6 | 63 |
| **Totale** | **163** | **1.773** |

Più `conftest.py` (139) e `fakes.py` (65), che non contengono test.

Nessun `@pytest.mark.parametrize` nel repo: **il conteggio dei `def test_`
coincide con quello che pytest raccoglie.** Il gate in `docs.yml` usa comunque
`pytest --collect-only`, così il primo test parametrizzato non farà mentire
questo file per difetto.

## Backend — cosa non lo è, e perché

Il 74% totale (73,51% esatto) è una media che nasconde la forma vera:

| Area | Coverage | Istruzioni |
|---|---:|---:|
| `src/domain/` | **98%** (97,85) | 746, di cui 16 scoperte |
| `src/handlers/` | **73%** — **93%** (93,03) senza `local_server.py` | 579, di cui 152 scoperte |
| `src/adapters/` | **40%** | 551, di cui 329 scoperte |

**A zero:**

| File | Istruzioni | Cos'è |
|---|---:|---|
| `src/adapters/postgres.py` | 123 | **il percorso dati che gira in produzione.** Tutti i 163 test girano su `ArchivioInMemoria` (97%) |
| `src/handlers/local_server.py` | 120 | la tabella `ROTTE` e il dispatch: il codice che serve ogni richiesta sul VPS |
| `src/adapters/filesystem.py` | 57 | le foto su disco |
| `src/adapters/scontorno/fal_provider.py` | 25 | lo scontorno via fal.ai |

I provider LLM stanno fra il 38% e il 61%: è coperta la costruzione del prompt,
non la chiamata.

**Non è un incidente: è la stessa separazione che il linter impone.** Il dominio è
puro e quindi testabile offline; gli adapter fanno I/O e non lo sono senza
container. Il commento allo step Pytest di `api.yml` lo dice al contrario: *«se un
test qui ha bisogno di credenziali, la separazione handlers/domain è stata
violata»*.

Per questo **non c'è una soglia su `adapters/`**: imporla spingerebbe verso mock
della SDK, cioè verso il contrario di quello che quella separazione ottiene. Il
40% si dichiara qui, fra i debiti, che è il posto giusto per un numero che non si
vuole difendere.

Il punto non è alzare la media: è **sapere** che il percorso dati in produzione
non è coperto da nessun test.

## App — cosa è coperto

Il primo lotto non insegue la copertura: prende la classe di difetti che `tsc`
non vede, cioè **il colore del testo contro il fondo che una primitiva dipinge
davvero**. È già costata una regressione reale (PR #4, «Fix invisible text on the
onboarding light button»).

| File | Test | Cosa verifica |
|---|---:|---|
| `test/ui/leggibilita.test.tsx` | 12 | il colore risolto di un testo dentro `Scheda`, `BottonePrimario` (nelle quattro varianti, inclusa la combinazione `pericolo + disabilitato`), `Pillola` (attiva e no, nei due ambienti), `Segmenti`, `BottoneSecondario` |
| `test/ui/fondo.test.tsx` | 5 | il meccanismo: `useFondo()` senza provider, ereditarietà, annidamento a tre livelli |
| `test/convenzioni/primitive.test.ts` | 4 | che nessuno ridipinga il fondo di una primitiva dal di fuori: né con `style={{ backgroundColor }}` — la forma esatta della regressione di PR #4 — né passando `sfondo` senza dire con `su` su che fondo ci si posa |

I test non verificano che una prop venga inoltrata: **verificano il colore
risolto contro il fondo effettivamente dipinto**. È un invariante più forte, e
sopravvive al prossimo refactor del meccanismo — che è appena successo, dal
prop-drilling al contesto (`ee7f492`).

`primitive.test.ts` è l'unico che può prendere il difetto vero, perché quello non
è un bug di una primitiva ma di un punto di chiamata: legge i sorgenti di `app/`
e `src/` con l'AST di TypeScript (non più un regex: si fermava alla prima `>`,
quasi sempre quella di `onPress={() => …}` su una chiamata multi-riga) e rifiuta
un `backgroundColor` passato, ovunque stia nell'elenco degli attributi, a una
primitiva **derivata**, non scritta a mano: quelle che, in `src/ui/**`, dipingono
un `<Fondo su=…>` *e* dichiarano `style` fra i propri parametri (oggi sei:
`Campo`, `BarraChiedi`, `Scheda`, `BottonePrimario`, `SchedaFoto`, `PiedeFoto`).

`style` non è però l'unico modo di ridipingere: `Scheda` e `SchedaFoto`
espongono una prop **`sfondo`**, e calcolano `<Fondo su={su ?? 'chiaro'}>` per
conto proprio. I due ingressi non si consultano: `<Scheda
sfondo={colori.inchiostro}>` dipinge una card quasi nera e continua a
dichiarare `chiaro` a chi ci sta dentro — la stessa regressione, dalla porta
principale. Non è ipotetico: il docblock di `SchedaFoto` racconta che
`carica.tsx` le passava `colori.inchiostro` «senza modo di dirlo ai testi
dentro». Il quarto test deriva le primitive che accettano `sfondo` *e*
asseriscono un `<Fondo>`, e rifiuta ogni chiamata che passi `sfondo` senza `su`.
I tre punti di chiamata che lo facevano (`calendario.tsx`, `avviso.tsx`,
`capo/[id].tsx`) sono stati resi espliciti prima di accendere il gate: tutti e
tre dipingevano un fondo chiaro, quindi l'asserzione coincide con il
comportamento di prima — non cambia un pixel, cambia che adesso è scritta.

Il criterio ha **un'eccezione dichiarata**, `BottoneSecondario`: dipinge un fondo
e accetta `style`, ma non asserisce nessun `<Fondo>` — l'inchiostro lo ricava da
`useFondo()`, cioè dal fondo di sotto, che è la forma più pura della regressione
di PR #4. L'elenco a mano lo conteneva e quella riga era **viva**; derivarlo e
fermarsi al criterio avrebbe *perso* copertura invece di aggiungerne. Sta in
`RIDIPINGIBILI_SENZA_FONDO`, un nome solo col motivo accanto. Il rimedio
definitivo — un criterio su «dipinge un `backgroundColor` che non eredita» —
allarga l'insieme derivato e va acceso solo potendo eseguire il gate prima.

Del vecchio elenco di dieci nomi, quattro dichiaravano `style` e quindi erano
righe vive (`BottonePrimario`, `BottoneSecondario`, `Scheda`, `SchedaFoto`); gli
altri sei non hanno alcuna prop `style`, quindi `tsc` rifiuta già la chiamata da
sé e quelle righe non verificavano niente. Ne mancavano due vere (`Campo`,
`BarraChiedi`) più `PiedeFoto`, che nessuno aveva considerato.

**Il gate è stato visto diventare rosso e poi tornare verde** (2026-09-11): la
violazione è stata reintrodotta davvero in una schermata vera — `<Scheda
sfondo={colori.inchiostro}>` senza `su` in `calendario.tsx` — e `npm run
mobile:test` è passato da 21 verdi a «1 failed, 20 passed», indicando il file e
la riga; ripristinata la riga, di nuovo 21 verdi. Era la verifica che mancava:
la prima stesura di questo gate non aveva potuto eseguire `jest`, e un gate mai
visto fallire è indistinguibile da un gate che non morde.

### Come girano

`jest-expo` (non vitest: React Native 0.86 distribuisce sorgente Flow non
transpilata, e `jest-expo` è l'unico preset che Expo tiene allineato a ogni SDK).
Due dettagli di configurazione che non sono cosmetici:

- **i test vivono in `apps/mobile/test/`, mai sotto `app/`**: lì dentro ogni file
  diventa una rotta di expo-router e finirebbe nel bundle di `expo export`;
- **`moduleNameMapper` forza una sola copia di React**. Il monorepo ne ha due, e
  **le aveva già prima di questi test**: 19.2.3 in `apps/mobile` (versione esatta,
  pinnata da Expo) e 19.2.8 in root. La root non dichiara `react`, ma decine di
  pacchetti hoisted lì — `@expo/*`, `@radix-ui/*` — lo chiedono come
  peerDependency con `*`: npm ne installa una copia per soddisfarli, e con quel
  range sceglie l'ultima pubblicata.
  Le due copie convivevano in pace finché nessuno faceva rendering React dalla
  root. Introdurre `react-test-renderer` (che jest-expo e RTL richiedono) lo ha
  fatto: quello vede il React di root, i sorgenti dell'app vedono il proprio, e
  due React danno un dispatcher nullo — `useContext` su `null` al primo hook.
  Gli `overrides` allineano `react-test-renderer`, il mapper chiude il caso.
  Nessuno dei due risolve la causa: vedi `T-23` in `docs/DA_FARE.md`.

In `@testing-library/react-native` 14 **`render` restituisce una Promise**: i
test sono `async` e fanno `await render(...)`. Senza `await` le query non
esistono ancora e l'errore che si legge è `getByText is not a function`.

## Gli hook di `.claude/hooks/`

`scripts/prova-hook.py` — eseguito da `docs.yml` (job `hook`) e a mano con
`python3 scripts/prova-hook.py`. Senza un numero in prosa: il conteggio dei casi
cambia a ogni caso nuovo, e nessun gate lo verificherebbe.

Non stanno né in pytest né in jest perché non sono codice del prodotto: sono i
gate che decidono cosa un agente può scrivere. Prima non li esercitava nulla —
erano gli **unici** gate del progetto senza copertura — e la conseguenza è
arrivata puntuale: tre falsi positivi (una migrazione corretta negata perché
aveva due spazi prima di `if not exists`; un `default` scritto prima di `not
null`; qualunque riscrittura integrale di `pyproject.toml`, anche a versione
identica) e tre falsi negativi (`numeric(10,2) not null` che passava perché il
segnaposto del tipo non aveva la virgola; un `not null` composto su due `Edit`
successive; `drop table if exists`, che le regole del repo vogliono si chieda
all'utente).

Il banco verifica due cose separate:

- **la decisione** — `allow` / `deny` / `ask` / `block`: la tabella dei casi è
  la specifica leggibile di cosa ciascun hook impedisce, e include le sette
  migrazioni vere del repo col contenuto che hanno oggi, come difesa contro un
  pattern nuovo troppo largo;
- **il canale** — ogni `deny` e ogni `ask` devono portare
  `permissionDecisionReason`, che è il campo che torna *al modello*. Senza, il
  diniego arriva all'agente come «Hook PreToolUse:Write denied this tool» e
  basta: chi non sa cosa ha sbagliato può solo riprovare alla cieca, e ogni
  falso positivo diventa irrecuperabile.

Il banco verifica che il campo **venga emesso**; che poi Claude Code lo **legga**
è stato provato a parte, dal vivo (2026-09-11): scrivendo in `src/domain/` un
file con un `import sys` inutilizzato, il rapporto di ruff è arrivato dentro il
contesto del modello — `F401`, con riga e suggerimento — invece di finire nel
transcript come prima.

Le prove sulle migrazioni girano in un albero temporaneo che imita il repo, mai
dentro `services/api/migrations/`: un `.sql` di prova lasciato lì verrebbe
eseguito al prossimo avvio — cioè esattamente il guasto che quell'hook esiste
per impedire.

## Rilevazione del 2026-09-09 — run `34321516325`

`163 passed in 7.60s` · `TOTAL 1876 497 74%` — il totale esatto è **73,51%**,
ed è quello che `fail_under` confronta: la tabella arrotonda, il gate no.

I numeri per modulo di questa sezione vengono da quella run. **Sono datati di
proposito e non sono gatati**: gatare una percentuale per modulo farebbe fallire
ogni PR che la sposta di mezzo punto, e un gate che fa rumore viene disattivato.

| Modulo | Coverage |
|---|---:|
| `domain/models.py`, `ports.py`, `chat.py`, `firma_foto.py`, `segnalazioni.py` | 100% |
| `domain/stylist.py`, `domain/vision.py` | 98% |
| `domain/wardrobe.py` | 95% |
| `domain/autenticazione.py` | 93% |
| `domain/errors.py` | 90% |
| `handlers/chat.py`, `foto.py`, `health.py`, `segnalazioni.py`, `suggerimenti.py`, `_foto_capo.py` | 100% |
| `handlers/auth.py` | 97% |
| `handlers/_http.py`, `outfit.py` | 92% |
| `handlers/capi.py`, `analisi.py` | 90-91% |
| `handlers/profilo.py` | 81% |
| `handlers/_container.py` | 79% |
| `adapters/memory.py` | 97% |
| `adapters/llm/*` | 38-64% |
| `adapters/postgres.py`, `filesystem.py`, `scontorno/fal_provider.py`, `handlers/local_server.py` | **0%** |
