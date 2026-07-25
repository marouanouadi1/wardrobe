# Tela — armadio digitale

Fotografi i vestiti una volta sola. Un modello di visione legge categoria,
colore, tessuto, stagione e lavaggio. Poi ogni mattina l'app propone cosa
mettere, con quello che hai già in casa, e te lo fa vedere addosso a un avatar.

Due funzioni portano il prodotto:

- **il suggeritore** — un modello che propone outfit usando *solo* i capi che hai,
  con il contesto della giornata (meteo, agenda, cosa è in lavatrice, cosa hai
  messo ieri);
- **l'avatar** — un manichino 3D che indossa i tuoi capi, girabile col dito, con
  un ripiego 2D che funziona su qualunque telefono.

Le due sono la stessa pipeline: il manichino non indossa fotografie, tinge
superfici con il **colore dominante** che il modello ha letto dalla foto. Per
questo `domain/vision.py` pretende `colore.hex` e rifiuta il capo se non lo
riconosce.

## Struttura

```txt
apps/
  mobile/            app Expo (iOS, Android, web) — 11 schermate
  web/               vuoto, ma il posto c'è
services/api/
  src/domain/        logica pura: zero SDK, zero AWS, testabile con pytest
  src/handlers/      adapter Lambda sottili: evento -> domain -> risposta
  src/adapters/      s3, postgres, step functions, provider LLM
infra/               CDK TypeScript: 6 stack, testati
packages/contracts/  tipi TypeScript generati dai modelli Pydantic
docs/adr/            le decisioni che valeva la pena scrivere
```

### Le quattro scelte che tengono su tutto

**1. `handlers/` separato da `domain/`.** Un handler fa tre righe: legge
l'evento, chiama una funzione pura, formatta la risposta. Tutta la logica sta in
`domain`, che gira con pytest senza AWS, senza container e senza mock della SDK —
106 test in un secondo. Il vincolo non è una convenzione scritta in un README:
`pyproject.toml` vieta gli import di `boto3`, `psycopg` e `httpx` fuori da
`adapters/`, e il lint fallisce se qualcuno prova.

**2. I contratti sono generati, non copiati.** I modelli Pydantic in
`services/api/src/domain/models.py` sono la fonte di verità. Uno script esporta
il JSON Schema, da quello nascono i tipi TypeScript in `packages/contracts`.
Rinominare un campo nel backend senza rigenerare fa fallire la CI; rigenerarlo fa
fallire `tsc` dell'app esattamente nei punti da aggiornare. Anche le **soglie**
sono generate: `SOGLIA_INCERTEZZA` vive nel dominio Python e l'app la importa,
invece di riscrivere `86` in TypeScript.

**3. CI con filtri sui path.** Ogni workflow ha `on: push: paths:`, così un
commit su `apps/mobile` non ridispiega l'infrastruttura. È anche il motivo per cui
questo monorepo non ha bisogno di Nx o Turborepo: tre workflow indipendenti e due
gestori di pacchetti (npm per TypeScript, uv per Python) che convivono senza
mediatori.

**4. `docs/adr/`.** Tre decisioni scritte in breve — contesto, decisione,
alternative scartate. Perché Step Functions, perché CDK invece di Terraform,
perché l'upload va diretto su S3.

## Partire

### L'app, subito

```bash
npm install
npm run mobile          # oppure: npm run mobile:web
```

Senza `EXPO_PUBLIC_API_URL` l'app parte in **modalità demo**: dodici capi di
esempio, foto reali, tutte e undici le schermate navigabili. Nessun account AWS,
nessun Docker, nemmeno Python.

### Con il backend locale

```bash
npm run api:sync                    # dipendenze Python (uv)
npm run api:local                   # API su http://localhost:8787, dati in memoria
EXPO_PUBLIC_API_URL=http://localhost:8787 npm run mobile
```

`api:local` costruisce lo stesso evento payload v2 di API Gateway e chiama gli
stessi handler: quello che provi in locale è il codice che gira in cloud, senza
SAM e senza emulatori. Due cose girano diversamente, ed è dichiarato nel codice:

- **la pipeline di analisi** in locale esegue i due task in linea invece di
  passare da Step Functions (`handlers/analisi.py`);
- **il suggeritore** chiama il provider direttamente, invece di delegare alla
  Lambda `llm-worker` che in cloud vive fuori dalla VPC
  (`handlers/suggerimenti.py`).

Senza queste due deviazioni la feature di punta non sarebbe provabile prima di un
deploy — che è il modo più sicuro per scoprire un prompt sbagliato tardi.

Per provare i modelli veri servono le chiavi:

```bash
export ANTHROPIC_API_KEY=...        # il provider di riferimento
export OPENAI_API_KEY=...           # opzionali
export GOOGLE_API_KEY=...
```

Poi **Profilo → Playground modelli**: si scelgono provider e modello, si modifica
il system prompt, si esegue, e si leggono latenza, token, costo ed esito. Il
playground esercita i due lavori veri (analisi della foto, suggerimento), non una
chat: aggiungere un provider è un file in `adapters/llm/` più una riga nel
registro, e nessuna schermata cambia.

### Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run mobile` | avvia l'app Expo |
| `npm run mobile:web` | l'app nel browser |
| `npm run api:local` | API in locale, dati in memoria |
| `npm run api:test` | 106 test del dominio e degli handler |
| `npm run api:lint` | ruff + ruff format + mypy strict |
| `npm run contracts:generate` | rigenera i tipi TypeScript dal backend |
| `npm run contracts:check` | verifica che siano allineati (gira in CI) |
| `npm run typecheck` | tsc su app, contratti e infrastruttura |
| `npm run infra:synth` | sintetizza i template CloudFormation |
| `npm run infra:deploy` | deploy (serve un account AWS) |
| `npm run db:up` | Postgres e MinIO in locale |

## Stato

### Verificato su questa macchina

- `npm run api:test` → **106 test passati**
- `npm run api:lint` → ruff pulito, **mypy strict** senza errori su 34 file
- `npm run contracts:check` → contratti allineati; verificato anche il contrario,
  rinominando un campo nel backend per vedere la CI cadere
- `npm run typecheck` → pulito su app, contratti e infrastruttura
- `npm run infra:synth` → 7 template, **senza credenziali AWS**; 13 test degli
  stack passati
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

**Il deploy su AWS non è mai stato eseguito.** `cdk synth` produce i template,
nessuno stack è stato creato, e il repository non è ancora un repository git —
quindi i tre workflow non sono mai partiti.

**Gli id dei modelli non-Anthropic vanno confermati.** Quelli di Claude vengono
dall'SDK ufficiale; `gpt-5.1` e `gemini-2.5-pro` sono i nomi indicati nel design e
sono sovrascrivibili da ambiente (`MODELLI_OPENAI`, `MODELLI_GOOGLE`). Anche i
loro prezzi mancano dal catalogo: il playground mostra «—» invece di inventare un
numero.

## Le quattro domande che il design lascia aperte

Il file di design contiene una scheda intitolata «Mi serve una risposta». Nessuna
di queste blocca lo scaffold, ma la terza decide quanto dovrà allungarsi
l'astrazione dell'avatar:

1. l'armadio è personale o condiviso (coppie, famiglie)?
2. c'è una parte social, sì o no?
3. l'avatar deve essere fedele al corpo o neutro?
4. nel freemium, cosa si paga?
