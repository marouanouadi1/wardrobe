# PROGRESS — lo stato reale del progetto

> **Questo file è l'unica fonte su cosa è implementato.** Non dedurre lo stato dalla
> presenza di un file: un handler con il nome giusto può rispondere sempre 501, e un
> modulo citato da un ADR può non esistere più. Prima di dare per esistente — o per
> inesistente — qualunque cosa, si apre questo file.

**Ultimo aggiornamento:** 2026-09-11

> ### Sulla provenienza di questa prima versione
>
> Le righe qui sotto **trascrivono le affermazioni che il README faceva al 2026-09-08**.
> Non sono state riverificate nel momento in cui questo file è nato, e marcarle `[x]`
> — che questa legenda definisce come «verificato, gate verdi» — riprodurrebbe
> esattamente la deriva che questo file esiste per fermare.
>
> Perciò ogni riga trascritta porta la sua provenienza fra parentesi, e **promuovere
> una riga a `[x]` richiede di rieseguire il controllo che quella riga nomina**.

## Legenda

| Simbolo | Significato |
|---|---|
| `[ ]` | non iniziato |
| `[~]` | in corso — la riga dice **cosa manca**, non «quasi finito» |
| `[x]` | completato **e verificato**: la riga dice *come* |
| `[!]` | bloccato — la riga dice **da cosa** |

## Backend (`services/api`)

Le rotte reali sono 24, nella tabella `ROTTE` di `src/handlers/local_server.py:51`.

- [x] `GET /salute` — riporta la versione dai metadati del pacchetto. *Verificato a ogni
      deploy da `api.yml`, step «Verifica salute e versione servita»: è l'unica riga di
      questo file che una macchina ricontrolla da sola.*
- [x] `POST /auth/accedi`, `POST /auth/registrati` — JWT autofirmato, bcrypt, allowlist
      `EMAIL_AMMESSE` fail-closed. *Provato con richieste vere in locale (403 senza
      allowlist, 401 senza token) e contro il server pubblico — dichiarato in README al
      2026-09-08.*
- [x] `GET /capi`, `GET|PATCH /capi/{id}`, `POST /capi/{id}/indossato`,
      `GET /armadio/riepilogo`
- [x] `GET|POST /chat`, `GET /chat/conversazioni`, `GET|DELETE /chat/conversazioni/{id}`
      — ADR 0006, migrazione `0009`
- [x] `GET|POST /outfit`, `GET /outfit/{id}/colori`
- [x] `GET|PUT /profilo`
- [x] `POST|GET /segnalazioni`, `PATCH /segnalazioni/{id}` — amministratori da
      `EMAIL_AMMINISTRATORI`, fail-closed
