# 0008 — Prima di aggirare un problema, si prova a toglierlo

**Stato:** accettata · **Data:** 2026-09-11

## Contesto

I test dell'app non partivano: `useContext` su `null` al primo hook, il sintomo
classico di due copie di React nello stesso albero di rendering. La diagnosi è
stata rapida e la soluzione pure — un `moduleNameMapper` in
`apps/mobile/package.json` che obbliga jest a risolvere una copia sola. Tre righe,
i test sono diventati verdi, il lavoro è andato avanti.

Quella soluzione era sbagliata, e non perché non funzionasse: funziona ancora.
Era sbagliata perché **il problema è rimasto dov'era**. Le due copie di React
continuano a esistere, il mapper va mantenuto, e chi lo trova fra sei mesi non sa
se può toglierlo. Peggio: il conflitto resta attivo ovunque *fuori* dai test,
dove nessun mapper lo copre.

La causa vera è emersa un giorno dopo, rispondendo a una domanda diretta — «perché
ci sono due versioni che cozzano?». Il `package.json` della root non dichiara
`react`; decine di pacchetti finiscono hoisted lì (`@expo/*`, `@radix-ui/*`) e lo
chiedono come peerDependency con `*`; npm, non avendo in root una risposta alla
domanda «quale react?», installa l'ultima pubblicata. `apps/mobile` ha il suo pin
esatto, e le copie diventano due.

Il rimedio è **dichiarare `react` nelle `dependencies` della root**. Una riga. Le
peer `*` si accontentano di quella, resta una copia sola — **e il mapper si
cancella**.

Lo stesso schema si era già ripetuto due volte nello stesso giro di lavoro, senza
che nessuno lo notasse: tre regole `Write(...)` nei permessi che non venivano mai
valutate (ne bastavano le `Edit(...)`, e le `Write` erano rumore aggiunto), e un
`$CLAUDE_PROJECT_DIR` senza fallback che rendeva quattro hook silenziosamente
inerti. In entrambi i casi la prima reazione era stata aggiungere qualcosa.

## Decisione

**Davanti a un problema, la prima domanda non è «come lo risolvo» ma «posso
toglierlo».**

### Il test è una domanda sola

> Se togliessi la mia soluzione, il problema tornerebbe?

Sì → è un **tampone**: la causa è ancora dove era.
No → hai tolto la causa, e non resta niente da mantenere.

### Il segnale pratico

**Il rimedio toglie righe. Il tampone ne aggiunge.** Non è una legge, ma è
un'euristica che funziona quasi sempre, e costa un secondo: se la soluzione è
fatta solo di aggiunte — una configurazione, un'eccezione, un flag, un
adattatore — va guardata una seconda volta.

### I tamponi restano legittimi, a tre condizioni

Non sempre la causa si può togliere adesso: può stare in una dipendenza, può
richiedere una decisione che non è nostra, può costare più del problema. Allora:

1. si **dichiara** che è un tampone, dove sta, con una riga che nomina la causa;
2. si apre la voce del rimedio in `docs/DA_FARE.md`;
3. quando il rimedio arriva, **il tampone si toglie**. Altrimenti restano
   entrambi, e il secondo nasconde il primo.

### Dove è scritto

In `CLAUDE.md`, in tutti e cinque i file di `.claude/rules/`, nel corpo di tutti
e nove gli agenti, e qui. È l'**unica** regola del progetto duplicata di
proposito: decide la forma di ogni soluzione, quindi va incontrata da chiunque
apra uno qualunque di quei file. Se cambia, cambia ovunque nella stessa modifica.

## Conseguenze

- Le voci di `docs/DA_FARE.md` distinguono **tampone** e **rimedio**, e un
  tampone in piedi porta il riferimento alla voce che lo toglierà.
- `reviewer` ha una voce in più nella sua lista: una soluzione fatta solo di
  aggiunte, senza una riga che dichiari perché la causa non si poteva togliere.
- Si accetta di essere **più lenti sul singolo problema**. La diagnosi della
  causa costa più del tampone, quasi sempre. Si paga perché il tampone costa a
  ogni lettura successiva, per sempre, e a chi non c'era.
- Il rischio opposto è reale e va nominato: **cercare la causa all'infinito**
  invece di sbloccare il lavoro. La regola non dice «non tamponare mai»: dice
  «sappi di averlo fatto, e scrivilo». Un tampone dichiarato è una decisione; un
  tampone dimenticato è debito che nessuno ha scelto.

## Alternative scartate

**Lasciarlo come buona pratica implicita.** È quello che era fino a ieri, e in un
solo giro di lavoro ha prodotto tre tamponi su tre problemi. Una pratica che
dipende dal fatto che qualcuno se la ricordi nel momento giusto — mentre è
concentrato su altro — non è una pratica.

**Scriverlo solo in `CLAUDE.md`.** Sarebbe coerente con la regola anti-duplicazione
del progetto, ma perderebbe proprio il momento in cui serve: si aggira un problema
mentre si sta lavorando a un file di test o a un workflow, non mentre si legge il
documento di indirizzo. Per questo è ripetuto nelle rules e negli agenti, che sono
i file che si hanno davanti quando il problema si presenta.

**Un gate automatico.** Non esiste un controllo che distingua un tampone da un
rimedio: entrambi sono codice che funziona e test che passano. È esattamente la
classe di cose che una macchina non vede — e per cui esistono `reviewer` e una
persona che legge il diff.
