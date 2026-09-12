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

## Risposte

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
