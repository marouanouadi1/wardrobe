# DOMANDE APERTE — ciò che la specifica non dice ancora

Le lacune del **disegno di prodotto**. Nessuna di queste è una scelta su codice
già scritto: quelle stanno in `docs/QUESTIONI.md`.

Leggi le voci che riguardano il modulo su cui stai per lavorare **prima di
inventare una risposta**. Quando l'utente risponde, la voce si sposta fra le
risposte con la sua data: la risposta in testa, la domanda com'era posta sotto —
perché una risposta senza la sua domanda non si capisce.

## Aperte

### D-03 — Nel freemium, cosa si paga?
**Non blocca** lo scaffold. Tocca però sapere presto se il limite è sul numero di
capi, sulle chiamate al modello o sulle funzioni: le tre cose si misurano in
posti diversi.

### D-04 — Con quale strumento si costruisce il corpo dell'avatar?
Ricostruzione dalla foto a figura intera, oppure un servizio esterno.

**Che debba essere *fedele alla persona* e non un manichino neutro non è più una
domanda: lo decide l'ADR 0004.** Resta aperto il mezzo, ed è la scelta che pesa
di più su quanto dovrà allungarsi l'astrazione dell'avatar.

Oggi quello che l'utente vede è il ripiego 2D dichiarato dall'ADR: una sagoma SVG
tinta dai colori dominanti.

### D-06 — Com'è fatto l'avvio dell'app: ante, nome, home
**Dove sta l'effetto è deciso, e non è dove si era capito prima:** le ante si
aprono **all'avvio dell'app**, non entrando nella scheda Armadio (utente,
2026-09-18). La sequenza è: si apre l'app → le ante si aprono → compare il nome
**Aura** (logo ancora da definire) → si entra nella home. La scheda Armadio non
ha più nessun effetto di apertura.

**L'effetto è deciso: le ante** (2026-09-17, scartati «i capi che si scostano» e
«il velo che si alza»; scartati anche il legno chiaro e il nero — del nero resta
l'effetto di luce, che è la cosa che piaceva).

Restano aperte **due scelte**, e sono in `schermate/aura-avvio.html`:

1. **Quando si vede il nome.** Tre bozze: *Il nome dentro l'armadio* (le ante si
   aprono sul buio, il nome ci sta dentro, poi la home — 2,2 s), *Il nome sulle
   ante* (scritto «Au|ra» sulle ante chiuse, si legge prima e se ne va con loro —
   1,9 s), *Il nome sopra la home* (la home è già lì velata, il nome sfuma sopra
   — 2,1 s).
2. **La superficie delle ante**, che nella stessa pagina si cambia da un
   selettore e vale per tutt'e tre: *Il tuo armadio* (texture da una foto
   dell'armadio dell'utente), *Laccato* disegnato, *Fumo*.

Le passate precedenti restano dove sono: `schermate/armadio-apertura.html` (i tre
effetti fra cui si è scelto), `schermate/armadio-ante.html` (perla, rovere,
inchiostro) e `schermate/armadio-ante-foto.html` (i tre materiali, prima che si
sapesse che l'effetto era l'avvio). Fuori dal repo, come il deck.

**Non blocca** niente: oggi l'app parte sulla splash di `app.json` ed entra
diretta.

Tre cose vanno decise **insieme alla bozza**, perché cambiano cosa si scrive:

- **la splash di sistema deve diventare le ante chiuse.** Su Android e iOS la
  prima immagine la disegna il sistema (`app.json`, `expo.splash`), non noi: se
  non è già le ante chiuse, all'avvio si vede uno stacco prima dell'animazione.
- **ogni apertura o solo a freddo.** L'avvio completo a ogni ritorno in primo
  piano diventa un pedaggio: la scelta abituale è mostrarlo solo a app chiusa
  davvero.
- **cosa vede chi ha «riduci movimento» attivo** — la risposta sensata è «niente
  animazione, il nome per un istante e poi la home», ma va detta, non dedotta.

Due conseguenze già note:

