# Test e coverage

## Come si legge questo file

**È l'unico posto del repo in cui è lecito scrivere un numero di test o una
percentuale di coverage.** Altrove si scrive «i test», non «213 test»: un numero
in prosa invecchia in silenzio, e questo repo ne ha già avuti tre diversi per lo
stesso fatto nello stesso file.

Due tipi di numero, e si comportano diversamente:

- **Numeri correnti** — il conteggio dei test e le soglie. Sono **verificati in
  CI** da `.github/workflows/docs.yml`: se divergono dal repo, la PR non passa.
- **Numeri misurati** — la coverage per modulo. Portano data e id della run: sono
  una fotografia, non una promessa. Si rimisurano quando si tocca questo file.

## Numeri correnti

- **Test backend:** 188
- **Test app:** 87
- **Soglia coverage totale:** 85% — `services/api/pyproject.toml`
- **Soglia coverage `src/domain/`:** 99% — `.github/workflows/api.yml`
- **Soglia coverage `src/handlers/`:** 97% — idem, escluso `local_server.py`
- **Asserzioni pgTAP sul database:** 103 — `supabase/tests/database/regole.test.sql`,
  sul branch `feat/supabase`. Il numero vero è il `plan()` del file, che pgTAP fa
  rispettare nel job `database`; `docs.yml` confronta questa riga con quel `plan()`

Le soglie sono un **cricchetto**: si alzano nella stessa PR che alza la coverage
vera, non si abbassano mai. Abbassarne una non è un commit: è una voce in
`docs/QUESTIONI.md`.

## Backend — cosa è coperto

Dalla fase 2 di ADR 0010 il backend è solo l'IA, l'esportazione e `/salute`: il
CRUD, il login e le foto firmate sono passati a Supabase, e con loro i test che
li provavano. Il calo del conteggio viene da lì, non da una copertura persa: le
stesse regole ora le provano le asserzioni pgTAP sul database.

| File | Test | Righe |
|---|---:|---:|
| `tests/domain/test_accesso.py` | 18 | 114 |
| `tests/domain/test_wardrobe.py` | 7 | 51 |
| `tests/domain/test_vision.py` | 25 | 196 |
| `tests/domain/test_stylist.py` | 23 | 184 |
| `tests/domain/test_chat.py` | 15 | 164 |
| `tests/domain/test_esportazione.py` | 7 | 71 |
| `tests/handlers/test_handlers.py` | 23 | 312 |
| `tests/handlers/test_analisi.py` | 13 | 250 |
| `tests/handlers/test_chat_handler.py` | 10 | 229 |
| `tests/handlers/test_suggerimenti.py` | 4 | 107 |
| `tests/adapters/test_supabase.py` | 37 | 502 |
| `tests/adapters/test_google_provider.py` | 6 | 63 |
| **Totale** | **188** | **2.243** |

Più `conftest.py` (174) e `fakes.py` (235), che non contengono test.

**L'accesso si prova con token veri.** `fakes.ChiaviFinte` genera una coppia
ES256 per la sessione di pytest, e `conftest.intestazioni_utente()` firma con
quella i token che gli handler verificano: stessa libreria, stesse
rivendicazioni della produzione. `test_handlers.py` prova i modi noti di
spacciarsi per qualcun altro — HS256 con il `kid` giusto, `alg: none`, un altro
emittente, un altro pubblico, i ruoli `anon` e `service_role`, un accesso anonimo,
un `kid` sconosciuto — e il 503 quando le chiavi di Supabase non si raggiungono.

