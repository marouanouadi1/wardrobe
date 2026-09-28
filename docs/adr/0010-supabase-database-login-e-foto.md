# 0010 — Supabase fa database, login e foto; il backend resta per l'IA

**Stato:** accettata · **Data:** 2026-09-25

## Contesto

Il 2026-09-25 uno dei tre account ha dimenticato la password e non c'era modo di
recuperarla: né dall'app né dal server, se non a mano con un `update` in
produzione. Scrivere il recupero in casa voleva dire un fornitore di posta, un
codice monouso, un limite ai tentativi e un modo di chiudere le sessioni — un
branch intero, passato da un audit di sicurezza che ci ha trovato due difetti
medi prima che arrivasse su `main`. E dopo il recupero sarebbero arrivati
l'accesso con Google, poi con Apple: ogni pezzo di identità scritto a mano è un
pezzo da difendere a mano.

Nello stesso tempo il backend era l'unico client del database, e quindi l'unico
punto in cui si decideva chi vede cosa: un handler che dimentica un filtro
`utente_id` mostra l'armadio di un altro, e niente sotto lo ferma.

## Decisione

**Supabase** ospita il database (Postgres), l'identità (Auth: email e password,
recupero, Google; Apple quando si pubblicherà per iOS) e le foto (Storage).

- **L'app legge e scrive direttamente** su Supabase, con `supabase-js`, da un
  solo modulo (`apps/mobile/src/dati/supabase.ts`).
- **Row Level Security su ogni tabella esposta**: policy `to authenticated` con
  la proprietà della riga, `using` e `with check` sulle UPDATE. Anche le foto:
  un bucket privato, una cartella per utente.
- **Le regole che proteggono i dati stanno nel database**: vincoli ed enum;
  trigger per ciò che una modifica deve fare insieme a sé stessa (correggere o
  confermare un attributo); funzioni `security invoker` per le operazioni su
  più righe (segnare un capo come indossato, svuotare l'armadio); policy per
  ciò che solo l'amministratore può fare. Valgono per qualunque client, e si
  provano con test sul database.
- **Il backend Python resta per l'IA** — analisi della foto, suggerimenti,
  chat, esportazione — e **agisce come l'utente**: riceve il suo token, lo
  verifica con le chiavi pubbliche di Supabase, e legge e scrive con quello. Sul
  VPS non c'è nessuna credenziale che scavalchi l'RLS.
- **Gli inviti** (`EMAIL_AMMESSE`) diventano un hook «Before User Created» su una
  tabella in uno schema non esposto: vale anche per chi entra con Google.
- **Le migrazioni** si scrivono con la CLI di Supabase (`supabase/migrations/`,
  con la sua tabella di storico), non più col runner idempotente di
  `services/api/scripts/applica_migrazioni.py`.
- **Piano Free**, scelto dall'utente.

## Cosa supera

- Del README, **«Le quattro scelte»**: la prima (`handlers/` separato da
  `domain/`) e la seconda (i contratti generati da Pydantic) valgono ormai solo
  per il backend dell'IA. Per i dati salvati, la fonte è lo schema SQL, e i tipi
  TypeScript li genera `supabase gen types`.
- Il login autofirmato (`domain/autenticazione.py`, bcrypt, `JWT_SECRET`) e le
  foto firmate con HMAC (`domain/firma_foto.py`): spariscono. `T-46` perde il suo
  oggetto; `T-47` si chiude, perché il backend legge la foto con il token di chi
  chiede l'analisi.
- Il servizio `postgres` di `docker-compose.yml`, in sviluppo e in produzione.
  **Il volume di produzione non si cancella** con questa decisione: resta sul VPS
  come copia ferma al giorno del passaggio.

Gli ADR precedenti restano come sono: raccontano il perché delle scelte di
allora, e questo li supera dove li contraddice.

## Alternative scartate

- **Il recupero della password scritto in casa**, completato e scartato il
  2026-09-25. Funzionava, ma Google e Apple sarebbero stati altri due pezzi dello
  stesso lavoro.
- **Supabase come solo database, con il backend unico client.** Meno da
  riscrivere, ma l'RLS sarebbe stata una difesa che nessun client usa davvero.
- **Il backend con la chiave di servizio.** Più semplice, ma quella chiave sul
  VPS apre i dati di tutti a chi la trova, e un filtro dimenticato non lo ferma
  nessuno.
- **Le regole nell'app.** Più veloce da scrivere, ma valgono solo finché l'unico
  client è l'app, e le scritture su più tabelle non sono atomiche.
- **Il piano Pro** (25 $ al mese, backup di 7 giorni, nessuna pausa): scartato
  dall'utente.

## Conseguenze

- **Niente backup.** Sul piano Free un errore su una tabella di produzione non si
  recupera. L'unica copia di riserva è il Postgres del VPS, ferma al giorno del
  passaggio.
- **Pausa dopo una settimana senza richieste.** Il progetto si ferma finché
  qualcuno non lo riattiva dal pannello. L'app lo deve dire, non mostrare un
  armadio vuoto.
- **Limiti del piano**: 500 MB di database e 1 GB di foto (al passaggio: 52 MB).
- **Il recupero della password ha comunque bisogno di un fornitore di posta**:
  il servizio incluso manda solo ai membri dell'organizzazione Supabase, due email
  all'ora. Si configura un SMTP (Resend) nel pannello, con i record DNS del
  dominio su Hostinger.
- **Un giorno di passaggio.** L'APK in circolazione parla con il login e gli
  endpoint di oggi: dal passaggio non entra più, e serve quello nuovo. Il lavoro
  si fa su un branch di integrazione e arriva su `main` una volta sola.
- **Due fonti di tipi, con un confine**: lo schema SQL per i dati salvati,
  Pydantic per ciò che attraversa il backend dell'IA. Le enum e le soglie esistono
  in entrambi, e un gate in CI le confronta.
- **Le policy si provano solo contro un database vero**: lo stack locale della
  CLI, in CI e in sviluppo. È un container nei test, e lo è apposta: la regola
  «un test che vuole un container non testa il dominio» continua a valere per il
  dominio Python, non per l'RLS.
- **Dipendenze nuove nell'app**: `@supabase/supabase-js` e il login nativo con
  Google (`@react-native-google-signin/google-signin`, con un config plugin).
