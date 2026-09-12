# PROGRESS — lo stato reale del progetto

> **Questo file è l'unica fonte su cosa è implementato.** Non dedurre lo stato dalla
> presenza di un file: un handler con il nome giusto può rispondere sempre 501, e un
> modulo citato da un ADR può non esistere più. Prima di dare per esistente — o per
> inesistente — qualunque cosa, si apre questo file.

**Ultimo aggiornamento:** 2026-09-12

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

Le rotte reali sono 25, nella tabella `ROTTE` di `src/handlers/local_server.py:51`.

- [x] `GET /salute` — riporta la versione dai metadati del pacchetto. *Verificato a ogni
      deploy da `api.yml`, step «Verifica salute e versione servita»: è l'unica riga di
      questo file che una macchina ricontrolla da sola.*
- [x] `POST /auth/accedi`, `POST /auth/registrati` — JWT autofirmato, bcrypt, allowlist
      `EMAIL_AMMESSE` fail-closed. *coperto da `tests/handlers/test_handlers.py`:
      allowlist vuota, email fuori lista, 409, password corta, normalizzazione. In più
      provato con richieste vere in locale e contro il server pubblico — dichiarato in
      README al 2026-09-08, non rieseguito dopo.*
- [x] `GET /capi`, `GET|PATCH /capi/{id}`, `POST /capi/{id}/indossato`,
      `GET /armadio/riepilogo` — *coperto da `test_handlers.py`: filtro, ricerca
      testuale, URL firmate, 404 e 422 compresi*
- [x] `GET|POST /chat`, `GET /chat/conversazioni`, `GET|DELETE /chat/conversazioni/{id}`
      — ADR 0006, migrazione `0009`. *coperto da `test_chat_handler.py`*
- [x] `GET|POST /outfit`, `GET /outfit/{id}/colori` — *coperto da `test_handlers.py`,
      compreso il rifiuto di un outfit non indossabile*
- [x] `GET|PUT /profilo` — *coperto da `test_handlers.py`, creazione al primo accesso compresa*
- [x] `POST|GET /segnalazioni`, `PATCH /segnalazioni/{id}` — amministratori da
      `EMAIL_AMMINISTRATORI`, fail-closed. *coperto da `test_handlers.py`: chi vede cosa, il 403 di chi non è
      amministratore, il 404*
- [x] `POST /foto/upload` — URL firmata, la PUT la fa l'app. *coperto da `test_handlers.py`: la firma e il
      rifiuto di un tipo non immagine*
