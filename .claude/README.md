# `.claude/` — la configurazione degli agenti

Questa cartella non contiene codice del prodotto. Si modifica **dalla sessione
principale, su richiesta esplicita dell'utente**: nessun agente ci scrive, e
`doc-writer` la ha esclusa per iscritto. Un agente che può riscrivere le proprie
istruzioni non ha istruzioni.

| | |
|---|---|
| `agents/` | i nove agenti: sei che eseguono, tre che giudicano o dirigono |
| `rules/` | gli standard per area, letti **su richiesta** dall'agente che serve |
| `settings.json` | i soli divieti che valgono per tutto il progetto |

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

Tre livelli, con potere decrescente. La differenza conta, perché un confine
creduto imposto e invece solo scritto è peggio di un confine dichiarato.

1. **`tools:` nel frontmatter** — l'unico confine genuinamente per-agente. Impone
   *chi può scrivere*, non *dove*.
2. **`permissions` in `settings.json`** — vale per **tutto il progetto**, non per
   singolo agente. Per questo ci sta solo ciò che **nessuno** deve fare.
3. **Hook** — impongono invarianti verificabili da un comando, ma **non sanno
   quale agente ha chiamato il tool**.

**Conseguenza da accettare, non da mascherare:** la mappa path → proprietario in
`CLAUDE.md` **non è imposta dalla macchina — sono istruzioni**. Regge perché ogni
agente ha un contesto stretto, un criterio guida che rende ovvio quando sta
uscendo dal perimetro, e perché `reviewer` legge il diff finale.

**Limite di `deny`:** copre i tool di scrittura file, non la shell. `sed -i`,
`> file` e `git apply` passano da Bash. Per questo Bash va lasciato in modalità
con conferma, non auto-approvato.
