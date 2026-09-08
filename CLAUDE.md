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
backend. La stessa regola vale per le liste di valori di un'enum: se ti serve l'elenco ordinato
di un `TipoCapo` o di uno `Stagione`, prendilo da `apps/mobile/src/dati/dominio.ts`
(`TIPI_CAPO`, `STAGIONI`) o da `VALORI_ATTRIBUTO_CAPO` in `@wardrobe/contracts` — non ridigitarlo:
due copie della stessa enum divergono in silenzio (è già successo, in una schermata interna poi
rimossa insieme al playground, prima che venisse allineata a `ETICHETTE.attributo`).

## Lo stato di una risorsa: `useRisorsa`, non `useState` a coppie

Il backend ha già l'astrazione che manca all'app: `services/api/src/handlers/_http.py` concentra
in un posto solo come si racconta un errore, ed è adottata dal 100% delle rotte. Sul frontend
l'equivalente è `apps/mobile/src/dati/risorsa.ts` — `useRisorsa(fetcher)` per una risorsa che si
carica da sola al montaggio, `useAzione()` per un'azione che aspetta un tocco (login, salvataggio).
Entrambe restituiscono `caricamento`/`errore` pronti per `<StatoRisorsa>` o `<Caricamento>`
(`src/ui/stati.tsx`). Non scrivere una nuova coppia `useState<boolean>` per caricamento ed errore
in una schermata: è esattamente la duplicazione che `useRisorsa` esiste per evitare, e un
`catch {}` vuoto — che ingoia l'errore perché la schermata non ha dove metterlo — è il segnale che
serviva questo hook fin dall'inizio.

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

## Design: i valori nei token, le forme nelle primitive

`apps/mobile/src/tema/tokens.ts` è la fonte di verità per colori, tipografia, spazi, ombre. La
regola scritta in cima al file vale come vincolo di prodotto: **`colori.ambra` (`#F5B324`)
compare solo dove parla il modello** — badge di match, «letto dalla foto» — mai su un'azione
dell'utente. Non introdurre nuovi colori hardcoded nelle schermate: se manca un
token, aggiungilo a `tokens.ts` (o componilo con `velo(colore, alfa)`, per una velatura), non
inline. `colori.citron` non esiste più — è stato sostituito dall'ambra perché troppo acceso, vedi
il commento in cima a `tokens.ts`.

La stessa regola vale un gradino sopra, per le forme: le primitive visive vivono in
`apps/mobile/src/ui/{base,stati,righe,guscio,capi,testo,avviso}.tsx`. Una schermata **compone**
quelle primitive, non ridefinisce una card, un bottone o un badge a mano — se manca una forma, si
aggiunge lì, non inline nella schermata. La violazione da riconoscere ha sempre questa forma: una
costante di colore locale in cima a una schermata (`const PELLE = '#E7DFD2'`, prima in
`app/(tabs)/avatar.tsx`), o un `View` con `backgroundColor: colori.scheda` e un `borderRadius`
scritto a mano invece di `<Scheda>`.

Le convenzioni di naming delle props, da rispettare in ogni primitiva nuova: `colore` è il primo
piano (testo, icona), `sfondo` è il fondo, `taglia` è il corpo del carattere, `misura` è la
dimensione di un'icona o di una bolla, `su` dice su che fondo un componente si posa
(`'chiaro' | 'scuro'`, mai un booleano `scuro`/`scura`: elimina l'accordo di genere che
costringerebbe a scriverlo due volte). **Un composto che avvolge testo (`Schermata`, `Vuoto`,
`RigaNavigabile`, `StatoRisorsa`…) inoltra `su` a ogni `Corpo`/`Forte`/`Etichetta`/`Titolo` al suo
interno** — ometterlo produce testo scuro su fondo scuro, un difetto che `tsc` non vede perché
`su` è opzionale.

## Test e verifica

- `npm run typecheck && npm run lint` — su tutti i workspace.
- `npm run api:test` — il dominio e gli handler, offline, senza container, in meno di un secondo.
- `npm run api:lint` — ruff check + format + `mypy --strict` sul backend.
- `npm run contracts:check` — da rilanciare dopo ogni modifica a `domain/models.py`.
- `npm run dev:app` — stack locale completo (Postgres via Docker + API + Expo) per provare un
  flusso a mano prima di considerarlo finito.