- [~] `POST /capi/analisi` + `GET /capi/analisi/{id}` — la pipeline a due fasi gira e
      riporta il motivo del fallimento, ma **nessun modello è mai stato interrogato
      davvero**: manca una chiave (vedi «Cosa manca dall'esterno»)
- [~] `POST /suggerimenti` — risponde `503 provider_non_configurato` senza credenziali,
      non 500. Il prompt di `domain/stylist.py` non è mai stato visto all'opera
- [~] Scontorno foto (`adapters/scontorno/fal_provider.py`) — passo facoltativo di
      `handlers/analisi.py`, **mai esercitato dai test**, non collegato a nessuna ricostruzione 3D

## App (`apps/mobile`)

16 file rotta sotto `app/` (`index.tsx` è uno smistatore). **Nessuna di queste schermate
è mai stata toccata con un dito su un telefono vero.**

- [!] `accedi.tsx`, `registrati.tsx`, il redirect di `index.tsx`, il guard delle tab, il
      logout — **bloccati da: una prova su dispositivo reale.** Hanno passato solo `tsc`
      ed `expo lint`. Il primo `npm run mobile` è anche la prima prova del percorso
      completo: registrazione → armadio vuoto → primo capo
- [~] `(tabs)/armadio.tsx`, `(tabs)/carica.tsx`, `(tabs)/oggi.tsx`, `(tabs)/profilo.tsx`,
      `capo/[id].tsx` — *provate contro il backend vero in locale, commit `709e11c`
      (2026-09-08), ma non su un telefono, e non rieseguite da allora*
- [~] `chat.tsx`, `calendario.tsx`, `outfit.tsx`, `suggeritore.tsx`, `preferenze.tsx`,
      `intro.tsx`, `segnalazioni.tsx` — **manca una prova su un dispositivo**: esistono
      e passano `tsc` ed `expo lint`, ma nessuno le ha mai aperte. `[x]` significa
      «verificato», e non lo sono
- [~] `(tabs)/avatar.tsx` — sagoma SVG tinta dai colori dominanti. È il **ripiego
      dichiarato dall'ADR 0004**, non il 3D che l'ADR descrive: il manichino che vestiva
      foto vere è stato rimosso col playground e non ne resta codice
- [x] Test automatici dell'app — leggibilità del testo sul fondo dipinto e
      convenzioni delle primitive, `style` e prop `sfondo`. *Verificato con
      `npm run mobile:test`: verdi, e il gate colto davvero due volte — la
      violazione di PR #4 reintrodotta in `avviso.tsx`, e una `<Scheda
      sfondo={colori.inchiostro}>` senza `su` in `calendario.tsx`, che fa
      passare la suite a «1 failed» indicando file e riga*

## Contratti (`packages/contracts`)

- [x] Generati da `domain/models.py`; `contracts:check` blocca in CI il disallineamento.
      *Verificato anche al contrario, rinominando un campo nel backend per vedere la CI
      cadere — dichiarato in README al 2026-09-08. Rieseguito il 2026-09-11:
      `npm run contracts:check` verde.*

## Infrastruttura e rilascio

- [x] VPS Hetzner, Caddy, Let's Encrypt emesso al primo avvio, dominio reale. Deploy
      automatico da `api.yml` con verifica della versione servita — *dichiarato in
      README al 2026-09-08; il deploy si riverifica da solo a ogni merge sul backend*.
      Dettagli in `docs/deploy.md`
- [x] Build EAS Android + GitHub Release automatiche da `mobile.yml` — *dichiarato
      in README al 2026-09-08*. L'URL dell'APK che EAS restituisce passa da `env:`
      e viene controllato (schema e dominio) prima di essere seguito: è un dato,
      non un frammento di comando. *Verificato eseguendo lo script dello step
      estratto dal YAML, con `curl` sostituito da uno stub — e al contrario, con
      la forma precedente, che il comando iniettato lo esegue davvero. Lo step
      vive nel job `release`: la prima esecuzione vera è il prossimo rilascio.*
- [x] Bump di versione dai conventional commit (ADR 0005), `pr-title.yml` che lo
      protegge — *ADR 0005 lo documenta; i 22 tag del repo ne sono la traccia*
- [x] I quattro hook di `.claude/hooks/` sono esercitati da un banco di prova,
      nel job `hook` di `docs.yml` (che non ha filtri sui path). *Verificato con
      `python3 scripts/prova-hook.py`: verde, e rosso sui sei difetti che il
      banco è nato per fissare — tre migrazioni corrette che venivano negate e
      tre rotte che passavano. Comprende le sette migrazioni vere del repo, così
      un pattern nuovo troppo largo si vede subito*
- [x] La soglia di coverage aggregata non nasconde più le due per sottoalbero:
      è l'ultimo step, non il primo. *Verificato in locale eseguendo i tre
      `coverage report` nell'ordine del workflow: dominio, handler e totale
      tutti sopra la propria soglia, uscita 0. I numeri stanno in
      `docs/TEST_COVERAGE.md`, che è il posto dove è lecito scriverli*
- [x] Il permesso di scrivere sul repo lo chiede **solo il job che rilascia**:
      `contents: read` alla radice di `api.yml` e `mobile.yml`, `write` dentro
      `deploy` e `release`; i checkout dei job che eseguono il codice della PR
      non persistono credenziali. *Verificato parsando i quattro YAML e
      stampando permessi e `with:` di ogni checkout job per job — `write` su due
      job soli, `persist-credentials: false` sui cinque checkout non pushanti e
      su nessuno dei due che pushano. Poi in CI sulla PR #16: i sei job passano, e
      nel job `hook` — quello che poteva perderci qualcosa — il checkout porta
      `main -> origin/main` anche senza credenziali, e la prova «file già su
      main» risulta girata e non saltata. I due job che pushano girano solo su
      `main`, quindi la loro prima esecuzione vera è il prossimo rilascio*
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

Si sono trasferiti in **[`docs/DA_FARE.md`](DA_FARE.md)**, insieme a tutto il
resto del lavoro identificato e non fatto.

Il motivo: un debito con un rimedio noto *è* un task, e tenerlo in due file
significa tenerlo allineato in due file. Qui resta lo **stato** — cosa esiste e
come è stato verificato — e basta.

Le voci che erano qui sono `T-18` … `T-23`.
