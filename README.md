# Wardrobe — armadio digitale

Fotografi i vestiti una volta sola. Un modello di visione legge categoria,
colore, tessuto, stagione e lavaggio. Poi ogni mattina l'app propone cosa
mettere, con quello che hai già in casa, e te lo fa vedere addosso a un avatar.

Due funzioni portano il prodotto:

- **il suggeritore** — un modello che propone outfit usando *solo* i capi che hai,
  con il contesto della giornata (meteo, agenda, cosa è in lavatrice, cosa hai
  messo ieri);
- **l'avatar** — il tuo corpo in 3D che indossa i tuoi capi, girabile col dito.

Dove va l'avatar, e non è dove è oggi: **la foto del capo viene scontornata da un
modello, dal ritaglio nasce una geometria, e la foto stessa diventa la texture del
capo in 3D.** Nessun vestito prefabbricato a cui si cambia la tinta. E il corpo
che lo indossa è fedele alla persona, non un manichino anonimo — con quale
strumento si ottenga è ancora aperto.

Quello che gira adesso è il primo passo: un manichino a primitive tinte con il
**colore dominante** letto dalla foto, con un ripiego 2D che funziona su qualunque
telefono. È anche il motivo per cui `domain/vision.py` pretende `colore.hex` e
rifiuta il capo se non lo riconosce — un vincolo che vale per ora, non per scelta.
Il perché sta in [`docs/adr/0004`](docs/adr/0004-l-avatar-veste-le-foto-non-i-colori.md).

## Struttura

```txt
apps/
  mobile/            app Expo (iOS, Android, web)
  web/               vuoto, ma il posto c'è
services/api/
  src/domain/        logica pura: zero SDK, testabile con pytest
  src/handlers/      adapter sottili: evento -> domain -> risposta
  src/adapters/      postgres, filesystem, provider LLM
packages/contracts/  tipi TypeScript generati dai modelli Pydantic
docs/adr/            le decisioni che valeva la pena scrivere
```

### Le quattro scelte che tengono su tutto

**1. `handlers/` separato da `domain/`.** Un handler fa tre righe: legge
l'evento, chiama una funzione pura, formatta la risposta. Tutta la logica sta in
`domain`, che gira con pytest senza rete, senza container e senza mock della SDK.
Il vincolo non è una convenzione scritta in un README:
`pyproject.toml` vieta gli import di `psycopg` e `httpx` fuori da
`adapters/`, e il lint fallisce se qualcuno prova.

**2. I contratti sono generati, non copiati.** I modelli Pydantic in
`services/api/src/domain/models.py` sono la fonte di verità. Uno script esporta
il JSON Schema, da quello nascono i tipi TypeScript in `packages/contracts`.
Rinominare un campo nel backend senza rigenerare fa fallire la CI; rigenerarlo fa
fallire `tsc` dell'app esattamente nei punti da aggiornare. Anche le **soglie**
sono generate: `SOGLIA_INCERTEZZA` vive nel dominio Python e l'app la importa,
invece di riscrivere `86` in TypeScript.

**3. CI con filtri sui path.** Ogni workflow ha `on: push: paths:`, così un
commit su `apps/mobile` non fa girare lint e test del backend. È anche il
motivo per cui questo monorepo non ha bisogno di Nx o Turborepo: due workflow
indipendenti e due gestori di pacchetti (npm per TypeScript, uv per Python)
che convivono senza mediatori.

**4. `docs/adr/`.** Le decisioni scritte in breve — contesto, decisione,
alternative scartate — quando valeva la pena farlo. Oggi: l'avatar che veste le
foto e non i colori (0004), le versioni che vengono dai commit (0005), lo storico
della chat (0006).

## Partire

Serve sempre il backend: non esiste più una modalità demo con dati finti.

```bash
npm install
npm run api:sync     # dipendenze Python (uv) — una volta sola
npm run dev          # Postgres + API su http://localhost:8787
npm run mobile       # in un secondo terminale: l'app Expo
```

`npm run dev` aspetta che Postgres risponda davvero (l'healthcheck di
`docker-compose.yml`) prima di avviare l'API, e si ferma con un messaggio
chiaro se Docker Desktop è spento o se la porta 8787 è già occupata. Con
**`npm run dev:app`** parte anche l'app nello stesso terminale: le righe
dell'API sono marcate `[api]` e i tasti di Expo continuano a funzionare,
perché il terminale resta suo. Ctrl-C ferma API e app; **Postgres resta
acceso** — `npm run db:down` per spegnerlo. I pezzi restano usabili da soli:
`npm run db:up` + `npm run api:local`.

Nel `.env` di `services/api` (copiato da `.env.example`) servono
`ANTHROPIC_API_KEY`, `JWT_SECRET` (firma i JWT di login — una stringa lunga e
casuale, es. `openssl rand -hex 32`) ed `EMAIL_AMMESSE` (le email a cui è
permesso registrarsi: senza, la registrazione è chiusa a chiunque, di
proposito). `DATABASE_URL` e `CARTELLA_FOTO` sono già impostate nel `.env`
d'esempio del progetto: sono la modalità normale, con i capi in Postgres e le
foto su disco. Commentandole si torna alla memoria volatile, che non
sopravvive al riavvio — e parte vuota: non c'è più un armadio finto a
riempirla.

Il primo account si crea dall'app stessa: **Registrati**, con un'email nella
lista di `EMAIL_AMMESSE`.

