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

- **Test backend:** 213
- **Test app:** 68
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
| `tests/domain/test_esportazione.py` | 23 | 171 |
| `tests/domain/test_firma_foto.py` | 5 | 39 |
| `tests/domain/test_segnalazioni.py` | 2 | 40 |
| `tests/handlers/test_handlers.py` | 59 | 810 |
| `tests/handlers/test_chat_handler.py` | 13 | 246 |
| `tests/handlers/test_analisi.py` | 4 | 125 |
| `tests/handlers/test_suggerimenti.py` | 2 | 88 |
| `tests/adapters/test_archivio_filesystem.py` | 7 | 87 |
| `tests/adapters/test_google_provider.py` | 6 | 63 |
| **Totale** | **213** | **2.369** |

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
| `src/adapters/postgres.py` | 123 | **il percorso dati che gira in produzione.** Tutti i 213 test girano su `ArchivioInMemoria` (97%) |
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
| `test/ui/leggibilita.test.tsx` | 18 | il colore risolto di un testo dentro `Scheda` (compresa la variante **`vetro`**), `BottonePrimario` (nelle cinque varianti, inclusa la combinazione `pericolo + disabilitato` e la nuova `accento`), `Pillola` (attiva e no, nei due ambienti), `Segmenti`, `BottoneSecondario`, e **`Foglio`**: che la sua scheda asserisca il proprio fondo chiaro sotto il velo scuro, e che il «perché» di una voce spenta stia a `tenue` e non al tono dell'interfaccia inattiva. E **`RigaImpostazione`**, che non dipinge nulla ma compone tre colori a mano: che li prenda dal fondo ereditato invece che da `chiaro` fisso |
| `test/ui/fondo.test.tsx` | 5 | il meccanismo: `useFondo()` senza provider, ereditarietà, annidamento a tre livelli |
| `test/convenzioni/primitive.test.ts` | 4 | che nessuno ridipinga il fondo di una primitiva dal di fuori: né con `style={{ backgroundColor }}` — la forma esatta della regressione di PR #4 — né passando `sfondo` senza dire con `su` su che fondo ci si posa |
| `test/convenzioni/griglie.test.ts` | 15 | che una riga di griglia **ci stia**: tre tessere d'armadio e sette celle di mese, dalla larghezza di 320pt a quella di 480, dentro la larghezza utile di `Schermata`. In React Native `flexShrink` vale 0, quindi una cella che non entra non si stringe: va a capo, senza errori né avvisi. `griglie.mese` chiedeva `7 × 13.1% + 6 × 6px`, che entra solo in uno schermo da 478pt — il calendario mostrava sei giorni per riga su ogni telefono |
| `test/dati/misure.test.ts` | 10 | l'aritmetica fra centimetri e pollici. Due difetti che `tsc` non vede: un giro che non torna (digiti `66″`, riapri e leggi `65″`), e un campo che accetta ciò che il server rifiuta — il minimo di 120 cm è 47,24″, e arrotondarlo per difetto farebbe passare `47` che diventa 119 cm. `limitiIn` arrotonda il minimo per eccesso e il massimo per difetto, e il test lo verifica in entrambi i versi: nessun valore ammesso esce dai limiti veri, e subito fuori si esce davvero |
| `test/convenzioni/navigazione.test.ts` | 14 | dove la barra delle schede si vede e quale scheda accende. Da quando vive fuori dal navigatore (`ui/guscio.tsx`) è disegnata sopra qualunque schermata, quindi l'errore peggiore non è cosmetico: la pillola comparirebbe **sulla schermata di accesso**, cinque scorciatoie verso rotte protette da un `Redirect`. Il test tiene fermo che `schedaDi()` resti un elenco di ciò che c'è e non di ciò che si esclude, e che nessuna rotta nuova resti senza una decisione |
| `test/convenzioni/colori.test.ts` | 2 | che nessun `rgba()`/esadecimale sia scritto a mano in `app/` o `src/` — i valori vengono da `tema/tokens.ts` o si compongono con `velo()`. `src/tema/tokens.ts` (la fonte) e `src/dati/dominio.ts` (`PALETTE_COLORI`, dati di dominio) sono le due esenzioni dichiarate |

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
