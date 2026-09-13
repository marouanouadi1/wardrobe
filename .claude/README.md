# `.claude/` — la configurazione degli agenti

Questa cartella non contiene codice del prodotto. Si modifica **dalla sessione
principale, su richiesta esplicita dell'utente**: nessun agente ci scrive, e
`doc-writer` la ha esclusa per iscritto. Un agente che può riscrivere le proprie
istruzioni non ha istruzioni.

| | |
|---|---|
| `agents/` | i nove agenti: sei che eseguono, tre che giudicano o dirigono |
| `rules/` | gli standard per area, letti **su richiesta** dall'agente che serve |

La sintesi e l'instradamento stanno in `CLAUDE.md`, alla radice.

## Chi può scrivere

`reviewer`, `security` e `orchestrator` hanno `tools: Read, Bash, Glob, Grep` —
**non possono scrivere, ed è deliberato**. Chi giudica non corregge ciò che
giudica: altrimenti la finding e la patch nascono dalla stessa ipotesi e nessuno
la verifica. L'orchestrator non scrive per non cedere alla «riga veloce», che è
sempre quella che salta un confine.

Si distinguono a colpo d'occhio anche dal colore: `red`, `yellow` e `blue` sono
esclusivi dei tre, i sei esecutori condividono `green`, `cyan` e `magenta` a
coppie tematiche.

## Cosa la macchina impone davvero, e cosa no

**Un confine solo è imposto dalla macchina: `tools:` nel frontmatter.** Decide
*chi può scrivere*, non *dove*. Tutto il resto — la mappa path → proprietario in
`CLAUDE.md`, gli standard di `rules/`, i confini scritti in fondo a ogni agente —
**sono istruzioni**, e vanno lette sapendo che sono istruzioni: un confine creduto
imposto e invece solo scritto è peggio di un confine dichiarato.

Regge perché ogni agente ha un contesto stretto, un criterio guida che rende ovvio
quando sta uscendo dal perimetro, e perché **il controllo vero è a valle**: la CI
su ogni PR, e la review umana prima del merge. È lì che si vede il diff finale, ed
è lì che si nega — non nel momento in cui l'agente scrive il file.