L'app trova da sola l'indirizzo dell'API: su Expo Go o dev client usa lo
stesso host a cui si è già collegata per il bundle JS (lo stesso IP del QR
code); su `mobile:web` usa l'host con cui il browser ha raggiunto la pagina
(`window.location.hostname`). In entrambi i casi assume che l'API giri sulla
stessa macchina — il caso comune in sviluppo. `EXPO_PUBLIC_API_URL` resta per
sovrascriverlo esplicitamente (un server remoto, tipico di una build EAS
puntata sul VPS di produzione, o quando l'euristica indovina l'host sbagliato).

Il pulsante «Segnala un problema» nel Profilo (modulo di feedback di Sentry)
compare solo se `EXPO_PUBLIC_SENTRY_DSN` è impostata: copia
[`apps/mobile/.env.example`](apps/mobile/.env.example) in `.env.local` per
provarlo con `npm run mobile`. Senza, l'app funziona lo stesso e il pulsante
resta nascosto. Chi segnala non ha accesso a Sentry per vedere che fine ha
fatto: ogni invio riuscito lascia anche una copia nel backend, visibile da
«Profilo → Le mie segnalazioni» con il suo stato (Ricevuta/In
lavorazione/Risolta). Chi è nell'allowlist `EMAIL_AMMINISTRATORI` (email
separate da virgole, vuota di default — nessun amministratore) vede lì le
segnalazioni di tutti, non solo le proprie, e può cambiarne lo stato.

`api:local` (`services/api/src/handlers/local_server.py`) è lo stesso
processo che gira in produzione dentro il container `api` su un VPS: nessuna
differenza fra i due, nessuna deviazione da tenere a mente. La pipeline di
analisi (`handlers/analisi.py`) esegue le sue due fasi in linea nello stesso
processo, ovunque giri.

Per provare anche gli altri provider, oltre alle chiavi nel `.env`:

```bash
OPENAI_API_KEY=...           # opzionali
GOOGLE_API_KEY=...
```

il provider e il modello dei due lavori veri (analisi della foto, suggerimenti e chat) si
scelgono da ambiente — `PROVIDER_VISIONE`/`MODELLO_VISIONE` per l'analisi,
`PROVIDER_STILISTA`/`MODELLO_STILISTA` per suggerimenti e chat, entrambe opzionali
(il default è Anthropic col primo modello del suo catalogo). Aggiungere un provider è
un file in `adapters/llm/` più una riga nel registro, e nessuna schermata cambia.

### Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Postgres + API, con un comando solo |
| `npm run dev:app` | come sopra, più l'app Expo |
| `npm run mobile` | avvia l'app Expo |
| `npm run mobile:web` | l'app nel browser |
| `npm run api:local` | solo l'API (Postgres già acceso) |
| `npm run api:test` | i test del dominio e degli handler |
| `npm run api:cov` | gli stessi, con la coverage e le soglie della CI |
| `npm run api:lint` | ruff + ruff format + mypy strict |
| `npm run contracts:generate` | rigenera i tipi TypeScript dal backend |
| `npm run contracts:check` | verifica che siano allineati (gira in CI) |
| `npm run mobile:test` | i test dell'app |
| `npm run typecheck` | tsc su app e contratti |
| `npm run db:up` | solo Postgres in Docker |
| `npm run db:down` | spegne Postgres |
| `npm run db:migrate` | riapplica lo schema (serve solo su un volume vecchio) |

## Produzione

Un VPS, un dominio, tre container Docker (`postgres`, `api`, `caddy` per
l'HTTPS). Il runbook completo — come ci arriva il codice (il repo è privato,
niente `git clone` sul server), i due `.env` da scrivere a mano, avvio,
migrazioni e le scelte deliberate (Postgres non raggiungibile da Internet) — è in
[`docs/deploy.md`](docs/deploy.md).

Ogni merge su `main` fa partire da sola la parte di rilascio che tocca: un
merge sul backend rideploya l'API sul VPS e verifica che `/salute` risponda con
la versione appena rilasciata, un merge sull'app builda un nuovo APK con EAS e
lo pubblica come GitHub Release.

Il numero di versione **non conta i merge**: il livello (major, minor, patch)
viene dedotto dai conventional commit dall'ultimo tag, e il titolo delle PR è
verificato in CI perché quella deduzione abbia qualcosa da leggere. Il perché
sta in [`docs/adr/0005`](docs/adr/0005-le-versioni-vengono-dai-commit.md), i
dettagli operativi in [`docs/deploy.md`](docs/deploy.md) e nei workflow
`.github/workflows/{api,mobile,pr-title}.yml`.

## Stato

Il README non dice cosa è finito: mente appena qualcosa cambia, e l'ha già fatto
— questo file ha contenuto per settimane tre conteggi diversi dello stesso numero
di test. Lo stato vive altrove, in un posto solo per ogni cosa:

- **Cosa è implementato, e come è stato verificato** →
  [`docs/PROGRESS.md`](docs/PROGRESS.md)
- **Test e coverage, con i numeri veri** →
  [`docs/TEST_COVERAGE.md`](docs/TEST_COVERAGE.md)
- **Scelte rimandate su cose già costruite** →
  [`docs/QUESTIONI.md`](docs/QUESTIONI.md)
- **Ciò che la specifica non dice ancora** →
  [`docs/DOMANDE_APERTE.md`](docs/DOMANDE_APERTE.md)
- **Cosa è cambiato fra due versioni** → [`CHANGELOG.md`](CHANGELOG.md)
- **Perché una decisione è stata presa** → [`docs/adr/`](docs/adr/)

Sono collegamenti, non riassunti: un riassunto è una seconda copia, e la seconda
copia è esattamente il difetto che spostarli ha tolto.
