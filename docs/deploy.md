# Deploy — il VPS di produzione

Non è un pannello di controllo automatizzato: è il resoconto di come questo
progetto sta in piedi su un server vero, scritto perché la prossima volta che
serve rimetterci le mani non si debba ricostruire tutto da zero leggendo i
commit.

## Cosa c'è

- **VPS**: Hetzner Cloud, piano CX22 (2 vCPU, 4 GB RAM), datacenter Germania,
  Ubuntu 24.04. IP pubblico: `89.167.15.22`. Hetzner ora assegna solo IPv6 di
  default — l'IPv4 va abilitato a parte dal pannello Networking del server
  (costa qualcosa in più al mese): senza, l'app non lo raggiunge in modo
  affidabile da reti che non hanno IPv6 funzionante.
- **Utente**: `marouan`, non-root, accesso SSH solo a chiave (login root e
  password disabilitati in `sshd_config`). Firewall `ufw`: solo 22/80/443.
- **Dominio**: `ilmioarmadio.xyz` (Porkbun). Un solo record utile, `A` con
  host `api` → `89.167.15.22`: l'app parla solo con `api.ilmioarmadio.xyz`,
  il dominio nudo non serve a niente.
- **Servizi**: `docker-compose.yml` nella radice del repo, tre container —
  `postgres`, `api` (l'immagine di `services/api/Dockerfile`), `caddy`
  (reverse proxy HTTPS, certificato Let's Encrypt automatico al primo avvio).

## Come arriva il codice sul server

**Il repo è privato**: niente `git clone` sul server (richiederebbe una
chiave di deploy da gestire per un solo aggiornamento occasionale). Si manda
la copia di lavoro via `rsync`, dal proprio computer o, dal deploy automatico
descritto sotto, da un runner di GitHub Actions:

```bash
rsync -avz --exclude node_modules --exclude .venv --exclude .git --exclude .env -e ssh ./ marouan@89.167.15.22:~/wardrobe/
```

Questo sovrascrive il codice sul server ma **non** i due file `.env` (esclusi
apposta): quelli restano quelli scritti a mano sul server, mai versionati,
mai transitati da qui.

Per aggiornare il server a mano dopo una modifica al codice: si rilancia lo
stesso `rsync`, poi `docker compose up -d --build` (sotto). In pratica serve
solo per un hotfix diretto sul server: il percorso normale è quello
automatico.

## Deploy automatico da CI

Il job `deploy` in `.github/workflows/api.yml` fa da solo, a ogni merge su
`main` che tocca `services/api/**` o `packages/contracts/**`, esattamente i
passi manuali sopra: lo stesso comando `rsync` (stesse esclusioni, `.env`
compresi) da un runner GitHub Actions, poi `docker compose up -d --build` via
SSH, poi `curl --fail .../salute` per accorgersi subito se il deploy ha
rotto qualcosa.

Serve una chiave SSH **dedicata al deploy**, diversa da quella personale usata
da terminale (così ruotarla o revocarla non tocca il proprio accesso
normale):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/wardrobe_deploy_key -N ""
ssh-copy-id -i ~/.ssh/wardrobe_deploy_key.pub marouan@89.167.15.22
gh secret set VPS_SSH_KEY < ~/.ssh/wardrobe_deploy_key
```

L'host key pubblica del VPS è committata in `.github/deploy/known_hosts`
(non è un segreto, è pensata per essere pubblica) così la CI non si fida "al
buio" del server a ogni run. Va rigenerata solo se il server viene
ricreato da zero (nuovo host, nuova chiave):

```bash
ssh-keyscan -H 89.167.15.22 > .github/deploy/known_hosts
```

Un push su `main` che tocca solo `apps/mobile` non fa partire questo job:
il backend non viene mai riavviato senza motivo.

## I due `.env` sul server

Non uno: **due**, con scopi diversi, entrambi da scrivere a mano sul server
(non esistono altrove, `.gitignore` li tiene fuori dal repo apposta).

**`~/wardrobe/.env`** — solo per l'interpolazione di Docker Compose (vedi
`.env.example` nella radice). Va scritto **prima** del primissimo `docker
compose up`: la password che contiene diventa quella di Postgres solo alla
creazione del volume, cambiarla dopo non sposta nulla finché il volume non
viene ricreato.

```
POSTGRES_PASSWORD=<openssl rand -hex 24>
```

**`~/wardrobe/services/api/.env`** — le chiavi vere dell'applicazione (vedi
`services/api/.env.example`). Sul server servono solo queste quattro:

```
ANTHROPIC_API_KEY=...
JWT_SECRET=<openssl rand -hex 32 — diverso da quello di sviluppo locale>
EMAIL_AMMESSE=<le email a cui è permesso registrarsi, separate da virgole>
BASE_URL_PUBBLICA=https://api.ilmioarmadio.xyz
```

`DATABASE_URL` e `CARTELLA_FOTO` **non vanno scritte qui**:
`docker-compose.yml` le fissa da solo nel blocco `environment:` del servizio
`api`, che vince sempre su `env_file:` — scriverle in questo file non farebbe
niente, e lascerebbe credere il contrario a chi lo legge dopo.

`BASE_URL_PUBBLICA` è il punto più facile da sbagliare senza accorgersene:
sbagliata o assente, le URL delle foto puntano all'IP interno del VPS invece
che al dominio pubblico, e login/salute continuano a rispondere bene — il
sintomo compare solo quando il telefono prova a scaricare una foto. Si
verifica con:

```bash
curl -X POST https://api.ilmioarmadio.xyz/foto/upload \
  -H "authorization: Bearer <un token valido>" \
  -d '{"content_type":"image/jpeg"}'
```

Il campo `"url"` nella risposta deve iniziare con
`https://api.ilmioarmadio.xyz/foto/...`.

## Avvio e aggiornamento

```bash
cd ~/wardrobe
docker compose up -d --build
docker compose logs -f api      # aspetta "API di Wardrobe in ascolto...", poi Ctrl-C
```

**Migrazioni**: sul primissimo avvio le applica da sola Postgres
(`docker-entrypoint-initdb.d`, che gira solo su un volume vuoto). Per una
migrazione arrivata *dopo* che il volume esiste già, va applicata a mano:

```bash
docker compose exec api python scripts/applica_migrazioni.py
```

## Scelte deliberate, da ricordare al prossimo giro

- **`PLAYGROUND_ABILITATO: "1"`** in `docker-compose.yml` (blocco
  `environment:` del servizio `api`, non nel `.env`): scelta apposta per
  questo primo giro di prova a due persone, entrambe dietro login e
  nell'allowlist di `EMAIL_AMMESSE`. Gli endpoint `/dev/*` spendono sulle
  chiavi LLM — da riportare a `"0"` alla prima build destinata a chiunque
  altro.
- **Postgres non è raggiungibile da Internet**: `ports: ["127.0.0.1:5432:5432"]`,
  non `"5432:5432"`. Un binding senza l'host `127.0.0.1` resterebbe
  raggiungibile dall'esterno anche con `ufw` attivo — Docker scrive le sue
  regole iptables prima di quelle di `ufw`, che quindi non lo vedrebbe mai.
- **Nessun rate limiting su `/auth/*`**: l'allowlist di `EMAIL_AMMESSE` è la
  sola barriera al brute force. Accettabile per due persone, da rivedere
  prima di aprire la registrazione a chiunque altro.

## Verifica rapida dopo ogni deploy

```bash
curl https://api.ilmioarmadio.xyz/salute
curl -X POST https://api.ilmioarmadio.xyz/auth/registrati -d '{"email":"...","password":"..."}'
# con il token qui sopra, il controllo su BASE_URL_PUBBLICA descritto sopra
```

Se il DNS non ha ancora propagato sul proprio computer (capita, appena dopo
aver creato o cambiato un record), si può verificare il server comunque,
saltando la risoluzione DNS locale:

```bash
curl --resolve api.ilmioarmadio.xyz:443:89.167.15.22 https://api.ilmioarmadio.xyz/salute
```
