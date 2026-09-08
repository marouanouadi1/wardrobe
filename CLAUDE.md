# Istruzioni per Claude Code

Il README spiega il prodotto e l'architettura (`## Struttura`, `## Le quattro scelte che
tengono su tutto`) — leggilo prima. Qui solo le convenzioni che un agente sbaglierebbe senza
istruzioni esplicite.

## Lingua del dominio

Tutto il codice applicativo è in italiano: nomi di funzione, variabili, tabelle SQL, modelli
Pydantic, componenti React, messaggi di errore. È una scelta deliberata, non incoerenza — non
proporre di anglicizzare identificatori esistenti. Codice nuovo segue la stessa convenzione.
Le librerie esterne (`react`, `pydantic`, nomi di pacchetti npm/pip) restano ovviamente in
inglese, così come termini tecnici senza una resa italiana naturale.

## Backend: `domain/` è puro, `adapters/` fa I/O

`services/api/src/domain/` non deve mai importare `psycopg` o `httpx` — è un vincolo imposto
dal linter (`pyproject.toml`, `flake8-tidy-imports.banned-api`), non solo una convenzione: un
import vietato fa fallire `ruff check` in CI. Ogni logica che tocca database, HTTP o filesystem
va in `src/adapters/`. Gli `handlers/` restano sottili: leggono l'evento, chiamano una funzione
pura del dominio, formattano la risposta — mai logica di business dentro un handler.

## I contratti si generano, non si copiano

Se cambi un modello in `services/api/src/domain/models.py`, esegui subito
`npm run contracts:generate` e committa i file rigenerati sotto `packages/contracts/`. Non
scrivere mai a mano un tipo TypeScript che duplica un modello Pydantic, e non modificare a mano
i file sotto `packages/contracts/src/generated/` — vengono sovrascritti alla prossima
generazione. `npm run contracts:check` gira in CI e fallisce se il committato è disallineato dal
backend.

## Versioni: non toccarle a mano

`apps/mobile/app.json` (`expo.version`) e `services/api/pyproject.toml` (`version`) sono scritti
solo dalla pipeline di release (`scripts/bump-versione.mjs`), che deduce major/minor/patch dai
conventional commit dall'ultimo tag. Non alzare mai questi numeri in un commit manuale — vedi
`docs/adr/0005-le-versioni-vengono-dai-commit.md`.

## Commit: conventional commit obbligatorio

Il titolo di ogni PR deve rispettare
`^(feat|fix|chore|docs|refactor|test|perf|build|ci|revert)(\(...\))?!?: .+`
(`pr-title.yml` lo valida in CI e fallisce altrimenti). Il tipo del commit determina anche il
livello di bump: `feat:` alza il minor, un `!` o `BREAKING CHANGE` alza il major.

## Rilascio mobile e API: due pipeline indipendenti

`api.yml` e `mobile.yml` hanno filtri `paths:` distinti e possono scattare entrambi sulla stessa
PR (es. quando tocchi `packages/contracts/**`). Entrambi i job di release fanno rebase+retry
attorno al push su `main` per gestire questo caso — non serve un gruppo di concorrenza
condiviso, e aggiungerne uno con `cancel-in-progress` romperebbe di nuovo tutto (una release
cancellerebbe l'altra invece di metterla in coda).

## Il playground e i suoi endpoint `/dev/*`

`docker-compose.yml` controlla `PLAYGROUND_ABILITATO` sul VPS. Se è `"1"`, gli endpoint
`GET /dev/*` in `services/api/src/handlers/playground.py` rispondono **senza richiedere un
token**: è pensato per un giro di test ristretto, non per un'app aperta a chiunque. Prima di
allargare la platea di utenti, verificare che sia tornato a `"0"`.

## Design: il citron è solo dell'IA

`apps/mobile/src/tema/tokens.ts` è la fonte di verità per colori, tipografia, spazi, ombre. La
regola scritta in cima al file vale come vincolo di prodotto: `colori.citron` (`#D7F45C`)
compare solo dove parla il modello — badge di match, «letto dalla foto», esiti del playground —
mai su un'azione dell'utente. Non introdurre nuovi colori hardcoded nelle schermate: se manca un
token, aggiungilo a `tokens.ts`, non inline.

## Test e verifica

- `npm run typecheck && npm run lint` — su tutti i workspace.
- `npm run api:test` — 214 test, offline, senza container, in meno di un secondo.
- `npm run api:lint` — ruff check + format + `mypy --strict` sul backend.
- `npm run contracts:check` — da rilanciare dopo ogni modifica a `domain/models.py`.
- `npm run dev:app` — stack locale completo (Postgres via Docker + API + Expo) per provare un
  flusso a mano prima di considerarlo finito.

## Strumenti fuori dal codice spedito

`tools/avatar-3d/` contiene gli script Python (`genera_capi.py`, `vesti_da_foto.py`,
`comune.py`) che producono gli asset 3D sotto `apps/mobile/assets/3d/`. Non fanno parte
dell'app: sono un toolchain offline, documentato in `apps/mobile/app/dev/prova-3d.tsx`, da
rilanciare solo quando quegli asset cambiano.
