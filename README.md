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
  mobile/            app Expo (iOS, Android, web) — 15 schermate
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
`domain`, che gira con pytest senza rete, senza container e senza mock della SDK —
92 test in un secondo. Il vincolo non è una convenzione scritta in un README:
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
alternative scartate — quando valeva la pena farlo. Oggi ce n'è una: perché
l'avatar deve vestire fotografie e non colori.

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
| `npm run api:test` | 148 test del dominio e degli handler |
| `npm run api:lint` | ruff + ruff format + mypy strict |
| `npm run contracts:generate` | rigenera i tipi TypeScript dal backend |
| `npm run contracts:check` | verifica che siano allineati (gira in CI) |
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

### Verificato su questa macchina

- `npm run api:test` → **148 test passati**
- `npm run api:lint` → ruff pulito, **mypy strict** senza errori
- `npm run contracts:check` → contratti allineati; verificato anche il contrario,
  rinominando un campo nel backend per vedere la CI cadere
- `npm run typecheck` → pulito su app e contratti
- `expo export --platform web` → bundle **web** pulito, tasti Expo compresi
- `expo lint` → nessun problema
- API in locale interrogata con richieste vere: senza `EMAIL_AMMESSE` la
  registrazione risponde **403**; con l'email in lista, **POST
  /auth/registrati** restituisce un token e `/capi` con quel token risponde
  con un armadio vuoto (niente più semina finta); senza token, **401**;
  `/suggerimenti` risponde **503 provider_non_configurato** senza credenziali
  (non un 500), e `/capi/analisi` esegue la pipeline in linea riportando il
  motivo del fallimento

### Verificato sul VPS di produzione

- Deploy vero su Hetzner (Ubuntu 24.04, Docker), dominio vero
  (`ilmioarmadio.xyz`) e certificato Let's Encrypt emesso da Caddy al primo
  avvio — non solo un `Caddyfile` sintatticamente valido mai avviato
  davvero. Dettagli in [`docs/deploy.md`](docs/deploy.md).
- `GET /salute`, `POST /auth/registrati` e la firma delle URL delle foto
  (`BASE_URL_PUBBLICA`, verificato leggendo il campo `url` di **POST
  /foto/upload**: comincia per `https://api.ilmioarmadio.xyz`, non per un IP
  interno) provati con richieste vere contro il server pubblico, non solo in
  locale.

### Non verificato, e conta saperlo

**Login e registrazione non sono mai stati provati su un telefono vero.**
Verificati da riga di comando (curl) e dai test degli handler: la parte app
— `registrati.tsx`, `accedi.tsx`, il redirect di `index.tsx`, il guard delle
tab, il logout — ha solo passato `tsc` ed `expo lint`, non è mai stata
toccata con un dito. Il primo giro reale (`npm run mobile`) è anche la prima
prova del percorso completo: registrazione → armadio vuoto → primo capo
caricato.

**Nessun modello è mai stato interrogato.** Su questa macchina non c'erano
credenziali di nessun provider, quindi il suggeritore e l'analisi delle foto sono
stati provati solo fino al confine: prompt costruito, chiamata partita, errore
gestito. Il primo `ANTHROPIC_API_KEY` esportato è anche il primo vero collaudo
delle due feature di punta — aspettati di ritoccare i prompt in
`domain/vision.py` e `domain/stylist.py` dopo averli visti all'opera.

**L'avatar spedito è 2D, non 3D.** La scheda «Avatar» (`app/(tabs)/avatar.tsx`) disegna una
sagoma SVG tinta dai colori letti dalle foto dei capi — nessun WebGL, nessun confine d'errore da
attraversare: è il ripiego dichiarato dall'ADR 0004, non un fallback di un manichino 3D che non
è mai partito. Un manichino 3D che vestiva foto vere è esistito come strumento interno
(react-three-fiber, dietro «Profilo → Sviluppo → Prova 3D») ed è stato rimosso insieme al
playground: non era mai stato visto girare fuori da questa macchina, e nessun codice di quella
strada resta nel repo — solo gli script Python che generavano i suoi asset, in
`tools/avatar-3d/` prima che anche quelli venissero tolti.

**Dell'avatar vero c'è un primo pezzo, solo lato backend.**
`services/api/src/adapters/scontorno/fal_provider.py` scontorna la foto di un capo — un passo
facoltativo, vedi `handlers/analisi.py`. Non è ancora collegato a una ricostruzione 3D o a un
corpo fedele alla persona: la direzione dell'ADR 0004 resta scritta, non implementata per
intero. Quello che l'utente vede oggi è il manichino a primitive tinte, in 2D.

**Gli id dei modelli non-Anthropic vanno confermati.** Quelli di Claude vengono
dall'SDK ufficiale; `gpt-5.1` e `gemini-2.5-pro` sono i nomi indicati nel design e
sono sovrascrivibili da ambiente (`MODELLI_OPENAI`, `MODELLI_GOOGLE`). Anche i
loro prezzi restano fuori dal catalogo esposto al prodotto: nessun punto dell'app
li converte più in euro, da quando la vista che li mostrava è stata tolta insieme
al playground.

## Le domande che il design lascia aperte

Il file di design contiene una scheda intitolata «Mi serve una risposta». Nessuna
di queste blocca lo scaffold:

- l'armadio è personale o condiviso (coppie, famiglie)?
- c'è una parte social, sì o no?
- nel freemium, cosa si paga?
- **con quale strumento si costruisce il corpo dell'avatar?** — ricostruzione dalla
  foto a figura intera o un servizio esterno. Che debba essere *fedele alla
  persona* e non neutro non è più una domanda: lo decide l'ADR 0004. Resta aperto
  il mezzo, ed è la scelta che pesa di più su quanto dovrà allungarsi
  l'astrazione dell'avatar.
