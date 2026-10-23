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
- **Dominio**: `ilmioarmadio.xyz`, registrato e servito da **Hostinger** —
  i nameserver sono `aster.dns-parking.com` e `helios.dns-parking.com`, e i
  record si toccano da hPanel → Domini → DNS. (Fino al 17/09/2026 questa riga
  diceva «Porkbun»: era sbagliata.) Un solo record utile, `A` con host `api`
  → `89.167.15.22`: l'app parla solo con `api.ilmioarmadio.xyz`, il dominio
  nudo non serve a niente.
- **Servizi**: `docker-compose.yml` nella radice del repo, due container —
  `api` (l'immagine di `services/api/Dockerfile`) e `caddy` (reverse proxy
  HTTPS, certificato Let's Encrypt automatico al primo avvio).
- **Supabase**: database, login e foto stanno nel progetto
  `lmjsrhwzjxubecgctrmd`, sul piano Free: niente backup, e una pausa dopo una
  settimana senza richieste
  ([`docs/adr/0010`](adr/0010-supabase-database-login-e-foto.md)). Come ci
  arriva lo schema è in «Il progetto Supabase», qui sotto.
- **La copia di riserva**: i volumi `postgres_data` e `foto_dati` del Postgres
  di prima, fermi al giorno del passaggio (2026-09-27). `docker-compose.yml`
  non li nomina più, e il deploy non tocca il container `wardrobe-postgres`
  (niente `--remove-orphans`). **Nessuno lancia `docker compose down -v`,
  `docker volume rm` o `prune`**: fermare quel container e togliere i volumi è
  una decisione dell'utente, e lo stato è in `docs/PROGRESS.md`.

## Come arriva il codice sul server

**Il repo è privato**: niente `git clone` sul server (richiederebbe una
chiave di deploy da gestire per un solo aggiornamento occasionale). Si manda
la copia di lavoro via `rsync`, dal proprio computer o, dal deploy automatico
descritto sotto, da un runner di GitHub Actions:

```bash
rsync -avz --exclude node_modules --exclude .venv --exclude .git --exclude .env -e ssh ./ marouan@89.167.15.22:~/wardrobe/
```

Questo sovrascrive il codice sul server ma **non** i file `.env` (esclusi
apposta): quelli restano quelli scritti a mano sul server, mai versionati,
mai transitati da qui.

Non c'è `--delete`, quindi **un file tolto dal repo resta sul server**. Dal
passaggio a Supabase vale anche per il codice: gli handler e gli adapter tolti
nella fase 2 (`auth.py`, `capi.py`, `postgres.py`, …) restano in
`~/wardrobe/services/api/src/`, e il `Dockerfile` copia `src/` intero
nell'immagine. Nessuno li importa, ma un import accidentale diventerebbe un
crash all'avvio. La voce è `T-50` in `docs/DA_FARE.md`: aggiungere `--delete`
va deciso sapendo che sul server vivono file `.env` che non esistono da
nessun'altra parte.

Per aggiornare il server a mano dopo una modifica al codice: si rilancia lo
stesso `rsync`, poi `docker compose up -d --build` (sotto). In pratica serve
solo per un hotfix diretto sul server: il percorso normale è quello
automatico.

## Deploy automatico da CI

Il job `deploy` in `.github/workflows/api.yml` fa da solo, a ogni merge su
`main` che tocca `services/api/**`, `packages/contracts/**` o il workflow
stesso, esattamente i passi manuali sopra: lo stesso comando `rsync` (stesse
esclusioni, `.env` compresi) da un runner GitHub Actions, poi `docker compose
up -d --build` via SSH. Intorno a quei due passi c'è il versionamento:

1. **bump della versione** in `services/api/pyproject.toml` con
   `scripts/bump-versione.mjs api`. Il livello non è fisso: viene dedotto dai
   conventional commit dall'ultimo tag `api-v*` (vedi
   [`docs/adr/0005`](adr/0005-le-versioni-vengono-dai-commit.md)). Segue un
   `uv lock`, perché `uv.lock` registra anche la versione del progetto stesso e
   altrimenti resterebbe indietro per sempre. Qui i file vengono solo scritti,
   così l'albero che parte col `rsync` porta già la versione nuova;
