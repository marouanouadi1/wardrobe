# Standard Python — backend `services/api`

Lo legge: `api`, `test`, e `reviewer` quando il diff tocca `services/api/`.
Se il task tocca `services/api/migrations/`, leggi **anche**
`.claude/rules/migrazioni.md`: quelle regole hanno conseguenze irreversibili.


## Prima di aggirare un problema, chiedi se puoi toglierlo

> Se togliessi la mia soluzione, il problema tornerebbe? Se sì, è un **tampone**:
> la causa è ancora dove era.

Un tampone è legittimo quando la causa non si può togliere adesso — ma allora si
**dichiara** dov'è, si apre la voce del rimedio in `docs/DA_FARE.md`, e quando il
rimedio arriva **il tampone si toglie**.

Il segnale che distingue i due casi: **il rimedio toglie righe, il tampone ne
aggiunge.**

Per esteso, con l'esempio, in `CLAUDE.md` e in `docs/adr/0008`.

## L'invariante

**Il dominio non sa cosa sia un 404, una connessione o una chiave API.** Se il
codice che stai scrivendo lo sa, non va in `src/domain/`.

Non è una convenzione scritta in un README: `services/api/pyproject.toml` vieta
gli import di `psycopg` e `httpx` (regola `TID251`,
`[tool.ruff.lint.flake8-tidy-imports.banned-api]`) e il lint fallisce. Il divieto
è globale e viene *revocato* per path in `[tool.ruff.lint.per-file-ignores]`:
`src/adapters/**`, `tests/**`, `scripts/**`. Quindi morde in `src/domain/` **e in
`src/handlers/`**, che non è esonerata.

Ciò che il divieto **non** copre, e va saputo: `anthropic`, `bcrypt` e `pyjwt`
non sono in lista. Sono dipendenze pure senza I/O, e stanno legittimamente nel
dominio — `src/domain/autenticazione.py` lo fa e lo dichiara.

## I tre livelli

| Cartella | Cosa ci va | Cosa non ci va |
|---|---|---|
| `src/domain/` | funzioni pure, modelli Pydantic, `Protocol`, errori di dominio | qualunque I/O; `datetime.now()` — l'ora si riceve come argomento |
| `src/adapters/` | Postgres, filesystem, provider LLM, scontorno | logica di dominio |
| `src/handlers/` | leggere l'evento, chiamare il dominio, formattare la risposta | logica di business: un handler che supera le poche righe sta prendendo una decisione che non gli spetta |

## Gli errori: il dominio dichiara, `@endpoint` traduce

Ogni errore è una sottoclasse di `ErroreDominio` (`src/domain/errors.py`) con due
attributi di classe: `codice` e `stato_http`. Il decoratore `@endpoint` in
`src/handlers/_http.py` è **l'unico punto dell'intero backend che legge
`stato_http`** e lo trasforma in uno status code.

Conseguenze operative:

- un errore nuovo = **una classe in `errors.py`**, zero modifiche agli handler
- prima di crearne uno, guarda: il codice giusto quasi sempre esiste già
- **mai** un `except` che traduce a mano un errore in HTTP dentro un handler
- il contratto verso il client è uno solo: `{"errore": <codice>, "messaggio": <testo>}`. L'app discrimina sul campo `errore`, mai sul testo
- il 500 non espone niente (`{"errore": "errore_interno"}`): **un 500 non è un canale di comunicazione**, i dettagli vanno nei log

## Le primitive condivise di `_http.py` — il motivo per cui gli handler sono corti

| Funzione | Serve a |
|---|---|
| `utente_id(evento)` | **L'unico punto di autenticazione.** Solo da JWT verificato. Senza token → `NonAutenticato` (401), distinto dal 422 perché il client possa rimandare al login invece di mostrare un errore generico |
| `corpo(evento, modello)` | valida il body contro un modello Pydantic; ogni `ValidationError` → `RichiestaNonValida` (422) |
| `parametro(evento, nome)` | path parameter obbligatorio |
| `ok(dati, stato)` | **l'unico costruttore di risposte**, usato anche per gli errori |

Non reimplementarle. Se ti serve qualcosa che somiglia a una di queste, quasi
sempre è già lì.

## Una porta nuova = quattro modifiche coordinate

`src/domain/ports.py` dichiara i `Protocol` (`ProviderLlm`, `ArchivioFoto`,
`ServizioScontorno`, `RepositoryArmadio`, `RepositoryUtenti`, `Orologio`,
`GeneratoreId`). Ognuno ha **due** implementazioni: una vera in `adapters/`, una
finta in `tests/fakes.py`.

Aggiungerne una richiede tutte e quattro:

1. il `Protocol` in `src/domain/ports.py`
2. l'implementazione vera in `src/adapters/`
3. quella finta in `services/api/tests/fakes.py`
4. la factory `@functools.cache` in `src/handlers/_container.py`

**Tre su quattro è un bug**, non un lavoro a metà: il test passerà sul finto e la
produzione userà un adapter che nessuno ha collegato.

`_container.py` è la **composition root**: l'unico posto che sceglie quale
adapter usare. Nota che `RepositoryPostgres` implementa *sia* `RepositoryArmadio`
*sia* `RepositoryUtenti`, e il container ne istanzia due, una per porta.

## Un endpoint nuovo si registra

Va aggiunto alla tabella `ROTTE` in `src/handlers/local_server.py:51`, come tupla
`(verbo, regex, handler)`. Senza quella riga l'endpoint **esiste ma non è
raggiungibile**: il codice è corretto, i test dell'handler passano, e in locale
risponde 404.

## Convenzioni di scrittura

- **Il dominio è in italiano**: classi, funzioni, variabili, tabelle. I termini di
  framework restano in inglese. È il motivo per cui `RUF001-003` e `N818` sono
  spenti in `pyproject.toml`: le eccezioni si chiamano `ErroreX`, non `XError`,
  e gli accenti nei literal sono voluti
- `mypy --strict` con `warn_unreachable` e il plugin Pydantic: nessun `Any` di
  comodo, nessun ramo morto
- ruff seleziona `E F I N UP B A C4 SIM RUF TID`, `line-length = 100`
- `src/domain/__init__.py` contiene la docstring che enuncia la regola: rileggila
  quando sei in dubbio su dove mettere qualcosa

## I test

Dettaglio in `docs/TEST_COVERAGE.md`. Qui la regola che riguarda chi scrive
codice: **un test che ha bisogno di una chiave, di un container o della rete non
sta testando il dominio — sta segnalando che la separazione `handlers`/`domain`
è stata violata.** È letteralmente il commento allo step Pytest di
`.github/workflows/api.yml`.

`tests/conftest.py` imposta `DEV_MODE=1` e un `JWT_SECRET` di test **prima** di
qualunque import degli handler, fissa `ADESSO`, ed espone `intestazioni_utente()`
che emette un **JWT vero**: non esiste più un bypass di autenticazione nei test.
La fixture autouse `_container_pulito` azzera le cache del container fra un test
e l'altro.

**Non si aggiusta un test cambiando l'asserzione finché passa.** Se il test aveva
ragione, il codice ha torto.

## Verifica prima di chiudere

```bash
npm run api:lint     # ruff check + ruff format --check + mypy --strict
npm run api:test     # offline, senza container
npm run api:cov      # con la coverage e le soglie
```
