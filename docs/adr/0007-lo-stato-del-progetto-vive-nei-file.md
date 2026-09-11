# 0007 — Lo stato del progetto vive nei file, non nella testa di chi lo scrive

**Stato:** accettata · **Data:** 2026-09-11

## Contesto

Wardrobe passa a un modo di lavorare in cui **il codice lo scrive un agente e la
persona lo assegna e lo rilegge**. Finché a scrivere era la persona, lo stato del
progetto — cosa è davvero verificato, quale decisione è stata parcheggiata, cosa
si aspetta da fuori — poteva restare nella sua memoria: era la stessa che apriva
l'editor. Un agente non ha memoria fra una sessione e l'altra: riparte da zero,
rideduce, e ridiscute scelte già prese.

Il README stava già facendo metà di questo lavoro, e bene: la sezione «Stato»
distingueva ciò che era verificato su questa macchina, ciò che era verificato sul
VPS e — la parte che vale di più — ciò che **non** era verificato e conta saperlo.
Il problema non era il contenuto: era che viveva dentro un file di 258 righe che
serve anche a presentare il prodotto, mescolato a prosa che invecchia con ritmi
diversi.

E aveva già cominciato a mentire. Lo stesso README dichiarava «92 test» alla riga
45 e «148 test» alle righe 147 e 180, mentre i test erano 163. Diceva «15
schermate» quando i file rotta erano 16, e «oggi ce n'è una» parlando degli ADR
quando erano tre. Nessuno di questi errori è stato commesso: sono tutti numeri
scritti una volta e mai più guardati. Nello stesso periodo `CLAUDE.md` — il file
che un agente carica per primo — descriveva la convenzione di `su` nella forma
precedente al commit `ee7f492`, cioè diceva a chi scrive codice di scriverlo
come non si scrive più.

## Decisione

### Cinque file, ognuno con una domanda sola

| File | Risponde a |
|---|---|
| `docs/PROGRESS.md` | cosa è implementato, e **come** è stato verificato |
| `docs/TEST_COVERAGE.md` | quanti test ci sono e cosa coprono |
| `docs/QUESTIONI.md` | quali scelte l'utente ha rimandato **su cose già costruite** |
| `docs/DOMANDE_APERTE.md` | cosa la **specifica** non dice ancora |
| `CHANGELOG.md` | cosa è cambiato per chi usa il prodotto |

La distinzione fra gli ultimi due è la meno ovvia e la più utile: *«è costruito,
come lo vogliamo?»* non è *«la specifica non lo dice ancora»*. La prima blocca
il codice che sta per essere scritto; la seconda blocca il disegno.

### Il README smette di dichiarare numeri

La sezione «Stato» non è stata *copiata* in `PROGRESS.md`: è stata **spostata**.
Al suo posto restano sei collegamenti. Due copie possono divergere, una no.

I numeri che non hanno una casa — righe, schermate, quanti ADR — sono stati
**cancellati** dalla prosa invece che spostati. Il conteggio degli ADR è diventato
un elenco: un elenco si vede a occhio se è incompleto, un conteggio no.

### Un solo file può dichiarare un conteggio di test, e una macchina lo verifica

`docs/TEST_COVERAGE.md`. Il gate in `.github/workflows/docs.yml` confronta il
numero dichiarato con quello che `pytest --collect-only` raccoglie davvero, e
rifiuta qualunque `N test` scritto in un altro `.md`.

Il workflow **non ha filtri sui path**, per la stessa ragione già scritta in
`pr-title.yml`: che i numeri nelle docs siano veri è una regola del repo, non di
una sottocartella, e una PR di sole docs non farebbe partire né `api.yml` né
`mobile.yml`.

Non sono gatate le percentuali di coverage per modulo: portano la data e l'id
della run che le ha misurate, sono una fotografia, e gatarle farebbe fallire ogni
PR che le sposta di mezzo punto. Un gate che fa rumore viene disattivato.

### Le decisioni restano negli ADR

Uno per decisione, numerato, come questo.

## Conseguenze

- **Una modifica non è finita finché il file di stato che la riguarda non è
  aggiornato**, e nella stessa PR. La tabella «quale si tocca, dopo cosa» sta in
  `CLAUDE.md`, che è il file che un agente legge per primo.
- **`[x]` in `PROGRESS.md` significa verificato**, non «scritto». La prima
  versione del file trascrive le affermazioni che il README faceva al 2026-09-08 e
  **ne dichiara la provenienza riga per riga**: promuovere una riga richiede di
  rieseguire il controllo che la riga nomina. Senza questa cautela il file sarebbe
  nato contenendo esattamente la deriva che esiste per fermare.
- Il README torna a essere quello che dichiara di essere: prodotto e
  architettura. È passato da 258 a 197 righe.
- Le sezioni «Debiti dichiarati» e «Cosa manca dall'esterno» di `PROGRESS.md`
  rendono visibile ciò che prima si sapeva e basta — che il percorso dati che gira
  in produzione non ha nessun test, che nessun modello è mai stato interrogato,
  che login e registrazione non sono mai stati provati su un telefono.
- Un file in più da tenere allineato è un costo reale. Si paga perché
  l'alternativa — lo stato nella memoria di una persona che ha smesso di scrivere
  il codice — non è un'alternativa.

## Alternative scartate

**Un `DECISION_LOG.md` unico, append-only.** È il modello di un progetto vicino,
dove le decisioni architetturali finiscono tutte in un file solo che le regole
impongono di leggere *prima di ogni modifica*. Là quel file ha superato i 499 KB:
a quelle dimensioni nessun agente lo legge davvero, e una decisione registrata ma
non trovata equivale a una decisione non registrata. Gli ADR numerati fanno lo
stesso lavoro con un file per decisione, che si apre solo quando serve.
**Questa voce è qui perché senza di essa qualcuno lo riproporrà**, e sembrerà una
buona idea.

**Lasciare tutto nel README, aggiungendo solo le sezioni mancanti.** Meno file da
tenere allineati, ed è l'opzione onesta per un progetto scritto a mano. Scartata
perché non risolve il problema vero: lo stato resta mescolato alla presentazione,
e il file che un agente apre per capire «a che punto siamo» è lo stesso che apre
per capire «cos'è questo prodotto».

**Gatare tutti i numeri, non solo i conteggi di test.** Righe di codice, schermate,
ADR. Scartata in favore di cancellarli dalla prosa: **non si gata ciò che si può
togliere**, e ogni gate in più è una PR che fallisce per una ragione che non
interessa a nessuno.