2. `rsync` + `docker compose up -d --build --wait`, come sopra;
3. **verifica della versione servita**: `GET /salute` riporta la versione dai
   metadati del pacchetto installato, e il job confronta quel valore con la
   versione appena rilasciata. Prima qui c'era solo un `curl --fail`: un rsync
   andato a metà, o un `up` che riusava l'immagine vecchia, passavano
   inosservati perché l'endpoint rispondeva comunque. **`/salute` non parla con
   Supabase**: un progetto in pausa non fa diventare rosso questo passo;
4. **commit + tag `api-v<versione>`**, pushati per ultimi, a deploy verificato.
   Se qualcosa sopra è andato storto il rilascio non lascia traccia su `main` e
   il tentativo successivo riparte dallo stesso numero: un tag su una versione
   che non è mai andata in produzione sarebbe una bugia scritta nella storia.
   `[skip ci]` nel messaggio perché il commit tocca `services/api/**`, che è nei
   path che fanno partire questo stesso workflow.

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

**Le migrazioni non passano da qui.** Lo schema sta su Supabase, e sul progetto
vero lo porta `supabase db push`, a mano: vedi «Il progetto Supabase».

## Deploy automatico dell'app mobile

Il job `release` in `.github/workflows/mobile.yml` fa, a ogni merge su `main`
che tocca `apps/mobile/**`, `packages/contracts/**`, `package.json`,
`package-lock.json` o il workflow stesso, questi passi in sequenza (anche un
aggiornamento di Dependabot al solo lockfile, quindi, è un rilascio
dell'app):

1. bump semver con `scripts/bump-versione.mjs mobile` (unica fonte di verità:
   `apps/mobile/app.json`, `expo.version`). Il **livello** — major, minor o
   patch — viene dedotto dai conventional commit dall'ultimo tag `mobile-v*`,
   contando solo quelli che toccano `apps/mobile` o `packages/contracts`: un
   `feat:` solo backend non alza il minor dell'app. Il formato dei titoli è
   imposto da `.github/workflows/pr-title.yml`, e il ragionamento sta in
   [`docs/adr/0005`](adr/0005-le-versioni-vengono-dai-commit.md);
2. commit di quel bump direttamente su `main`, con `[skip ci]` nel messaggio
   (altrimenti il commit stesso, toccando `apps/mobile/**`, farebbe ripartire
   questo stesso workflow) e un tag `mobile-v<versione>` — pushato
   esplicitamente (`git push origin <tag>`), non con `--follow-tags`: quel
   flag pubblica solo tag *annotati*, e `git tag` senza `-a` crea un tag
   *lightweight* che altrimenti resterebbe solo sul runner;
3. `eas build --platform android --profile preview --wait --json`: aspetta
   davvero il risultato (a differenza di `--no-wait`, che lasciava la build
   a girare "da qualche parte" senza nessun artefatto recuperabile in CI);
4. download dell'APK e pubblicazione come **GitHub Release**, tag
   `mobile-v<versione>` — è lì che si trova l'ultimo APK da passare al socio
   di test per il sideload. A quota EAS finita questo passo non arriva, e
   l'APK si costruisce in locale: vedi «Build locale dell'APK» qui sotto.

`apps/mobile/eas.json` ha `"autoIncrement": true` sul profilo `preview`: EAS
alza da sola il `versionCode` Android a ogni build, cosa diversa dal bump
semver sopra (quello è il numero di versione umano, `0.1.x`; l'altro è il
contatore interno che permette ad Android di installare l'APK nuovo sopra il
vecchio senza disinstallare).

Entrambi i job di rilascio fanno il checkout con `fetch-depth: 0`: la scelta
del livello legge i commit dall'ultimo tag, e col default di
`actions/checkout` (profondità 1, nessun tag scaricato) rilascerebbero sempre
un patch senza dirlo.

Serve `EXPO_TOKEN` nei secrets del repo (Access Token da expo.dev → Account
settings). Per testare la pipeline senza aspettare un merge vero, entrambi i
workflow hanno anche `workflow_dispatch`: si lancia a mano da main dalla tab
Actions di GitHub.

Un push su `main` che tocca solo `services/api` non fa partire questo job:
niente bump, niente build, niente release se l'app non è cambiata.

## Build locale dell'APK

**Oggi l'APK da distribuire si costruisce in locale**
([`docs/adr/0009`](adr/0009-l-apk-si-costruisce-in-locale.md)). Le build in
cloud di EAS stanno in una quota mensile del piano gratuito, e quando finisce
il job `release` qui sopra si ferma allo step «Build Android preview», **dopo**
aver già fatto bump, commit e tag. Da lì si prosegue sul computer locale.

Si parte dopo il merge, quando il job `release` ha pushato il bump:

```bash
git switch main && git pull --ff-only
TAG=$(git describe --tags --abbrev=0 --match 'mobile-v*')   # es. mobile-v0.9.1
V=${TAG#mobile-v}

# La Release c'è già? Allora la build in cloud è andata, e qui non serve niente.
gh release view "$TAG" && echo "già pubblicata"

git switch --detach "$TAG"            # si costruisce il tag, non la punta di main
cd apps/mobile
eas build --platform android --profile preview --local --non-interactive \
  --output "$HOME/wardrobe-$V.apk"
cd ../..
git switch main

gh release create "$TAG" "$HOME/wardrobe-$V.apk" \
  --title "Wardrobe mobile v$V" \
  --notes "Build locale da $TAG ($(git rev-parse "$TAG")), eas build --local."
```

- `--local` è la stessa build del cloud, eseguita qui: profilo `preview`,
  variabili di `eas.json`, credenziali di firma scaricate da Expo,
  `versionCode` incrementato in remoto. **Non consuma quota.**
- Il tag, non `main`: fra il bump dell'app e la build può essere arrivato un
  altro commit (un bump dell'API, per esempio), e l'APK deve contenere
  esattamente la versione che porta nel nome.
- Serve un working tree pulito: la build impacchetta il repo com'è.
- **`expo doctor` fallisce, e la build prosegue.** È un controllo che `eas
  build` lancia prima di Gradle e non è bloccante. Dal 2026-09-24 (`T-53` e
  `T-54` chiuse) segnala una cosa sola: `resolver.disableHierarchicalLookup` in
  `metro.config.js`, che è **voluto** — tiene una sola copia di React, `T-23` —
  e non va tolto. Un secondo controllo rosso è una novità, e va letto.
- La prima esecuzione (`0.9.1`, 2026-09-24): Gradle 9 minuti, APK da 64 MB.
- **Cosa serve sulla macchina**: JDK 17, Android SDK con `ANDROID_HOME`,
  `eas-cli` loggato sull'account Expo del progetto (`eas whoami`), `gh`
  autenticato. Al 2026-09-24 il computer di sviluppo ha tutto.
- Il job `release` rosso in quel caso è atteso: **non si rilancia**. «Re-run»
  rifà il job da capo, bump compreso, e si ferma sul tag che esiste già — non
  riprende dalla build. L'APK di quel tag si fa qui.

## I `.env` sul server

**`~/wardrobe/services/api/.env`** — le chiavi vere dell'applicazione (vedi
`services/api/.env.example`), da scrivere a mano sul server: non esistono
altrove, `.gitignore` le tiene fuori dal repo apposta. Sul server servono
queste due:

```
ANTHROPIC_API_KEY=...
FAL_KEY=...
```

Le altre del `.env.example` sono facoltative: le chiavi degli altri provider e
la scelta di provider e modello (`PROVIDER_VISIONE`, `PROVIDER_STILISTA`, …).

`SUPABASE_URL` e `SUPABASE_CHIAVE_PUBBLICA` **non vanno scritte qui**:
`docker-compose.yml` le fissa da solo nel blocco `environment:` del servizio
`api`, che vince sempre su `env_file:`. Sono pubbliche per costruzione — chi è
l'utente lo dice il suo token, non loro — e così un `.env` vecchio non può
puntare l'API a un altro progetto. **La chiave di servizio di Supabase non va
mai in questo file**: sul server non c'è niente che scavalchi l'RLS (ADR 0010).

Dal passaggio il backend non legge più `JWT_SECRET`, `EMAIL_AMMESSE`,
`EMAIL_AMMINISTRATORI`, `BASE_URL_PUBBLICA`, `DATABASE_URL` né `CARTELLA_FOTO`.
Se sono ancora nel file del server non fanno niente; toglierle vuol dire
riscrivere un file che non ha copia, e si fa a mano, sapendo cosa si toglie.
Gli inviti stanno nella tabella `privato.inviti`, e l'amministratore in
`app_metadata` (sotto).

**`~/wardrobe/.env`**, nella radice, conteneva `POSTGRES_PASSWORD` per il
Postgres di prima. `docker-compose.yml` non lo legge più, ma è la password della
copia di riserva: non si cancella finché esistono i volumi.

`FAL_KEY` è un sintomo silenzioso: a differenza di `ANTHROPIC_API_KEY`, la sua
assenza non impedisce al backend di partire né fa fallire niente — il backend
parte, l'analisi riesce, i capi si salvano, e le foto restano con lo sfondo
originale, senza un solo errore nei log (`servizio_scontorno()` in
`_container.py` torna semplicemente `None`, di proposito: provare l'app non deve
dipendere da una seconda chiave oltre a quella del provider di visione). Si
verifica così:

```bash
docker compose exec -T api sh -c "env | grep -c FAL_KEY"   # deve dare 1
docker compose logs api | grep -i scontorn                 # una riga di warning se fal.ai rifiuta
```

**Attenzione dopo aver aggiunto o cambiato una variabile di questo file a un
server già in piedi**: `docker compose restart` **non** rilegge `env_file:`, e
per `FAL_KEY` in più la decisione scontorno-sì/no è messa in cache nel processo
(`@functools.cache` su `servizio_scontorno()`). Serve `docker compose up -d api`
per far ripartire il container da zero, non un semplice restart.

## Avvio e aggiornamento

```bash
cd ~/wardrobe
docker compose up -d --build
docker compose logs -f api      # aspetta "API di Wardrobe in ascolto...", poi Ctrl-C
```

## Il progetto Supabase

**Lo schema non lo porta un merge.** Le migrazioni di `supabase/migrations/` le
prova il job `database` sullo stack locale; sul progetto vero le porta `supabase
db push`, lanciato a mano dal computer di sviluppo con la CLI collegata al
progetto (`supabase link --project-ref lmjsrhwzjxubecgctrmd`). Da lì una
migrazione è storia: si corregge con un file nuovo. **Mai `--include-seed`**: il
seed inserisce un invito di sviluppo. Le regole complete stanno in
`.claude/rules/migrazioni.md`.

**La configurazione dell'Auth sta nel pannello, non nel repo**: l'hook degli
inviti («Before User Created»), lo SMTP con Resend, i template con il codice
(`supabase/templates/`), il provider Google, gli accessi anonimi spenti.
L'elenco di cosa va impostato, e il fatto che nessun job lo controlla, è `T-56`
in `docs/DA_FARE.md`.

**L'amministratore** — chi vede e lavora le segnalazioni di tutti — è un
account con `ruolo: "amministratore"` in `app_metadata`, che l'utente non può
scriversi da sé (`privato.e_amministratore()` nella migrazione). Si assegna
dall'editor SQL del pannello:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"ruolo": "amministratore"}'
where email = '...';
```

Il ruolo viaggia dentro il token: vale dal prossimo rinnovo della sessione, non
subito.

## Scelte deliberate, da ricordare al prossimo giro

- **L'API si raggiunge solo passando da Caddy**: il servizio `api` ha
  `expose:`, non `ports:`. Una porta pubblicata resterebbe raggiungibile
  dall'esterno anche con `ufw` attivo — Docker scrive le sue regole iptables
  prima di quelle di `ufw`, che quindi non la vedrebbe mai — e si parlerebbe
  all'API in chiaro, scavalcando TLS.
- **Le registrazioni passano dagli inviti**: l'hook «Before User Created»
  rifiuta un'email che non è in `privato.inviti`, anche con Google. I tentativi
  sul codice via email li frenano le otto cifre, la scadenza e il limite per IP
  di Supabase Auth (`T-56`). Da rivedere prima di aprire la registrazione a
  chiunque.

## Verifica rapida dopo ogni deploy

```bash
curl https://api.ilmioarmadio.xyz/salute                            # la versione appena rilasciata
curl -i -X POST https://api.ilmioarmadio.xyz/suggerimenti -d '{}'   # senza token: 401
```

Il resto — login, foto, analisi — passa da Supabase e si prova dall'app.

Se il DNS non ha ancora propagato sul proprio computer (capita, appena dopo
aver creato o cambiato un record), si può verificare il server comunque,
saltando la risoluzione DNS locale:

```bash
curl --resolve api.ilmioarmadio.xyz:443:89.167.15.22 https://api.ilmioarmadio.xyz/salute
```
