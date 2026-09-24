# PROGRESS — lo stato reale del progetto

> **Questo file è l'unica fonte su cosa è implementato.** Non dedurre lo stato dalla
> presenza di un file: un handler con il nome giusto può rispondere sempre 501, e un
> modulo citato da un ADR può non esistere più. Prima di dare per esistente — o per
> inesistente — qualunque cosa, si apre questo file.

**Ultimo aggiornamento:** 2026-09-23

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
- [x] Test automatici dell'app — leggibilità del testo sul fondo dipinto,
      convenzioni delle primitive (`style` e prop `sfondo`), e nessun colore
      composto a mano (`rgba()`/esadecimale) fuori da `tema/tokens.ts` e
      `dati/dominio.ts`. *Verificato con `npm run mobile:test`: verdi, e i
      gate colti davvero fallire più volte — la violazione di PR #4
      reintrodotta in `avviso.tsx`, una `<Scheda sfondo={colori.inchiostro}>`
      senza `su` in `calendario.tsx`, e (2026-09-13, T-19/T-20) un
      `rgba(21,21,26,0.4)` reintrodotto in `calendario.tsx:99` — in tutti e
      tre i casi la suite indica file e riga, e torna verde dopo il
      ripristino*
- [~] **La palette del redesign «Aura»** — i token di colore vengono dal deck
      `~/wardrobe-schermate/`, nominati per ruolo (`primario`, `inchiostro`,
      `scheda`, `pericolo`); `ambra`/`crema`/`corallo` non esistono più, e con
      l'ambra è caduta la regola che la riservava all'IA (riscritta nelle sue
      tre copie: `tokens.ts`, `CLAUDE.md`, `.claude/rules/react-native.md`).
      Nuovi: `superfici.vetro*`, `fondi` (le quattro tavolozze), `SfondoAura`
      in `ui/guscio.tsx`, la variante `vetro` di `Scheda`, la variante
      `accento` di `BottonePrimario` al posto di `ambra`.
      *Verificato:* `typecheck`, `lint`, `mobile:test` e `build:web` verdi; e
      **che il fondo si dipinga davvero** servendo `dist/` e caricando
      `/accedi` con Chrome headless — nel DOM ci sono i due `radialGradient`
      con gli stop della tavolozza neutra (`#D2D6E6`, `#8598FF`) e il
      `linear-gradient(169.951deg, …)`, cioè i 170° del deck, senza errori JS.
      Lo screenshot mostra il gradiente e l'alone in alto a sinistra.
      *Il difetto che il gate non poteva prendere, e come è stato trovato:*
      ovunque l'ambra (chiara) portava testo inchiostro, il primario (scuro) lo
      avrebbe portato ancora — pillola attiva, badge, bolle, bottone tondo, il
      «+» della barra. `leggibilita.test.tsx` confronta l'**identità di un
      token**, non un rapporto di contrasto: sarebbe rimasto verde per sempre.
      Trovato calcolando i contrasti a mano (3.6:1 contro i 9.7:1 di prima), poi
      corretto nel codice; solo a quel punto il gate è diventato rosso sulla
      coppia vecchia, e l'asserzione è stata riscritta **dopo** il codice.
      **Cosa manca:** le schermate sono ancora disposte come prima — questa
      riga riguarda i colori e il fondo, non le 43 schermate del deck. E
      **nessuna prova su un telefono**: il web dimostra che l'SVG renderizza,
      non come si vede il vetro su un pannello vero.
- [~] **L'armadio sulla disposizione del deck** — `(tabs)/armadio.tsx` con
      griglia a tre colonne quadrate, due righe di filtri (categoria + qualità,
      un filtro per dimensione), `CasellaAggiungi` dentro la griglia, conteggio
      sotto, due stati vuoti distinti, fondo `freddo`. Nuove in `ui/capi.tsx`:
      `CapoInGriglia` riscritta (vetro, `contain`, cuore, nome sotto) e
      `CasellaAggiungi`; `Pillola` ha la variante `compatta`.
      *Verificato:* `typecheck`, `lint`, `mobile:test` e `build:web` verdi.
      **E un difetto pre-esistente trovato e chiuso** (`T-37`): `griglie.mese`
      non ci stava in nessuno schermo esistente e il calendario mostrava sei
      giorni per riga — `test/convenzioni/griglie.test.ts` adesso lo impedisce,
      ed è stato **visto fallire davvero** col valore vecchio, su tutte e sette
      le larghezze provate.
      **Il segmento «Capi | Outfit» c'è** (scelta dell'utente del 2026-09-22,
      `Q-09`): gli outfit sono una vista dell'Armadio come nel deck, e
      `/outfit` **resta** come rotta per il rimando dal Profilo e per i link
      diretti. Le due mostrano lo stesso `ElencoOutfit` (`ui/capi.tsx`) — una
      lista sola, non due copie. `SchedaOutfit` è nella forma del deck (tessere
      quadrate di vetro, `contain`) e `ScheletroSchedaOutfit` è stato rifatto
      sulle stesse misure di `griglie.outfit`.
      *Verificato:* `typecheck` exit 0, `lint` 0 errori, `mobile:test` 40
      passati su 5 suite, `build:web` esportato.
      **Cosa manca:** **nessuna prova su un telefono** — che la griglia entri
      lo dice il conto, non l'occhio; che il vetro non mangi il testo, il conto
      non lo dice.
