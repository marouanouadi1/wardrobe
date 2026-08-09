# 0004 — L'avatar veste le foto, non i colori

**Stato:** accettata · **Data:** 2026-07-25

Questa è una **direzione di prodotto**: dice dove va l'avatar e cosa smette di
essere vero. *Come* integrarla non è ancora deciso, e questo ADR non lo decide.
Nessuna riga di codice cambia per effetto suo — cambia ciò che il codice può
dichiarare come scelta definitiva.

## Contesto

Oggi il manichino non indossa i capi: li **tinge**. Ogni pezzo di stoffa è una
primitiva di three.js colorata con l'esadecimale che il modello di visione ha
letto dalla foto (`apps/mobile/src/avatar/Manichino3D.tsx`). La figura viene da
`mannequin.js` del design, e il colore dominante era il solo attributo con cui una
mesh generica potesse assomigliare a un capo vero.

Ma un capo non è il suo colore dominante. La camicia a righe diventa azzurro
pieno, il denim perde la trama, le stampe spariscono. Su una funzione che si
chiama «vedi come ti sta», questo è il difetto centrale: l'utente vede addosso un
capo che non è il suo. E il corpo che lo indossa è un manichino anonimo, uguale
per tutti, che non aiuta a giudicare se una cosa sta bene *a lui*.

Un armadio di capi prefabbricati a cui si cambia la tinta non è il prodotto.

## Decisione

Due tracce distinte, che si incontrano nella scena 3D.

### Il capo — dalla foto alla texture

```
foto dell'utente
      │
      ▼
[scontorno]        un modello di segmentazione separa il capo dallo sfondo
      │
      ▼
[ricostruzione]    dal ritaglio nasce una geometria tridimensionale
      │
      ▼
[texture]          la foto scontornata si applica sul modello 3D
      │
      ▼
il capo, addosso, girabile
```

Il capo che si vede addosso viene **dalla fotografia di quel capo**. Niente
libreria di vestiti pronti da colorare: il ritaglio è il capo, la sua texture è la
sua stoffa vera.

### Il corpo — realistico e della persona

L'avatar è **fedele alla persona**, non neutro. Con quale strumento si ottiene non
è deciso: ricostruzione dalla foto a figura intera che il profilo già conserva,
oppure un servizio o SDK esterno. Questa parte è dichiarata aperta di proposito —
il requisito è fissato, il mezzo no. Il requisito basta a escludere il manichino
generico come traguardo.

### Rapporto con la pipeline di analisi

`handlers/analisi.py` divide già l'analisi in due fasi, `analizza` e `salva`.
Lo scontorno e la ricostruzione sono **passi nuovi della stessa pipeline**,
non un sistema parallelo: lo scontorno è il candidato naturale come passo
prima di `analizza` (un capo già ritagliato è anche una foto più facile da
leggere per il modello di visione), la ricostruzione è pesante e asincrona e
sta a valle. La pipeline esistente non si riscrive: questa nota la estende
quando i due passi esisteranno.

## Conseguenze

**`colore.hex` smette di essere ciò senza cui il capo non esiste.** Oggi
`ATTRIBUTI_INDISPENSABILI` in `services/api/src/domain/vision.py` elenca tipo e
colore, e `crea_capo` rifiuta il capo se il modello non riconosce il colore
dominante — con questa motivazione: senza colore non c'è niente da tingere. Sotto
la nuova direzione la motivazione cade: un capo con un ritaglio pulito e un colore
illeggibile è perfettamente indossabile. **Il comportamento non cambia adesso** —
è scritto qui perché sia il primo posto da toccare quando la texture arriva. Il
colore diventa il ripiego, non il requisito.

**La foto della persona cambia ruolo.** `Profilo.avatar_foto_chiave` è nata come
«foto a figura intera per l'avatar 2D, quando il 3D non basta»: un ripiego. Con un
avatar fedele alla persona quella foto è, al contrario, **un ingresso** del corpo
3D. Il campo resta com'è; la sua descrizione no.

**Il manichino tinto resta, come primo passo e come ripiego.** È l'unica cosa che
funziona oggi, e continuerà a servire quando la texture non c'è: WebGL assente,
capo appena caricato, scontorno fallito. Cambia il modo di raccontarlo — «per
ora», non «per scelta». La stessa cosa vale per il manichino piatto: garantisce
che «vedi come ti sta» non si perda mai, non che i colori siano l'informazione
importante.

**Il bivio nell'interfaccia è destinato a chiudersi.** `MODI_AVATAR` in
`apps/mobile/src/avatar/renderer.ts` presenta all'utente una scelta — «Manichino
3D» *oppure* «La tua foto» — che nasce dal fatto che nessuna delle due mostra
davvero il capo addosso. Arrivati in fondo, la scelta non ha più oggetto: c'è il
tuo corpo che indossa i tuoi capi. È scritto qui perché quel selettore non venga
«sistemato» più avanti per conservare un'alternativa che il prodotto non ha più.

**I cinque slot restano; la loro giustificazione no.** `SlotAvatar` e
`Vestizione` in `services/api/src/domain/models.py` hanno le chiavi in inglese
(top/bottom/outer/shoes/dress) e il codice le motiva con `mannequin.setOutfit()`.
Quella libreria non è più in uso — `Manichino3D.tsx` è scritto a mano in
react-three-fiber — quindi la motivazione è già superata. Gli slot restano utili
perché sono il modo in cui un outfit si compone, e con la texture serviranno
ancora: dicono su quale parte del corpo va applicata quale geometria.

## Alternative scartate

**Restare al colore dominante.** Costa zero, funziona già, e non ha dipendenze
nuove. Ma la funzione di punta mostra un capo che non è il tuo: è il difetto che
si nota alla prima apertura e non passa più.

**Un collage 2D: il capo ritagliato sovrapposto alla foto della persona.** Molto
più economico di una ricostruzione. Escluso perché un ritaglio approssimativo
addosso a una foto è peggio di nessun collage — è la stessa ragione già scritta in
`Avatar.tsx`, e resta valida: senza geometria, il capo non segue il corpo.

**Una libreria di capi 3D prefabbricati da tingere e mappare.** Sarebbe una via di
mezzo: geometria decente, texture presa dalla foto. Ma la geometria non è quella
del tuo capo — un cappotto lungo diventa il cappotto della libreria — ed è
esattamente la scorciatoia che questo ADR rifiuta.

**Un avatar neutro configurabile a manopole** (altezza, corporatura, incarnato).
Rispetta la privacy per costruzione e non richiede nessun modello. Ma il punto
dell'avatar è giudicare se una cosa sta bene *a te*: un manichino regolabile
resta un manichino.
