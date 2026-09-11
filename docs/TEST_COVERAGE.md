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
- **Test app:** 0
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

Il 74% totale è una media che nasconde la forma vera:

| Area | Coverage | Istruzioni |
|---|---:|---:|
| `src/domain/` | **97%** | 746, di cui 16 scoperte |
| `src/handlers/` | **73%** — **93%** senza `local_server.py` | 579, di cui 152 scoperte |
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

Zero test su 7.253 righe, al 2026-09-11.

Il primo lotto non insegue la copertura: prende la classe di difetti che `tsc`
non vede, cioè **il colore del testo contro il fondo che una primitiva dipinge
davvero**. È già costata una regressione reale (PR #4, «Fix invisible text on the
onboarding light button»).

| File | Cosa verifica |
|---|---|
| `test/ui/leggibilita.test.tsx` | il colore risolto di un testo dentro `Scheda`, `BottonePrimario` (nelle varianti), `Pillola`, `Segmenti`, `BottoneSecondario`, nei due ambienti di `Fondo` |
| `test/ui/fondo.test.tsx` | il meccanismo: `useFondo()` senza provider, ereditarietà, annidamento |
| `test/convenzioni/primitive.test.ts` | che nessuno ridipinga il fondo di una primitiva dal di fuori con `style={{ backgroundColor }}` — la forma esatta della regressione di PR #4 |

## Rilevazione del 2026-09-09 — run `34321516325`

`163 passed in 7.60s` · `TOTAL 1876 497 74%`

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
