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
modello e diventa la texture del capo in 3D, pixel per pixel.** La forma può
nascere dal ritaglio o da un template della sua famiglia; la stoffa, le stampe e
le scritte vengono sempre dalla foto. Nessun vestito a cui si cambia la tinta. Il
corpo che lo indossa può regolarsi su livelli scelti da noi — altezza, spalle,
proporzioni — o somigliare alla persona partendo da una sua foto. Il corpo base
è quello di MakeHuman ([`docs/adr/0012`](docs/adr/0012-il-corpo-dell-avatar-nasce-in-mpfb2.md)):
l'app lo calcola da sé, dai dati grezzi di MPFB2, e lo disegna con `three`
([`docs/adr/0013`](docs/adr/0013-il-corpo-si-calcola-nell-app.md)); se avrà la sua
faccia è ancora aperto.

Quello che gira adesso è **il corpo, non ancora vestito**: nella scheda «Come mi
sta» l'avatar di MakeHuman si regola su una dozzina di cursori a cinque livelli,
prende l'altezza dalle misure, e porta uno strato neutro grigio al posto dei capi;
l'outfit scelto si legge accanto. La sagoma 2D tinta con il colore dominante che
c'era prima non c'è più. Il perché di questa strada sta in
[`docs/adr/0004`](docs/adr/0004-l-avatar-veste-le-foto-non-i-colori.md) e in
[`docs/adr/0011`](docs/adr/0011-il-corpo-a-manopole-e-i-capi-da-template-tornano-possibili.md).

## Struttura

```txt
apps/
  mobile/            app Expo (iOS, Android, web): legge e scrive i dati su Supabase
  web/               vuoto, ma il posto c'è
services/api/        il backend dell'IA: analisi delle foto, suggerimenti, chat, esportazione
  src/domain/        logica pura: zero SDK, testabile con pytest
  src/handlers/      adapter sottili: evento -> domain -> risposta
  src/adapters/      Supabase, provider LLM, scontorno
supabase/            schema e policy (migrations/), test pgTAP, configurazione dello stack locale
packages/contracts/  tipi TypeScript generati: dai modelli Pydantic e dallo schema SQL
tools/avatar/        i pacchetti del corpo dell'avatar, presi dai dati di MakeHuman (MPFB2)
docs/adr/            le decisioni che valeva la pena scrivere
```

Database, login e foto stanno su **Supabase**
([`docs/adr/0010`](docs/adr/0010-supabase-database-login-e-foto.md)). L'app ci
legge e scrive da sé, e chi vede cosa lo decidono le policy RLS del database, non
il codice di un client. Il backend Python resta per l'IA e **agisce come
l'utente**, con il suo token: sul server non c'è nessuna chiave che scavalchi
l'RLS.

### Le quattro scelte che tengono su tutto

**1. `handlers/` separato da `domain/`.** Vale per il backend dell'IA. Un handler
fa tre righe: legge l'evento, chiama una funzione pura, formatta la risposta.
Tutta la logica sta in `domain`, che gira con pytest senza rete, senza container
e senza mock della SDK. Il vincolo non è una convenzione scritta in un README:
`pyproject.toml` vieta gli import di `psycopg` e `httpx` fuori da `adapters/`, e
il lint fallisce se qualcuno prova.

**2. I contratti sono generati, non copiati.** Le fonti sono due, ognuna col suo
confine. Per ciò che attraversa il backend dell'IA la fonte sono i modelli
Pydantic in `services/api/src/domain/models.py`: uno script esporta il JSON
Schema, e da quello nascono i tipi TypeScript in `packages/contracts`. Per i dati
salvati la fonte è lo schema SQL di `supabase/migrations/`, e i tipi li genera
`supabase gen types`. Rinominare un campo senza rigenerare fa fallire la CI;
rigenerarlo fa fallire `tsc` dell'app esattamente nei punti da aggiornare. Anche
le **soglie** sono generate: `SOGLIA_INCERTEZZA` vive nel dominio Python e l'app
la importa, invece di riscrivere `86` in TypeScript. Le enum e i limiti che
esistono in entrambe le fonti li confronta un job della CI.