- [~] **Il dettaglio di un capo sulla disposizione del deck** —
      `app/capo/[id].tsx`: il cuore e il **menu «···»** nella testata (nuovo
      slot `azioni` su `Testata`/`Schermata`), la foto in `contain` invece che
      tagliata, i **tre** stati come pillole, «Provalo addosso», fondo
      `freddo`. Nuova primitiva `Foglio` in `ui/avviso.tsx` — il foglio che
      sale dal basso — dove **una voce senza azione è spenta e dice perché**,
      non viene omessa: tre delle cinque voci del deck non hanno un backend
      (rifare la foto, «non suggerirlo più», eliminare) e si vedono spente con
      la ragione sotto. Tre icone nuove dal deck: `altro`, `occhioSpento`,
      `cestino`.
      *Verificato:* `typecheck` exit 0, `lint` 0 errori, `mobile:test` 42
      passati su 5 suite, `build:web` esportato. `Foglio` ha **due casi suoi**
      in `test/ui/leggibilita.test.tsx`, **visti fallire per davvero**: uno se
      la sua scheda smette di asserire il fondo chiaro sotto il velo, l'altro
      se il «perché» di una voce spenta scende al tono dell'interfaccia
      inattiva.
      **E un secondo difetto pre-esistente trovato e chiuso** (`T-41`):
      `in_lavaggio` era nell'enum, in `ETICHETTE` e nel filtro dell'armadio, ma
      **nessun punto dell'app lo impostava** — un interruttore solo rimbalzava
      fra due valori su tre. Verificato col grep che questa era l'unica
      schermata a chiamare `cambiaStato` su un capo.
      **Cosa manca:** «Mettilo in un outfit» non è nel menu — nell'app farebbe
      esattamente ciò che fa «Provalo addosso» lì sopra.
- [~] **La barra delle schede sopra tutto** (`T-40`) — `BarraSchede` vive in
      `ui/guscio.tsx` e sta in `app/_layout.tsx`, non più nella prop `tabBar`
      di `<Tabs>`: prima esisteva **solo dentro** il gruppo `(tabs)`, quindi
      sul dettaglio di un capo, in chat e sul calendario non c'era affatto. Ora
      c'è, con accesa la scheda da cui ci si è arrivati, e il «+» porta a
      «Carica» da ovunque. La prop `tab` di `Schermata` è stata **tolta**: lo
      spazio in fondo lo decide la stessa `schedaDi()` che decide la barra —
      una fonte invece di cinque promemoria.
      *Verificato:* `typecheck` exit 0, `lint` 0 errori, `mobile:test` 57
      passati su 6 suite, `build:web` esportato. Il gate nuovo
      (`test/convenzioni/navigazione.test.ts`) **visto rosso per davvero**
      capovolgendo la mappa in «tutto tranne»: cinque casi rossi, fra cui
      `/accedi` e il banco 3D.
      **Cosa manca:** **nessuna prova su un telefono** — che la barra non copra
      il contenuto in fondo a una schermata spinta lo dice il conto di
      `altezzaBarra()`, non l'occhio.
- [~] **Il percorso della foto** (fase 3) — `src/dati/foto.ts` raccoglie la
      sequenza di caricamento e analisi che era scritta a mano in **tre** punti
      (`T-21`, chiusa): `carica.tsx` due volte e `archivio.tsx` una a metà.
      La coda dà a **ogni foto la sua riga** (`RigaFotoInCoda`, la schermata
      `upload` del deck) col proprio esito e il proprio motivo; prima i falliti
      erano un numero in un coriandolo e non si sapeva *quale* rifare. Un
      fallimento non è più un coriandolo ma una schermata, e il «Riprova»
      **non ricarica la foto** — riparte da `avviaAnalisi` sulla chiave che è
      già sul server. Nuove: `app/guidafoto.tsx` (che assorbe le due righe di
      testo minuto in fondo a Carica) e `app/darivedere.tsx` (che finalmente
      usa `attributiIncerti()` per fare un elenco, invece di farlo scoprire un
      capo per volta). `PistaIndeterminata` estratta da `AttesaLunga`, perché
      ora la usano in due.
      *Verificato:* `typecheck` exit 0, `lint` 0 errori, `mobile:test` 57
      passati su 6 suite, `build:web` esportato. La duplicazione è davvero
      sparita: un grep per `firmaUpload|avviaAnalisi|statoAnalisi` su `app/` e
      `src/` non trova più nessuna chiamata fuori da `api.ts` e `foto.ts`. Il
      gate della navigazione **visto rosso per davvero** su una delle due rotte
      nuove, prima di deciderla.
      **Cosa manca:** due schermate del deck non sono state fatte perché non
      hanno un evento dietro — `errore` («non riesco a staccare lo sfondo»: lo
      scontorno che fallisce è ingoiato di proposito, ADR 0004) e la metà di
      `analisiko` che promette «è già al sicuro nell'armadio» (falso: un'analisi
      fallita non salva niente) con «compila a mano» (non esiste `POST /capi`).
      Il tentativo **automatico** quando il servizio torna è `T-42`: chiesto,
      non fatto, e **non scritto in interfaccia** finché non c'è. E nessuna
      prova su un telefono, che qui pesa: la pista per riga è un'animazione.