- [x] `POST /foto/upload` — URL firmata, la PUT la fa l'app
- [~] `POST /capi/analisi` + `GET /capi/analisi/{id}` — la pipeline a due fasi gira e
      riporta il motivo del fallimento, ma **nessun modello è mai stato interrogato
      davvero**: manca una chiave (vedi «Cosa manca dall'esterno»)
- [~] `POST /suggerimenti` — risponde `503 provider_non_configurato` senza credenziali,
      non 500. Il prompt di `domain/stylist.py` non è mai stato visto all'opera
- [~] Scontorno foto (`adapters/scontorno/fal_provider.py`) — passo facoltativo di
      `handlers/analisi.py`, **0% di coverage**, non collegato a nessuna ricostruzione 3D

## App (`apps/mobile`)

16 file rotta sotto `app/` (`index.tsx` è uno smistatore). **Nessuna di queste schermate
è mai stata toccata con un dito su un telefono vero.**

- [!] `accedi.tsx`, `registrati.tsx`, il redirect di `index.tsx`, il guard delle tab, il
      logout — **bloccati da: una prova su dispositivo reale.** Hanno passato solo `tsc`
      ed `expo lint`. Il primo `npm run mobile` è anche la prima prova del percorso
      completo: registrazione → armadio vuoto → primo capo
- [x] `(tabs)/armadio.tsx`, `(tabs)/carica.tsx`, `(tabs)/oggi.tsx`, `(tabs)/profilo.tsx`,
      `capo/[id].tsx` — *verificati contro il backend vero in locale, commit `709e11c`
      (2026-09-08). Non rieseguito da allora.*
- [x] `chat.tsx`, `calendario.tsx`, `outfit.tsx`, `suggeritore.tsx`, `preferenze.tsx`,
      `intro.tsx`, `segnalazioni.tsx`
- [~] `(tabs)/avatar.tsx` — sagoma SVG tinta dai colori dominanti. È il **ripiego
      dichiarato dall'ADR 0004**, non il 3D che l'ADR descrive: il manichino che vestiva
      foto vere è stato rimosso col playground e non ne resta codice
- [ ] Test automatici dell'app — vedi `docs/TEST_COVERAGE.md`

## Contratti (`packages/contracts`)

- [x] Generati da `domain/models.py`; `contracts:check` blocca in CI il disallineamento.
      *Verificato anche al contrario, rinominando un campo nel backend per vedere la CI
      cadere — dichiarato in README al 2026-09-08.*

## Infrastruttura e rilascio

- [x] VPS Hetzner, Caddy, Let's Encrypt emesso al primo avvio, dominio reale. Deploy
      automatico da `api.yml` con verifica della versione servita. Dettagli in
      `docs/deploy.md`
- [x] Build EAS Android + GitHub Release automatiche da `mobile.yml`
- [x] Bump di versione dai conventional commit (ADR 0005), `pr-title.yml` che lo protegge
- [ ] Nessun rilascio iOS

## Cosa manca dall'esterno

Le cose che **non dipendono da noi**. Si aggiornano appena se ne conosce una.

| Cosa serve | A chi | Blocca |
|---|---|---|
| `ANTHROPIC_API_KEY` su una macchina di sviluppo | utente | il primo collaudo vero di analisi foto e suggeritore; aspettarsi di ritoccare i prompt di `domain/vision.py` e `domain/stylist.py` dopo averli visti all'opera |
| Una sessione con un telefono vero (`npm run mobile`) | utente | l'intero blocco `[!]` qui sopra: registrazione e login non sono mai stati provati su un dispositivo |
| `EXPO_PUBLIC_SENTRY_DSN` | utente | il pulsante «Segnala un problema» resta nascosto, di proposito |
| Conferma degli id `gpt-5.1` e `gemini-2.5-pro` | utente | niente oggi: sono sovrascrivibili da ambiente — vedi `docs/QUESTIONI.md` Q-03 |
| Con che strumento si costruisce il corpo dell'avatar | utente | la direzione dell'ADR 0004 oltre il ripiego 2D — vedi `docs/DOMANDE_APERTE.md` D-04 |

## Debiti dichiarati

Non sono lavori «non iniziati»: sono cose che funzionano e che conviene sapere.

- **Il percorso dati che gira in produzione non ha nessun test.** Tutti i test del
  backend girano su `ArchivioInMemoria` (97%). `adapters/postgres.py` (123 istruzioni),
  `handlers/local_server.py` (120), `adapters/filesystem.py` (57) e
  `adapters/scontorno/fal_provider.py` (25) sono a **0%**. Il 74% totale è una media che
  lo nasconde. Dettaglio in `docs/TEST_COVERAGE.md`
- **`apps/mobile` non ha test automatici.** Il primo lotto copre la leggibilità del
  testo sul fondo dipinto, che è la classe di difetti che `tsc` non vede. I conteggi
  stanno in `docs/TEST_COVERAGE.md`, che è l'unico file che può dichiararli
- **Sette letterali `rgba()` nelle schermate** ricalcolano a mano token esistenti:
  `app/calendario.tsx:94,99`, `app/(tabs)/_layout.tsx:58,80`, `app/intro.tsx:77`,
  `app/capo/[id].tsx:156`, `app/(tabs)/carica.tsx:289`. Il caso più netto è
  `calendario.tsx:99` → `rgba(21,21,26,0.4)`, che **è** `testoSu.chiaro.debole`.
  Non sono gatati perché il gate fallirebbe oggi: prima si sanano, poi si accende
- **Un esadecimale vive dentro una primitiva**, `src/ui/capi.tsx:280` (`#FFF1EC`): vicino
  a `colori.coralloTenue` ma non identico, mai promosso a token. È il posto che la vecchia
  regola («niente esadecimali nelle schermate») considerava al sicuro
- **`CLAUDE.md` ha descritto per due giorni una regola superata** (l'inoltro di `su`,
  cambiato dal commit `ee7f492`). Corretto il 2026-09-11, ma è il segnale che le
  convenzioni scritte a mano derivano quanto i numeri — vedi `QUESTIONI.md` Q-01
- **`app/(tabs)/carica.tsx`** (378 righe) scrive a mano la sequenza
  `firmaUpload → caricaFoto → avviaAnalisi → statoAnalisi`, **duplicata** alle righe
  149-152 e 224-227
- **`src/dati/chat.ts:46-47`** re-implementa la coppia `caricamento`/`inAttesa` invece di
  comporre `useRisorsa`: un'astrazione sorella dentro `dati/`
- **Nessuna CI iOS, e `apps/web` è un segnaposto** il cui `npm run dev` esce con 1
- **Le migrazioni saltano `0003` e `0004`**, come gli ADR saltano `0001`-`0003`: file
  rimossi, numerazione non compattata — e non va compattata