**3. CI con filtri sui path.** `api.yml`, `mobile.yml` e `database.yml` hanno
`on: push: paths:`, così un commit su `apps/mobile` non fa girare lint e test del
backend. I gate che valgono per tutto il repo — il titolo delle PR
(`pr-title.yml`) e i numeri dichiarati nelle docs (`docs.yml`) — non hanno
filtri, di proposito: una PR di sole docs non farebbe partire gli altri. È anche
il motivo per cui questo monorepo non ha bisogno di Nx o Turborepo: workflow
indipendenti e due gestori di pacchetti (npm per TypeScript, uv per Python) che
convivono senza mediatori.

**4. `docs/adr/`.** Le decisioni scritte in breve — contesto, decisione,
alternative scartate — quando valeva la pena farlo. L'elenco è la cartella
stessa: [`docs/adr/`](docs/adr/).

## Partire

Servono lo stack locale di Supabase e il backend dell'IA: non esiste una
modalità demo con dati finti. Sul computer vanno installati Node (la versione di
`.nvmrc`), [uv](https://docs.astral.sh/uv/), la
[CLI di Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started)
alla stessa versione della CI (`.github/workflows/database.yml`: un'altra
versione genera tipi diversi) e Docker, perché lo stack gira in container.

```bash
npm install
npm run api:sync     # dipendenze Python (uv) — una volta sola
npm run dev:app      # Supabase locale + API su http://localhost:8787 + l'app Expo
```

`npm run dev:app` accende lo stack di Supabase (il primo avvio scarica le
immagini e può metterci minuti), passa all'API l'indirizzo e la chiave pubblica
letti da `supabase status` (all'app solo la chiave: l'indirizzo lo ricava da
sé, come si dice qui sotto), e lascia Expo in primo piano: le righe dell'API
sono marcate `[api]` e i tasti di Expo continuano a funzionare, perché il
terminale resta suo. Si ferma con un messaggio chiaro se manca `uv`, la CLI o
Docker, o se la porta 8787 è già occupata. Ctrl-C ferma API e app; **Supabase
resta acceso** — `npm run supabase:stop` per spegnerlo. `npm run dev` fa lo
stesso senza l'app. I pezzi restano usabili da soli, ma allora le chiavi vanno
scritte a mano: `npm run api:local` le legge dal `.env` di `services/api`,
`npm run mobile` da `apps/mobile/.env.local`.

Nel `.env` di `services/api` (copiato da
[`.env.example`](services/api/.env.example)) l'unica chiave da scrivere per
partire è `ANTHROPIC_API_KEY`; le altre sono facoltative, e il file dice cosa fa
ognuna. Lo schema viene da `supabase/migrations/`: `npm run supabase:reset` rifà
il database locale da zero, con le migrazioni e `supabase/seed.sql`. Lo Studio
dello stack è su http://127.0.0.1:54323.

Il primo account si crea dall'app stessa, con **Registrati**. La registrazione è
aperta solo a chi è invitato, anche in locale: il seed invita
`sviluppo@esempio.invalid`, e un'altra email si aggiunge alla tabella
`privato.inviti` dallo Studio. L'app chiede prima un codice mandato per email e
solo dopo la password; in locale le email arrivano a Mailpit, su
http://127.0.0.1:54324.

L'app trova da sola l'indirizzo dell'API e quello di Supabase: su Expo Go o dev
client usa lo stesso host a cui si è già collegata per il bundle JS (lo stesso
IP del QR code), sulla porta 8787 per l'API e 54321 per Supabase; su
`mobile:web` usa l'host con cui il browser ha raggiunto la pagina
(`window.location.hostname`). In entrambi i casi assume che tutto giri sulla
stessa macchina — il caso comune in sviluppo. `EXPO_PUBLIC_API_URL` ed
`EXPO_PUBLIC_SUPABASE_URL` restano per sovrascriverlo esplicitamente: è quello
che fanno le build EAS, che li ricevono da `apps/mobile/eas.json`, o quando
l'euristica indovina l'host sbagliato.

Due pulsanti dell'app dipendono da una variabile di
[`apps/mobile/.env.example`](apps/mobile/.env.example), da copiare in
`.env.local`. Senza, l'app funziona lo stesso:

- **«Continua con Google»** vuole `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; senza resta
  spento, e dice perché.
- **«Segnala un problema»** nel Profilo (il modulo di feedback di Sentry) vuole
  `EXPO_PUBLIC_SENTRY_DSN`; senza resta nascosto. Chi segnala non ha accesso a
  Sentry per vedere che fine ha fatto: ogni invio riuscito lascia anche una copia
  nel database, visibile da «Profilo → Le mie segnalazioni» con il suo stato
  (Ricevuta/In lavorazione/Risolta). Un account con `ruolo: "amministratore"` in
  `app_metadata` vede lì le segnalazioni di tutti, e può cambiarne lo stato. È un
  campo che l'utente non può scriversi da sé: lo assegna chi gestisce il progetto
  Supabase.

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
| `npm run dev` | Supabase locale + API, con un comando solo |
| `npm run dev:app` | come sopra, più l'app Expo |
| `npm run mobile` | avvia l'app Expo |
| `npm run mobile:web` | l'app nel browser |
| `npm run mobile:android` | l'app su Android |
| `npm run mobile:ios` | l'app su iOS |
| `npm run mobile:test` | i test dell'app |
| `npm run api:sync` | installa le dipendenze Python |
| `npm run api:local` | solo l'API (Supabase già acceso, chiavi nel `.env`) |
| `npm run api:test` | i test del dominio e degli handler |
| `npm run api:cov` | gli stessi, con la coverage e le soglie della CI |
| `npm run api:lint` | ruff + ruff format + mypy strict |
| `npm run contracts:generate` | rigenera i tipi TypeScript dai modelli Pydantic |
| `npm run contracts:check` | verifica che siano allineati (gira in CI) |
| `npm run supabase:start` | solo lo stack locale di Supabase |
| `npm run supabase:stop` | lo spegne |
| `npm run supabase:reset` | rifà il database locale da zero: migrazioni e seed |
| `npm run supabase:test` | i test pgTAP di policy e regole |
| `npm run supabase:verifica` | enum e limiti uguali fra database e Python |
| `npm run supabase:tipi` | rigenera i tipi TypeScript dallo schema |
| `npm run typecheck` | tsc su app e contratti |
| `npm run lint` | il lint dell'app |

## Produzione

Un VPS, un dominio, due container Docker (`api` e `caddy` per l'HTTPS), più il
progetto Supabase per database, login e foto. Il Postgres di prima resta sul VPS
solo come copia di riserva, ferma al giorno del passaggio: i commenti in testa a
`docker-compose.yml` dicono perché nessuno ne cancella i volumi. Il runbook del
server è in [`docs/deploy.md`](docs/deploy.md).

Ogni merge su `main` fa partire da sola la parte di rilascio che tocca: un
merge sul backend rideploya l'API sul VPS e verifica che `/salute` risponda con
la versione appena rilasciata, un merge sull'app ne alza versione e tag e prova
a buildare l'APK con EAS. **Per ora l'APK si costruisce in locale** e si
pubblica a mano come GitHub Release: la build in cloud ha una quota mensile che
finisce ([`docs/adr/0009`](docs/adr/0009-l-apk-si-costruisce-in-locale.md)).
**Lo schema invece non lo porta un merge**: sul progetto vero arriva con
`supabase db push`, a mano, e da lì una migrazione non si ritira più.

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