- **La superficie fotografata porta con sé un file** (~26 kB di JPEG dentro
  l'app). *Laccato disegnato* è l'unica delle tre che non porta niente: è la
  ragione per cui sta lì.
- La foto è **l'armadio dell'utente**. Va bene finché si legge come «un'anta
  laccata»; se diventa riconoscibile come l'anta di qualcuno, è una scelta
  d'arredo altrui imposta a chi usa l'app.

### D-07 — Qual è il marchio di Aura: il segno e il carattere del nome
Il nome è deciso (Aura); il **marchio** no. Sei segni e sei caratteri stanno in
`schermate/aura-marchio.html`, che li combina in anteprima su tre fondi.

- **I segni** sono disegnati in SVG, due o tre linee ciascuno, e la pagina li
  mostra anche **a 24 px su chiaro e su scuro**: L'alone, L'apertura (il cerchio
  tagliato in due — è l'armadio che si apre ridotto all'osso), La A che si apre,
  Le ante, La fessura, La lettera sola dentro un cerchio.
- **I caratteri**: Italiana, Bodoni Moda, Cormorant Garamond, Tenor Sans, Jost, e
  Bricolage ExtraBold (quello dei titoli dell'app) tenuto per confronto.

Nessuno è stato generato da un modello di immagini: sono vettori scritti a mano,
quindi nell'app diventano codice — nessun file, nessuna sgranatura, colore che
segue il fondo. Se si vuole passare da un generatore di immagini è una decisione
a parte: produce PNG da ricalcare, non vettori, ed è una chiamata a pagamento
verso un servizio esterno.

**Non blocca** niente. Ma tocca due cose già in piedi: il carattere del marchio
**non deve** essere quello dei titoli (si carica a parte, 2–4 kB nel subset con
le sole lettere del nome), e l'**icona dell'app** è un lavoro ulteriore —
quadrata, senza il nome accanto, e con i bordi che li arrotonda il sistema.

Fino alla risposta, `schermate/aura-avvio.html` mostra **L'alone + Italiana**:
messi lì per non lasciare un buco, non scelti.

**Nell'app non ne va nessuno** (utente, 2026-09-22): finché il marchio non è
scelto, le schermate che ne chiederebbero uno — `intro`, `accedi`, `registrati`,
e l'icona dell'app — restano **senza**. Un segno messo «per ora» diventa quello
definitivo per inerzia, e va poi cercato in cinque posti per toglierlo. Oggi
nell'app non ce n'è nessuno: verificato con un grep su `app/` e `src/`.

### D-08 — La pagina «Termini e privacy»: quattro affermazioni, e tre non sono nostre da scrivere
Il deck ha una schermata `legale` con un riassunto in quattro punti più quattro
documenti. **Non è stata fatta**, e non per pigrizia: transcriverla metterebbe
in bocca al prodotto cose che il codice non fa.

| Riga del deck | Verificata contro il codice |
|---|---|
| «Per riconoscere un capo la foto viene letta in automatico, sui nostri server o su quelli del servizio che ci aiuta» | **Vera.** Lo scontorno passa da un servizio esterno (`ServizioScontorno`), la lettura da un provider LLM. Si può scrivere |
| «Puoi scaricare tutto, o cancellare tutto, senza scrivere a nessuno» | **Falsa in entrambe le metà.** Non esiste nessun endpoint di export in `ROTTE`, non esiste `DELETE /capi/{id}`, non esiste la cancellazione dell'account. Non è un'imprecisione di copy: è un diritto dichiarato che non c'è |
| «Aura è gratis. Se un giorno qualcosa diventerà a pagamento, lo saprai prima» | **Da decidere, non da trascrivere.** `D-03` («Nel freemium, cosa si paga?») è aperta: l'esistenza stessa di quella domanda dice che il freemium è previsto. Impegnarsi su «gratis» in una pagina legale è una scelta dell'utente |
| «Le foto e le misure restano tue: non le vendiamo, e non servono a insegnare niente a nessuno» | **Non verificabile dal codice**: è un impegno sul trattamento dei dati, che vale quanto vale chi lo prende. (E «le misure» non esistono: `Profilo` non ha taglia né corporatura) |

E i quattro documenti collegati — termini, informativa, «chi legge le tue foto»,
licenze open source — **non esistono**.

**La linea, che vale per tutta la fase 4:** *descrivere cosa fa il codice è
verificabile; promettere diritti o prezzi è un impegno.* I testi di
`impprivacy` stanno dal lato buono; il riassunto di `legale` quasi tutto no.

Una pagina legale con un punto vero e quattro collegamenti morti è peggio di
nessuna pagina: la prima volta che qualcuno tocca «Termini di servizio» e non
succede niente, smette di credere anche al resto.

**Serve dall'utente:** i quattro documenti veri (o la decisione di scriverli), e
la risposta su `D-03`.

## Risposte

### D-09 — Quali corporature, e quali sistemi di taglie oltre alle lettere

**Aperta il:** 2026-09-23 · **Tocca:** `services/api/src/domain/models.py`
(`Corporatura`, `Taglia`), `apps/mobile/app/misure.tsx`

**Cosa non dice la specifica.** Il deck mostra la riga «Corporatura» col valore
«Media», e **non elenca le alternative**: il selettore non è aperto in nessuna
delle 49 schede. Le tre che ho messo — *Minuta · Media · Robusta* — le ho
scelte io. Sono una scala simmetrica di tre passi, che è il minimo per dire
qualcosa senza chiedere una circonferenza; potrebbero volerne cinque, o
potrebbero dover essere altre parole. «Robusta» in particolare è una parola che
descrive un corpo, e chi la legge la legge su di sé.

**La seconda metà.** `Taglia` accetta oggi le sole lettere XS–XL. Il deck offre
quelle, sotto tutti e tre i sistemi — ma «Donna» in Italia si dice 38/40/42, e
un sistema di taglie che non cambia le taglie non sta dicendo niente. O il
sistema determina i valori (e allora `Taglia` non è una enum piatta), o non
serve chiederlo. Il lavoro è `T-44`; **la decisione è qui**, perché non è un
rimedio tecnico: è cosa promettiamo di capire di un corpo.

**Perché non blocca.** Ogni campo di `Misure` è facoltativo e l'intero modello
può essere assente. Chi non si riconosce nelle tre parole le lascia vuote, e
l'unica cosa che perde è un avatar più fedele. Cambiare i valori dopo costa un
cambio di contratto, non una migrazione: le righe già scritte in `profili.dati`
restano leggibili.

### D-01 — L'armadio è personale o condiviso?
**Risposta (2026-09-11):** personale. La condivisione non è esclusa per il
futuro — l'utente potrebbe volerla — ma oggi non è un requisito e non va
anticipata: nessun modello la prevede, e costruirla «per quando servirà»
significherebbe mantenerla prima di averla.

*Cosa vuol dire per chi tocca lo schema.* `utente_id` è il discriminante di
`capi`, `outfit`, `usi`, `messaggi_chat`, `conversazioni_chat` e `segnalazioni`,
e in `usi` sta dentro la chiave primaria. Il giorno in cui la condivisione
arriverà **non basterà allargare uno scope**: servirà un id dell'armadio distinto
dal soggetto del JWT. Non c'è niente da fare adesso — ma non si dia per
definitivo che i due id coincidano.

*La domanda, com'era posta:*

> Coppie, famiglie. **Non blocca** lo scaffold: oggi ogni query è già scopata
> sull'`utente_id` che arriva dal JWT, quindi la strada verso il condiviso non è
> chiusa — ma nessun modello prevede la condivisione.

### D-02 — C'è una parte social, sì o no?
**Risposta (2026-09-11):** per ora no. Niente va costruito in vista di quella.

*La domanda, com'era posta:*

> **Non blocca** lo scaffold.

### D-05 — Fin dove arriva l'app senza rete?
**Risposta (2026-09-11):** l'app funziona solo online. Non c'è un percorso
offline e **non è un requisito**: davanti a una rete assente una schermata mostra
il suo errore — `<StatoRisorsa>`, `<Errore>` — e quello è il comportamento
giusto, non una lacuna da colmare con una cache o una coda.

Non c'è lavoro che ne discende: quello che cambia è che l'omissione di ieri
diventa una scelta dichiarata.

*La domanda, com'era posta:*

> Non esiste più una modalità demo con dati finti, e nessuna schermata ha un
> percorso offline. Non è mai stato deciso se sia un requisito o no — quindi oggi
> non lo è per omissione, che è il modo peggiore di deciderlo.