- [~] **Gli stati di «Oggi», e il permesso spiegato** (fase 4, prima fetta) —
      `SenzaRete` («non ti raggiungo») e `SlotMancanti` («mi manca un pezzo»)
      sono **stati**, non rotte: vivono dentro `(tabs)/oggi.tsx`, che li
      distingueva già dal 13 settembre. `SenzaRete` nasce da
      `erroreCaricamento`, **non** da un rilevatore di rete: nessuna dipendenza
      nuova, e soprattutto una spia di rete direbbe «il wifi è acceso» mentre
      il server è giù. La spiegazione del permesso foto compare **al primo
      tocco** su «Scatta»/«Dalla galleria» e solo se il sistema dice
      `undetermined`: niente flag da salvare, e la richiesta vera resta al
      punto d'uso.
      *Verificato:* `typecheck` exit 0, `lint` 0 errori, `mobile:test` 57
      passati su 6 suite, `build:web` esportato.
      **Cosa manca:** `legale` **non è stata fatta** e non va fatta così com'è
      (`D-08`: tre delle quattro affermazioni del deck non reggono al codice, e
      i quattro documenti non esistono). `aiuto` e il terzo passo di `intro`
      aspettano due decisioni dell'utente. E nessuna prova su un telefono.
- [~] **Le impostazioni, e le prime misure del corpo** (fase 4, seconda fetta) —
      `app/impostazioni.tsx` raccoglie in tre gruppi le nove voci del deck;
      quelle che non funzionano si vedono **spente col motivo**, e il motivo è
      scritto per chi tiene il telefono («un capo non si può ancora
      eliminare»), non per chi legge `DA_FARE.md` («manca la rotta DELETE») —
      la prima stesura sbagliava file, e lo stesso errore era già in
      `capo/[id]`. `app/misure.tsx` è la prima voce **viva** delle due che
      erano solo dichiarate: `Profilo.misure` porta sistema di taglie, taglia,
      altezza, corporatura, spalle e lunghezza gamba. Nessuna migrazione —
      `profili.dati` è `jsonb`. Gli estremi (`LIMITI_MISURE_CM`) stanno nel
      dominio, li leggono **sia** i `Field` di Pydantic **sia** il campo
      dell'app: una fonte, non due — e per farceli passare il **generatore** è
      stato allargato di una riga (`JSON.stringify` al posto
      dell'interpolazione): `COSTANTI` reggeva solo scalari, e un oggetto
      sarebbe finito in `runtime.ts` come `[object Object]` **senza che niente
      fallisse**. È l'unico diff di questa fetta sotto `packages/contracts/`
      che non è output del generatore, e sta in `scripts/`, che
      `.claude/rules/contratti.md` non vieta; `contracts:check` lo difende da
      solo, perché rimettendo l'interpolazione il committato non coincide più
      con la rigenerazione. `RigaImpostazione` prendeva tre colori da
      `testoSu.chiaro` fisso pur non dipingendo nulla — la forma esatta di
      PR #4; ora li deriva dal fondo ereditato.
      *Verificato:* `api:lint` «All checks passed», `api:test` 166 passati,
      `api:cov` 73,99% sopra la soglia di 73 (`handlers/profilo.py` passa a
      100%: `PUT /profilo` non aveva **nessun** test prima), `contracts:check`
      «contratti allineati», `typecheck` exit 0, `lint` 0 errori,
      `mobile:test` 59 su 6 suite, `build:web` esportato. Il diff generato è
      stato **letto** e non subìto: nessun `Misure1`/`Taglia1`. Il caso nuovo
      di `leggibilita.test.tsx` **visto rosso per davvero** rimettendo il
      colore fisso (atteso `rgba(255,255,255,0.4)`, ricevuto
      `rgba(21,24,31,0.45)`).
      **Cosa manca:** le altre sei voci di impostazioni restano spente —
      **Unità** è la prossima e ora ha senso (prima non c'era una misura da
      formattare); **Elimina l'armadio** è distruttiva e non va collegata senza
      un sì esplicito. Il deck mette le quattro misure come quattro schermate
      di scelta, qui stanno in linea: divergenza di forma, dichiarata nel
      docblock. Quali corporature e quali sistemi di taglie oltre alle lettere
      è `D-09`, e il lavoro conseguente `T-44`. E **nessuna prova su un
      telefono**: i quattro comandi non dimostrano che una tastiera numerica si
      apra, né che la scheda del «tuo corpo» non mangi il testo.
- [~] **«Unità»: un gruppo, non tre** (fase 4, terza fetta) — `app/unita.tsx`.
      Il deck ne governa tre; **due qui non comandano niente**: non esiste
      nessun campo peso in tutto il dominio (e il deck stesso scrive «non te lo
      chiedo», cioè descrive un dato che non chiede mai), e la temperatura vale
      solo col meteo, che il backend riceve come `Meteo` ma non è mai andato a
      prendere. La scelta vive sul **profilo** (`Profilo.unita_lunghezza`, su
      richiesta esplicita dell'utente): segue la persona fra dispositivi invece
      che restare sul telefono. Default `cm` e non `None`, così ogni profilo
      salvato prima del campo lo riceve leggendolo — **nessuna migrazione, e
      nessun ramo «non scelto»** da gestire in ogni punto che mostra una
      lunghezza. La conversione sta in `src/dati/dominio.ts` e avviene
      **all'ultimo momento**: si salva sempre in centimetri, quindi cambiare
      unità non riscrive nessun dato e non perde precisione a ogni giro.
      *Verificato:* `api:lint` «All checks passed», `api:test` 168 passati,
      `contracts:check` «contratti allineati», `typecheck` exit 0, `lint` 0
      errori, `mobile:test` 69 su 7 suite. Il gate nuovo
      (`test/dati/misure.test.ts`) **visto rosso per davvero** invertendo
      l'arrotondamento dei limiti: atteso `>= 120`, ricevuto `119` — cioè
      esattamente il campo che accetta ciò che il server rifiuta.
      **Cosa manca:** i pollici si mostrano come numero semplice (`66″`), non
      in piedi e pollici: una sola casella invece di due, coerente con le altre
      due misure che in piedi non si dicono. E **nessuna prova su un
      telefono** — vale per questa fetta come per la precedente.
- [~] **«Scarica i tuoi dati»** (fase 4, quarta fetta) — uno zip con
      `dati.json` (capi, outfit, profilo e misure, conversazioni intere coi
      loro turni, segnalazioni), le **foto vere** dentro, e un `LEGGIMI.txt`.
      **La voce non è del deck**: il deck la nomina solo come promessa in
      `impprivacy` («puoi scaricare tutto… senza scrivere a nessuno») e come
      rimando in `impelimina`; nessuna schermata la disegna.
      **Il problema non era produrre i dati ma consegnarli**: un'app React
      Native non ha un «scarica». Il giro è in due tempi — `POST
      /esportazione` col JWT firma un URL HMAC a **900 secondi** legato a
      quell'utente, e il **browser di sistema** lo apre. `expo-sharing` darebbe
      il foglio di condivisione nativo ed è stato **escluso**: è una
      dipendenza in più su un lock che qui ha già fatto male tre volte (`T-03`,
      `T-23`, `T-31`) — la stessa risposta data a `expo-blur` nel piano.
      **Niente viene salvato**: l'archivio si compone alla richiesta. La strada
      facile — scrivere lo zip nell'archivio foto e firmarne l'URL —
      lascerebbe una copia completa dei dati di una persona in giacenza, senza
      scadenza e senza niente che la ripulisca, e la prossima voce è «Elimina
      l'armadio»: una cancellazione che non trovasse quelle copie mentirebbe.
      Le due firme (foto ed esportazione) usano lo **stesso `JWT_SECRET`**:
      senza separazione di contesto una firma emessa per la foto di chiave
      `demo` sarebbe bit per bit una firma d'esportazione per l'utente `demo`,
      cioè un'escalation silenziosa da «vedo una miniatura» a «scarico tutto».
      Da qui il prefisso in `_CONTESTO`, col separatore a byte NUL — che una
      chiave di foto, essendo un pezzo di percorso, non può contenere.
      Il ramo in `local_server.py` fa **due cose sole** (verifica e scrive)
      perché quel file è l'unico escluso dal conto della coverage degli
      handler: tutto ciò che stesse lì sarebbe non provato per costruzione.
      `RigaImpostazione.perche` è diventata `nota` e si mostra **anche a riga
      accesa**: questa riga apre un browser, e farlo senza preavviso è una
      sorpresa.
      **`security` l'ha auditata prima che fosse dichiarata finita**, come
      impone `CLAUDE.md` per qualunque cosa esposta di nuovo, e ha trovato una
      catena **alta** che non nasce qui ma che questa fetta avrebbe reso
      sfruttabile: `POST /capi/analisi` accetta una `chiave_foto` dal corpo
      **senza controllare di chi sia** (`T-47`), e con `T-46` si arriva a
      sovrascrivere la foto di un altro. L'esportazione non la allarga:
      `senza_campi_interni` toglie dal `dati.json` anche le **chiavi
      d'archivio**, che per chi apre lo zip non valgono niente — le foto si
      riappaiano dall'id del capo — e per chi le ottiene valgono parecchio.
      Corrette nella stessa passata altre tre cose sue: il log stampava la
      query **con la firma dentro** (`docker logs` conteneva credenziali vive,
      e rendeva falsa una riga del `LEGGIMI.txt`); il ramo di verifica stava
      fuori da `@endpoint` e tre ingressi — `scade=²`, che `isdigit()` accetta
      e `int()` no; una `firma` non-ASCII, su cui `compare_digest` fra `str`
      solleva; un intero da 5000 cifre — **uccidevano il thread** invece di
      dare 403; e il commento di `_CONTESTO` motivava la separazione con una
      proprietà delle chiavi che nessuno impone (la separazione vera viene
      dalla forma dei due messaggi, ed è scritta lì adesso).
      *Verificato:* `api:lint` «All checks passed», `api:test` **198**
      passati, `api:cov` sopra la soglia di 73,
      `contracts:check` allineati, `typecheck` exit 0, `lint` 0 errori,
      `mobile:test` 69 su 7 suite. Prima di scrivere, due controlli:
      `local_server.py` **è** la produzione (`CMD ["python", "-m",
      "handlers.local_server"]`) ed è `ThreadingHTTPServer`, quindi uno zip
      lento non blocca le altre richieste; Caddy proxya l'host senza filtri di
      path, quindi la rotta nuova passa.
      **Provato anche a mano**, perché i quattro comandi non vedono il giro
      vero: server in memoria (`DATABASE_URL` vuota), registrazione, profilo
      con misure, `POST /esportazione`, e poi il download **senza token** con
      `curl` al posto del browser — `200`, `content-type: application/zip`,
      `content-disposition: attachment; filename="aura-i-tuoi-dati-2026-09-23.zip"`,
      e dentro il `dati.json` giusto. Poi i sei modi di non doverci riuscire:
      senza firma `403`, firma inventata `403`, `utente=` cambiato a mano
      `403`, `scade=` spostato in avanti `403`, `POST` senza token `401`, e —
      il caso che il prefisso di contesto esiste per fermare — una **firma di
      foto** calcolata per la chiave uguale all'id utente, riusata come firma
      d'esportazione: `403`. Non solo nel test unitario: contro il server.
      Rifatto **dopo** le correzioni dell'audit, e con in più i tre ingressi
      che uccidevano il thread (tutti `403`), la prova che il `dati.json` non
      contiene né `firma=` né chiavi d'archivio, e che nel log del server non
      compare più nessuna firma.
      Quattro gate nuovi **visti rossi per davvero**: con una chiave di foto
      sbagliata cadono i quattro test dell'archivio; togliendo lo scrub il
      `dati.json` torna a contenere `firma=`; rimettendo `isdigit()` e il
      confronto su `str` tornano le tre eccezioni esatte che l'audit aveva
      previsto.
      **Cosa manca:** nessuna prova su un telefono, e nessuna con un browser
      reale (curl non è un browser: non prova che il file finisca dove
      l'utente lo ritrova). **Il confine vero — `utente` dalla query →
      verifica → archivio di quell'utente — non ha un test automatico**: vive
      in `local_server.py`, escluso dalla coverage. La verifica a mano copre i
      casi giusti ma non riparte da sola; `utente_da_query` è stata spostata
      nel dominio proprio per ridurre a due righe ciò che resta scoperto.
      L'indirizzo firmato è **una credenziale al portatore**, rigiocabile e non
      revocabile: `Q-12`, **chiusa** — va bene così, perché oggi l'app la
      scarica il socio da un link di GitHub e quel costo cresce col numero di
      account. Con `T-46` e `T-47` condivide la condizione di riapertura, che
      è una variabile e non una data: **quando `EMAIL_AMMESSE` smette di essere
      una lista di persone che si conoscono**. `write_timeout 150s` nel `Caddyfile` è il tetto: un armadio molto grande
      potrebbe non farcela, e non c'è niente che lo dica all'utente. E l'app
      non offre nessuna alternativa se il sistema non ha un browser: lo dice e
      basta.
- [~] **«Svuota l'armadio»: l'unica operazione che distrugge davvero**
      (fase 4, quinta fetta) — `POST /armadio/svuota` e `app/svuota.tsx`.
      Il deck ne faceva **una** operazione sola che portava via anche
      l'account; l'utente l'ha spezzata in due, e questa è la prima.
      **Porta via** capi con le loro foto, outfit, conversazioni coi loro
      turni, e il diario degli usi. **Non tocca** il profilo — misure,
      preferenze, foto dell'avatar: scelta dell'utente del 2026-09-23, chi
      svuota per ricominciare non deve reinserire la propria altezza — né
      l'account, né le segnalazioni, che hanno un lato amministratore.
      **Due difese, non una.** La parola «SVUOTA» da scrivere è
      nell'interfaccia *e* nel contratto (`RichiestaSvuotamento.conferma` è un
      `Literal`, quindi il tipo TypeScript la contiene e non si ridigita): la
      prima difende dal tocco distratto, la seconda da un deep-link, da un
      `curl` ricopiato e da una richiesta rimandata due volte dalla libreria di
      rete — cose a cui un campo di testo non sopravvive.
      **Le foto si cancellano per prefisso** (`capi/{utente}/`), non per
      l'elenco delle chiavi memorizzate: `T-47` permette a un capo di puntare
      al file di un altro, e cancellare per elenco avrebbe trasformato quel
      difetto in «cancello i file di un altro» dentro l'unica operazione
      irreversibile che abbiamo. Un prefisso non può uscire da sé stesso. Prende
      anche le foto caricate e mai diventate capo, che un elenco lascerebbe lì
      per sempre. La foto dell'avatar sta sotto lo **stesso** prefisso ma resta:
      si esclude per chiave, e l'esclusione cade dalla parte sicura — al
      massimo protegge un file di troppo.
      **La schermata ha due elenchi dove il deck ne ha uno**: davanti a
      qualcosa che non torna, dire cosa sparisce non basta — chi legge deve
      sapere cosa resta, altrimenti se lo immagina peggio. I numeri sono veri
      (store per capi e outfit, `useRisorsa` per le conversazioni).
      *Verificato:* `api:lint` «All checks passed», `api:test` **213** passati,
      `api:cov` sopra soglia, `contracts:check` allineati, `typecheck` exit 0,
      `lint` 0 errori, `mobile:test` 69 su 7 suite, `build:web` esportato.
      **E soprattutto contro un Postgres vero**, perché i test in memoria non
      possono dire niente sulla riga che conta: lì lo stato è già partizionato
      per utente (`dict[utente][id]`), mentre in SQL un ambito dimenticato è
      una `where` mancante che svuota la tabella. Container usa-e-getta su una
      porta dedicata (mai quello di `db:up`), due utenti popolati, svuotato
      uno: `alfa (0,0,0,0)` e `beta (3,1,1,1)`, e il conto riga per riga su
      tutte e cinque le tabelle con `alfa=0` e i totali di beta interi. Provata
      a mano anche la cancellazione **su disco vero** — `capi/alfa-bis/`
      sopravvive a `capi/alfa/`, l'avatar escluso resta leggibile **col suo
      `.contenttype`**, e una risalita `../../../etc` solleva — e poi fissata
      in `tests/adapters/test_archivio_filesystem.py`, perché una prova a mano
      non riparte da sola.
      Il gate dello slash finale **visto rosso per davvero**: tolto da
      `prefisso_foto`, l'utente `demo-bis` perde le foto per mano di `demo`.
      **Cosa è stato corretto dalla verifica:** il conto si chiamava
      `giorni_di_uso` e contava coppie **capo × giorno** — sei righe dove i
      giorni erano uno. Un nome che conta una cosa per un'altra è una bugia che
      nessun test prende, perché il numero è giusto: è l'etichetta a sbagliare.
      Ora è `usi_registrati`.
      **Cosa manca:** «Elimina l'account» resta spenta, ed è giusto — non manca
      la rotta, manca la decisione su cosa comporti, «anche in base a policy e
      privacy». E **nessuna prova su un telefono**: un campo che va scritto in
      maiuscolo e un bottone distruttivo sono esattamente ciò che una tastiera
      vera può rendere scomodo.
- [~] **L'apertura: `intro` a tre passi, `accedi`, `registrati`** (fase 4, la
      metà che mancava) — **e mancava davvero**. La fase 4 del piano diceva
      «onboarding, profilo, impostazioni»: delle prime tre fette è stata fatta
      solo la seconda parte, e nessun rapporto l'ha detto. In `intro.tsx` il
      redesign aveva cambiato **tre righe**, tutte lo stesso colore di un
      pallino; la prima schermata dell'app scriveva ancora «wardrobe». Se ne è
      accorto l'utente aprendo l'APK, non un gate.
      `app/intro.tsx` riscritta sui tre passi del deck: `welcome` con la
      **giostra**, `provalo` con l'omino e le due targhette, `chiedi` con le
      due battute di chat e la proposta a tre tessere, una tratteggiata.
      La giostra (2026-09-23) ha preso il posto della stanga di capi appesi,
      bocciata dal committente per le immagini: otto `Scheda` opache in cerchio,
      un giro in 60 s lineare col driver nativo, e ogni tessera controruota per
      restare dritta. Il cerchio si misura sul lato **corto** della scena:
      sugli schermi bassi comanda l'altezza, e lì si rimpicciolisce (tessere di
      ~30 pt a 320×568, ~50 a 360×640, ~90 a 390×844 — scelta dell'utente). Le
      otto foto sono scontornate: sei sono capi generati dall'utente con
      Gemini, due (giacca e borsa) sono foto senza fonte, montate per scelta
      dell'utente come eccezione dichiarata (`T-49`). Provenienza, lavorazione e
      scarti in `assets/intro/FONTI.md`.
      *Verificato:* `typecheck` exit 0, `lint` 0 errori, `mobile:test` 69,
      `build:web`, e scatti reali della build a 0, 7 e 15 s su 320×568,
      360×640, 375×667 e 390×844 (Chrome headless pilotato via CDP, con attese
      vere: i fotogrammi differiscono fra 47 mila e 246 mila pixel, quindi gira
      davvero). Guardati uno per uno: nessuna tessera esce dallo schermo,
      nessun capo capovolto.
      Le immagini dei passi 2 e 3 **vengono dal deck**, copiate in
      `assets/intro/`: non sono sagome ridisegnate, sono gli stessi file.
      `accedi` e `registrati` prendono l'occhiello del deck («IL TUO ARMADIO TI
      ASPETTA», «PASSO 1 DI 3»), il «Mostra» sulla password (`Campo` ha
      imparato `rivelabile`) e il piede con l'SSO e il recupero password —
      **spenti col motivo**, non tolti: chi non riesce a entrare e non vede
      «password dimenticata» pensa di aver sbagliato lui.
      «PASSO 1 DI 3» non è un'etichetta vuota: il primo accesso ora fa i tre
      passi veri, account → misure → stile. `misure.tsx` serve entrambe le
      strade con `?onboarding=1` (occhiello diverso, nessun «indietro», «Le
      inserisco dopo» al posto di «Cancella»); il segnale resta uno solo
      (`preferenzeViste`), perché è l'ultimo passo a chiuderli tutti.
      *Verificato:* `typecheck` exit 0, `lint` 0 errori, `mobile:test` 69,
      `build:web`. **E soprattutto guardandole**: `dist/` servita in locale e
      cinque screenshot a 390×844 con Chrome headless, confrontati col
      template del deck. È la classe di difetti che i quattro comandi non
      vedono — erano tutti verdi mentre la prima schermata diceva «wardrobe».
      Tre difetti visti solo così e corretti: le bolle di chat uscivano dai
      bordi, la targhetta «AVATAR 3D» usciva a destra, e le tessere dei capi
      erano **invisibili** (un velo bianco su una bolla già bianca).
      **Cosa diverge dal deck, di proposito:** la casella «Accetto i termini di
      servizio e l'informativa privacy» **non c'è**. È l'unico elemento il cui
      contenuto è un'affermazione che non possiamo sostenere — quei documenti
      non esistono (`D-08`), e una spunta obbligatoria che rimanda al nulla è
      peggio di una spunta assente. SSO e recupero password invece ci sono,
      spenti.
      **Cosa manca:** ancora nessuna prova su un telefono.
