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
  mobile/            app Expo (iOS, Android, web) — 11 schermate
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
106 test in un secondo. Il vincolo non è una convenzione scritta in un README:
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

Nel `.env` di `services/api` (copiato da `.env.example`) servono almeno
`ANTHROPIC_API_KEY`. `DATABASE_URL` e `CARTELLA_FOTO` sono già impostate nel
`.env` d'esempio del progetto: sono la modalità normale, con i capi in
Postgres e le foto su disco. Commentandole si torna alla memoria volatile, che
non sopravvive al riavvio.

L'app trova da sola l'indirizzo dell'API: su Expo Go o dev client usa lo
stesso host a cui si è già collegata per il bundle JS (lo stesso IP del QR
code); su `mobile:web` usa l'host con cui il browser ha raggiunto la pagina
(`window.location.hostname`). In entrambi i casi assume che l'API giri sulla
stessa macchina — il caso comune in sviluppo. `EXPO_PUBLIC_API_URL` resta per
sovrascriverlo esplicitamente (un server remoto, tipico di una build EAS
puntata sul VPS di produzione, o quando l'euristica indovina l'host sbagliato).

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

Poi **Profilo → Playground modelli**: si scelgono provider e modello, si modifica
il system prompt, si esegue, e si leggono latenza, token, costo ed esito. Il
playground esercita i due lavori veri (analisi della foto, suggerimento), non una
chat: aggiungere un provider è un file in `adapters/llm/` più una riga nel
registro, e nessuna schermata cambia.

### Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Postgres + API, con un comando solo |
| `npm run dev:app` | come sopra, più l'app Expo |
| `npm run mobile` | avvia l'app Expo |
| `npm run mobile:web` | l'app nel browser |
| `npm run api:local` | solo l'API (Postgres già acceso) |
| `npm run api:test` | 106 test del dominio e degli handler |
| `npm run api:lint` | ruff + ruff format + mypy strict |
| `npm run contracts:generate` | rigenera i tipi TypeScript dal backend |
| `npm run contracts:check` | verifica che siano allineati (gira in CI) |
| `npm run typecheck` | tsc su app e contratti |
| `npm run db:up` | solo Postgres in Docker |
| `npm run db:down` | spegne Postgres |
| `npm run db:migrate` | riapplica lo schema (serve solo su un volume vecchio) |

## Stato

### Verificato su questa macchina

- `npm run api:test` → **106 test passati**
- `npm run api:lint` → ruff pulito, **mypy strict** senza errori su 34 file
- `npm run contracts:check` → contratti allineati; verificato anche il contrario,
  rinominando un campo nel backend per vedere la CI cadere
- `npm run typecheck` → pulito su app e contratti
- `expo export` → bundle **web** (3,4 MB), **iOS** e **Android** (5,4 e 5,6 MB di
  bytecode Hermes) — il bundle nativo è ciò che dimostra che three.js, expo-gl e i
  contratti si risolvono anche fuori dal browser
- `expo lint` → nessun problema
- API in locale interrogata con richieste vere: `/capi` restituisce i dodici capi,
  `/suggerimenti` e `/dev/playground` rispondono **503 provider_non_configurato**
  senza credenziali (non un 500), e `/capi/analisi` esegue la pipeline in linea
  riportando il motivo del fallimento

### Non verificato, e conta saperlo

**Nessun modello è mai stato interrogato.** Su questa macchina non c'erano
credenziali di nessun provider, quindi il suggeritore e l'analisi delle foto sono
stati provati solo fino al confine: prompt costruito, chiamata partita, errore
gestito. Il primo `ANTHROPIC_API_KEY` esportato è anche il primo vero collaudo
delle due feature di punta — aspettati di ritoccare i prompt in
`domain/vision.py` e `domain/stylist.py` dopo averli visti all'opera.

**Il manichino 3D non è mai stato visto girare.** Compila ed è dentro i bundle
nativi, ma serve un dispositivo o un simulatore. Se WebGL non parte, un confine
di errore passa al manichino piatto: la funzione «vedi come ti sta» non si perde
in nessun caso.

**Dell'avatar vero non c'è ancora niente.** Nessun modello di scontorno, nessuna
ricostruzione 3D, nessuno strumento per il corpo della persona: la direzione
dell'ADR 0004 è scritta, non implementata. Quello che c'è è il manichino a
primitive tinte.

**Il deploy su un VPS pubblico non è mai stato eseguito davvero.** L'immagine
Docker (`services/api/Dockerfile`) costruisce e gira in locale, e il
`Caddyfile` è sintatticamente valido, ma senza un dominio vero puntato a un
IP pubblico non si è mai visto Let's Encrypt emettere un certificato reale
per questo progetto.

**Gli id dei modelli non-Anthropic vanno confermati.** Quelli di Claude vengono
dall'SDK ufficiale; `gpt-5.1` e `gemini-2.5-pro` sono i nomi indicati nel design e
sono sovrascrivibili da ambiente (`MODELLI_OPENAI`, `MODELLI_GOOGLE`). Anche i
loro prezzi mancano dal catalogo: il playground mostra «—» invece di inventare un
numero.

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
