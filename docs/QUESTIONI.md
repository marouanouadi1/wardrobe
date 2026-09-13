# QUESTIONI — le scelte in sospeso

Le decisioni che l'utente ha **parcheggiato su cose già costruite**. Non è
`DOMANDE_APERTE.md`, che riguarda ciò che la specifica non dice ancora:

> **QUESTIONI** = *«è costruito — come lo vogliamo?»*
> **DOMANDE_APERTE** = *«la specifica non lo dice ancora»*

**Una questione ricordata a voce è una questione persa.** Si scrive nel momento in
cui emerge, non a fine sessione. Quando l'utente risponde, la voce **si sposta**
fra le chiuse con la sua data e la risposta testuale: non si cancella, perché una
risposta senza la sua domanda non si capisce.

Se stai per toccare qualcosa che una di queste voci nomina, **la decisione arriva
prima del codice**.

## Aperte

### Q-01 — Chi è normativo: `CLAUDE.md` o il docblock della primitiva?
**Aperta il:** 2026-09-11 · **Tocca:** `CLAUDE.md`, `apps/mobile/src/ui/fondo.tsx`

`CLAUDE.md` ha descritto per due giorni la regola di `su` nella forma
pre-refactor («inoltra la prop»), mentre il commit `ee7f492` l'aveva già
sostituita con un contesto React (assert / inoltra / eredita). Il file che un
agente carica per primo diceva di scrivere codice vecchio.

*Nel frattempo:* vince il codice, e `CLAUDE.md` è stato allineato citando
`fondo.tsx` invece di riassumerlo.

*Cosa cambia a seconda della risposta:* se la regola generale è «il docblock
vince e il file di progetto lo cita», allora ogni convenzione che vive anche nel
codice va scritta come rimando, non come copia — e vale per tutte le rules, non
solo per questa.

### Q-02 — Un ADR che cita file rimossi si marca «superato» o resta immutabile?
**Aperta il:** 2026-09-11 · **Tocca:** `docs/adr/0004-l-avatar-veste-le-foto-non-i-colori.md`

L'ADR 0004 cita `MODI_AVATAR` e il manichino 3D, rimossi insieme al playground.
La decisione di prodotto che contiene è ancora valida; i riferimenti al codice no.

Pesa perché, non esistendo un `DECISION_LOG.md`, gli ADR sono **l'unico registro
delle decisioni**: se invecchiano in silenzio, non resta niente.

*Cosa cambia:* «immutabile» significa aggiungere un ADR nuovo che lo supera;
«si marca» significa una riga di stato in testa, e allora serve la convenzione.

### Q-03 — Si confermano gli id `gpt-5.1` e `gemini-2.5-pro`?
**Aperta il:** 2026-09-11 · **Tocca:** `services/api/src/adapters/llm/`

Non vengono da nessun SDK: sono i nomi indicati nel design. Quelli di Claude
arrivano dall'SDK ufficiale.

*Nel frattempo:* non bloccano — sono sovrascrivibili da `MODELLI_OPENAI` e
`MODELLI_GOOGLE`.

### Q-04 — `apps/web` resta un segnaposto o si toglie?
**Aperta il:** 2026-09-11 · **Tocca:** `apps/web/`, `package.json` (workspaces)

Due file, un `dev` che esce con 1, registrato nei workspace. Costa poco tenerlo e
confonde chi legge `## Struttura` del README.

*Nel frattempo:* nessun agente ci scrive — il quando e il perché riaprirlo
stanno in `apps/web/README.md`, che nomina perfino Next.js come candidato.

### Q-05 — I buchi di numerazione si documentano o si riempiono?
**Aperta il:** 2026-09-11 · **Tocca:** `services/api/migrations/`, `docs/adr/`

Le migrazioni saltano `0003` e `0004` (playground rimosso); gli ADR partono da
`0004` e i primi tre non sono mai esistiti in git. Oggi lo si scopre solo con un
`ls`.

*Nel frattempo:* i buchi restano — compattare la numerazione delle migrazioni
sarebbe **pericoloso**, perché l'ordine di esecuzione è lessicografico.

## Chiuse

*(nessuna, per ora)*