- [x] Una sola copia di React nel monorepo (`T-23`, chiusa): `react` e
      `react-dom` dichiarati anche in `dependencies` di root, alla versione
      esatta di `apps/mobile`. Il `jest.moduleNameMapper` che tamponava il
      conflitto solo dentro i test è stato tolto. *Verificato su
      un'installazione pulita (`npm ci` in un clone a parte): `npm ls react
      react-dom` mostra una copia sola in tutto l'albero e nessuna in
      `apps/mobile/node_modules/`; `npm run typecheck`, `npm run lint`,
      `npm run mobile:test` (verdi senza mapper, conteggio in
      `docs/TEST_COVERAGE.md`) ed `expo export --platform web` (`build:web`)
      tutti verdi. Non provato: l'avvio reale
      dell'app (`npm run dev:app`) su un dispositivo — nessun ambiente con
      Expo Go o emulatore disponibile in questa sessione*

## Contratti (`packages/contracts`)

- [x] Generati da `domain/models.py`; `contracts:check` blocca in CI il disallineamento.
      *Verificato anche al contrario, rinominando un campo nel backend per vedere la CI
      cadere — dichiarato in README al 2026-09-08. Rieseguito il 2026-09-11:
      `npm run contracts:check` verde.*

## Infrastruttura e rilascio

- [x] VPS Hetzner, Caddy, Let's Encrypt emesso al primo avvio, dominio reale. Deploy
      automatico da `api.yml` con verifica della versione servita — *dichiarato in
      README al 2026-09-08; il deploy si riverifica da solo a ogni merge sul backend*.
      **Quella verifica riguarda la sola versione del pacchetto**: `GET /salute` non
      interroga il database, e infatti non ha visto lo schema restare indietro (riga
      qui sotto). Dettagli in `docs/deploy.md`
- [x] Il deploy applica le migrazioni. Fino al 2026-09-16 non lo faceva nessuno: lo
      schema di produzione era fermo a `0006`, `conversazioni_chat` e `segnalazioni`
      non esistevano, e chat e segnalazioni rispondevano `500 errore_interno`
      sull'app dei tester mentre tre rilasci di fila passavano verdi. *Riparato dal
      vivo il 2026-09-16: dump del database prima, poi
      `applica_migrazioni.py` due volte di fila (secondo giro pulito, come impone
      `.claude/rules/migrazioni.md`); `\dt` mostra le 9 tabelle attese, i 22 messaggi
      di chat tutti con `conversazione_id` valorizzato dal backfill di `0009` e
      nessuno rimasto a `null`, `capi` e `utenti` invariati a 4 e 3. Poi, con un JWT
      vero emesso per un utente esistente, le sette rotte principali — comprese
      `/chat/conversazioni` e `/segnalazioni`, che prima erano 500 — rispondono tutte
      200.* **Non verificato**: lo step in `api.yml` che lo automatizza. La sua prima
      esecuzione vera è il merge della PR che lo introduce — `.github/workflows/api.yml`
      sta nel filtro `paths:` di sé stesso, quindi il workflow parte, e
      `bump-versione.mjs api --prova` dice `0.5.0 -> 0.5.1` (patch: nessun commit
      tocca `services/api`)
- [x] Build EAS Android + GitHub Release automatiche da `mobile.yml` — *dichiarato
      in README al 2026-09-08*. L'URL dell'APK che EAS restituisce passa da `env:`
      e viene controllato (schema e dominio) prima di essere seguito: è un dato,
      non un frammento di comando. *Verificato eseguendo lo script dello step
      estratto dal YAML, con `curl` sostituito da uno stub — e al contrario, con
      la forma precedente, che il comando iniettato lo esegue davvero. Lo step
      vive nel job `release`: la prima esecuzione vera è il prossimo rilascio.*
- [!] **La build EAS in cloud è bloccata dalla quota del piano gratuito Expo**: dal
      2026-09-23 il job `release` cade allo step «Build Android preview», dopo aver già
      pushato bump e tag. Quattro rilasci senza APK (`0.7.0`, `0.8.0`, `0.9.0`,
      `0.9.1`); l'ultima Release scaricabile è la `0.6.6`. La quota si rinnova il
      2026-10-01, ma con un rilascio per merge si riesaurisce. **Il flusso, per ora, è
      la build locale** (`docs/adr/0009`, procedura in `docs/deploy.md`); il rimedio
      automatico è la issue #26. *Verificato: i log dei quattro run falliti riportano
      tutti «This account has used its Android builds from the Free plan this month».
      La procedura locale **non è ancora stata eseguita**: sulla macchina ci sono JDK
      17, Android SDK (`ANDROID_HOME`), `eas-cli` 21.4 loggato (`eas whoami` →
      `marouanouadi`) e `gh` autenticato, ma nessun APK è stato costruito con
      `--local`.*
- [x] Bump di versione dai conventional commit (ADR 0005), `pr-title.yml` che lo
      protegge — *ADR 0005 lo documenta; i 22 tag del repo ne sono la traccia*
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
      job soli, `persist-credentials: false` sui checkout non pushanti e su
      nessuno dei due che pushano. Poi in CI sulla PR #16: tutti i job passano.
      I due job che pushano girano solo su `main`, quindi la loro prima
      esecuzione vera è il prossimo rilascio*
- [~] L'APK della Release si costruisce solo per `arm64-v8a` e `armeabi-v7a`,
      non più anche per `x86`/`x86_64` degli emulatori (`eas.json`, profilo
      `preview`). Atteso: da 117,6 MB (`mobile-v0.7.0`) a circa 67 MB. *Verificato
      in locale che `ORG_GRADLE_PROJECT_reactNativeArchitectures` vince su
      `gradle.properties` (`./gradlew :app:properties` con e senza la variabile);
      il peso atteso è la somma delle librerie delle due ABI nell'APK 0.7.0. Manca:
      il peso vero del primo APK rilasciato da EAS con la modifica*
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