**L'adapter di Supabase si prova senza rete**, con `httpx.MockTransport`: si
guarda cosa chiede (l'indirizzo, il filtro `utente_id`, il token di chi chiama) e
come traduce le risposte. Che l'RLS faccia il suo lavoro non lo dice questo
file: lo dicono i test pgTAP.

**Ci sono dei `@pytest.mark.parametrize`** (`test_supabase.py`: gli errori di
PostgREST, i JWKS malformati): da qui il conteggio dei `def test_` non coincide più
con quello che pytest raccoglie. Il gate in `docs.yml` usa `pytest --collect-only` proprio per
questo giorno: il numero sopra è quello raccolto.

## Backend — cosa non lo è, e perché

| Area | Coverage | Istruzioni |
|---|---:|---:|
| `src/domain/` | **99%** (99,70) | 656, di cui 2 scoperte |
| `src/handlers/` | **81%** — **98%** (98,20) senza `local_server.py` | 338, di cui 65 scoperte |
| `src/adapters/` | **70%** | 467, di cui 141 scoperte |

**A zero:**

| File | Istruzioni | Cos'è |
|---|---:|---|
| `src/handlers/local_server.py` | 60 | la tabella `ROTTE` e il dispatch: il codice che serve ogni richiesta sul VPS |
| `src/adapters/scontorno/fal_provider.py` | 25 | lo scontorno via fal.ai |

I provider LLM stanno fra il 38% e il 64%: è coperta la costruzione del prompt,
non la chiamata. `adapters/supabase.py` è al 99%: restano fuori tre righe, la
creazione del pool vero e un errore di Supabase con un corpo che non è JSON.

**Non è un incidente: è la stessa separazione che il linter impone.** Il dominio è
puro e quindi testabile offline; gli adapter fanno I/O e non lo sono senza
container. Il commento allo step Pytest di `api.yml` lo dice al contrario: *«se un
test qui ha bisogno di credenziali, la separazione handlers/domain è stata
violata»*.

Per questo **non c'è una soglia su `adapters/`**: imporla spingerebbe verso mock
della SDK, cioè verso il contrario di quello che quella separazione ottiene. Il
70% si dichiara qui, fra i debiti, che è il posto giusto per un numero che non si
vuole difendere.

**Quello che nessun job prova, e va saputo: gli adapter contro un Supabase vero.**
`test_supabase.py` guarda le richieste, pgTAP guarda il database, ma che una riga
scritta da `riga_da_capo` passi i CHECK della tabella vera lo ha provato solo un
E2E a mano sullo stack locale (due utenti, `docs/PROGRESS.md`). Il
rimedio è `T-18` in `docs/DA_FARE.md`.

## App — cosa è coperto

Il primo lotto non insegue la copertura: prende la classe di difetti che `tsc`
non vede, cioè **il colore del testo contro il fondo che una primitiva dipinge
davvero**. È già costata una regressione reale (PR #4, «Fix invisible text on the
onboarding light button»).

| File | Test | Cosa verifica |
|---|---:|---|
| `test/ui/leggibilita.test.tsx` | 18 | il colore risolto di un testo dentro `Scheda` (compresa la variante **`vetro`**), `BottonePrimario` (nelle cinque varianti, inclusa la combinazione `pericolo + disabilitato` e la nuova `accento`), `Pillola` (attiva e no, nei due ambienti), `Segmenti`, `BottoneSecondario`, e **`Foglio`**: che la sua scheda asserisca il proprio fondo chiaro sotto il velo scuro, e che il «perché» di una voce spenta stia a `tenue` e non al tono dell'interfaccia inattiva. E **`RigaImpostazione`**, che non dipinge nulla ma compone tre colori a mano: che li prenda dal fondo ereditato invece che da `chiaro` fisso |
| `test/ui/fondo.test.tsx` | 5 | il meccanismo: `useFondo()` senza provider, ereditarietà, annidamento a tre livelli |
| `test/convenzioni/primitive.test.ts` | 4 | che nessuno ridipinga il fondo di una primitiva dal di fuori: né con `style={{ backgroundColor }}` — la forma esatta della regressione di PR #4 — né passando `sfondo` senza dire con `su` su che fondo ci si posa |
| `test/convenzioni/griglie.test.ts` | 15 | che una riga di griglia **ci stia**: tre tessere d'armadio e sette celle di mese, dalla larghezza di 320pt a quella di 480, dentro la larghezza utile di `Schermata`. In React Native `flexShrink` vale 0, quindi una cella che non entra non si stringe: va a capo, senza errori né avvisi. `griglie.mese` chiedeva `7 × 13.1% + 6 × 6px`, che entra solo in uno schermo da 478pt — il calendario mostrava sei giorni per riga su ogni telefono |
| `test/dati/righe.test.ts` | 13 | le traduzioni fra righe del database e modelli dell'app (`src/dati/righe.ts`, fase 3 di ADR 0010): niente si perde andando e tornando, un aggiornamento non manda lo `slot` che il database calcola da sé, una correzione aggiunge l'attributo a quelli visti a mano senza doppioni, togliere le misure azzera le sei colonne, il giorno è quello locale e non quello di Greenwich |
| `test/dati/dominio.test.ts` | 5 | i capi dormienti, che da quando l'app legge l'armadio da sé calcola solo lei: `mesiFa` resta su un giorno che esiste (dal 31 agosto, il 28 febbraio, non il 3 marzo di `Date.setMonth`), e il giorno di partenza è quello di Roma anche quando a Greenwich è ancora ieri. Visti fallire tutti e due i difetti rimessi nel codice |
| `test/dati/misure.test.ts` | 10 | l'aritmetica fra centimetri e pollici. Due difetti che `tsc` non vede: un giro che non torna (digiti `66″`, riapri e leggi `65″`), e un campo che accetta ciò che il server rifiuta — il minimo di 120 cm è 47,24″, e arrotondarlo per difetto farebbe passare `47` che diventa 119 cm. `limitiIn` arrotonda il minimo per eccesso e il massimo per difetto, e il test lo verifica in entrambi i versi: nessun valore ammesso esce dai limiti veri, e subito fuori si esce davvero |
| `test/convenzioni/navigazione.test.ts` | 15 | dove la barra delle schede si vede e quale scheda accende. Da quando vive fuori dal navigatore (`ui/guscio.tsx`) è disegnata sopra qualunque schermata, quindi l'errore peggiore non è cosmetico: la pillola comparirebbe **sulla schermata di accesso**, cinque scorciatoie verso rotte protette da un `Redirect`. Il test tiene fermo che `schedaDi()` resti un elenco di ciò che c'è e non di ciò che si esclude, e che nessuna rotta nuova resti senza una decisione |
| `test/convenzioni/colori.test.ts` | 2 | che nessun `rgba()`/esadecimale sia scritto a mano in `app/` o `src/` — i valori vengono da `tema/tokens.ts` o si compongono con `velo()`. `src/tema/tokens.ts` (la fonte) e `src/dati/dominio.ts` (`PALETTE_COLORI`, dati di dominio) sono le due esenzioni dichiarate |

**Il fuso è fissato a Roma** (`test/fuso-orario.js`, `globalSetup` di jest): la CI gira
in UTC, e lì un test sul «giorno locale» passerebbe anche con `toISOString()`, che è il
difetto da prendere. Un test che dipende dall'ora usa un'ora vicina alla mezzanotte, dove
i due giorni divergono davvero.

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
- **Una sola copia di React, e non serve più forzarla in jest.** Il monorepo ne
  aveva due, e **le aveva già prima di questi test**: 19.2.3 in `apps/mobile`
  (versione esatta, pinnata da Expo) e 19.2.8 in root, dove decine di pacchetti
  hoisted — `@expo/*`, `@radix-ui/*` — chiedevano `react` come peerDependency
  con `*` senza che la root ne dichiarasse una, e npm sceglieva l'ultima
  pubblicata.
  Le due copie convivevano in pace finché nessuno faceva rendering React dalla
  root. Introdurre `react-test-renderer` (che jest-expo e RTL richiedono) lo ha
  reso osservabile: quello vedeva il React di root, i sorgenti dell'app il
  proprio, e due React davano un dispatcher nullo — `useContext` su `null` al
  primo hook. Un `moduleNameMapper` in `jest` tamponava il sintomo solo dentro i
  test. **Chiuso in `T-23` (`docs/DA_FARE.md`)**: `react` e `react-dom` sono
  dichiarati anche in root, le peer `*` si accontentano di quelli, resta una
  copia sola in tutto l'albero — verificato con `npm ls react react-dom` su
  un'installazione pulita — e il mapper è stato tolto.

In `@testing-library/react-native` 14 **`render` restituisce una Promise**: i
test sono `async` e fanno `await render(...)`. Senza `await` le query non
esistono ancora e l'errore che si legge è `getByText is not a function`.

## Rilevazione del 2026-09-27 — in locale, `feat/supabase-fase-3`

`188 passed` · `TOTAL 1461 208 86%` — il totale esatto è **85,76%**, ed è quello
che `fail_under` confronta: la tabella arrotonda, il gate no. Misurata in locale,
prima della PR: la run della CI la sostituirà qui.

Le soglie sono salite con questa misura, come vuole il cricchetto: il totale da 73
a 85, `domain/` da 97 a 99, `handlers/` da 92 a 97 — ognuna un punto sotto il
rilevato arrotondato. La fase 3 ha tolto da `models.py` i modelli delle rotte che non ci sono più: il dominio ha meno istruzioni, la stessa copertura.

I numeri per modulo di questa sezione vengono da quella misura. **Sono datati di
proposito e non sono gatati**: gatare una percentuale per modulo farebbe fallire
ogni PR che la sposta di mezzo punto, e un gate che fa rumore viene disattivato.

| Modulo | Coverage |
|---|---:|
| `domain/accesso.py`, `chat.py`, `errors.py`, `esportazione.py`, `models.py`, `ports.py`, `wardrobe.py` | 100% |
| `domain/stylist.py`, `domain/vision.py` | 98% |
| `handlers/analisi.py`, `chat.py`, `esportazione.py`, `health.py`, `suggerimenti.py` | 100% |
| `handlers/_http.py` | 98% |
| `handlers/_container.py` | 91% |
| `adapters/supabase.py` | 99% |
| `adapters/llm/*` | 38-64% |
| `adapters/scontorno/fal_provider.py`, `handlers/local_server.py` | **0%** |
