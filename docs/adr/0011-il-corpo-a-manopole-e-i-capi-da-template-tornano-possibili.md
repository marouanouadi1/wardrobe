# 0011 — Il corpo a manopole e i capi da template tornano possibili

**Stato:** accettata · **Data:** 2026-10-06 · **Supera in parte:** [0004](0004-l-avatar-veste-le-foto-non-i-colori.md)

Questo ADR **toglie due esclusioni e non sceglie niente al loro posto**. Dice
cosa smette di essere vietato; quale strada si prende resta una decisione
dell'utente, aperta in `docs/DOMANDE_APERTE.md` (`D-04` e le voci che ne
discendono).

## Contesto

L'ADR 0004 ha fissato la direzione dell'avatar: il capo si vede dalla sua
fotografia, non dal suo colore dominante. Fra le alternative scartate ne
metteva due che oggi l'utente vuole tenere aperte:

- *«una libreria di capi 3D prefabbricati da tingere e mappare»*, scartata
  perché «la geometria non è quella del tuo capo — un cappotto lungo diventa il
  cappotto della libreria»;
- *«un avatar neutro configurabile a manopole»*, scartato perché «un manichino
  regolabile resta un manichino».

Dopo settimane passate sulla vestizione — generare il capo in 3D e farlo
indossare — l'utente si orienta verso capi costruiti su **template** (in Blender
o con altri strumenti), con la foto del capo riportata sopra pixel per pixel:
UV mapping, o strumenti fatti per i capi. E prima di andare avanti vuole fissare
l'avatar, che è il pezzo certo: idealmente con la faccia della persona,
altrimenti un corpo regolabile su livelli scelti da noi — spalle più larghe o
più strette, altezza, cose di questo tipo.

Cercando cosa esiste sono emersi due fatti che pesano:

- **i servizi «selfie → avatar» consegnano ogni persona come una mesh loro**,
  con topologia e scheletro propri. E un fornitore può sparire: Ready Player
  Me, acquistato da Netflix, ha spento le API pubbliche il 2026-01-31;
- **esistono corpi parametrici con licenze che permettono l'uso commerciale**:
  l'output di MPFB2 (MakeHuman per Blender) è CC0, Anny (NAVER LABS Europe) e
  MHR (Meta) sono Apache 2.0. E un modello come SAM 3D Body (Meta) stima da una
  foto a figura intera i parametri di un corpo così.

## Decisione

### Il capo: la forma può venire da un template

Un capo può prendere la forma da un **template della sua famiglia** — una
maglietta, un cappotto lungo, un cappotto corto — invece che da una
ricostruzione del suo ritaglio. **L'aspetto resta quello della foto**: la
stoffa, le stampe e le scritte arrivano pixel per pixel, come texture. È il
cuore dello 0004, e non cambia.

L'obiezione dello 0004 ha qui la sua risposta: la forma è approssimata per
famiglia, e più famiglie vuol dire meno approssimazione; la stoffa è quella vera.

Resta esclusa la scorciatoia che lo 0004 rifiutava per prima: **un template
tinto del colore dominante**, che perde righe, trame, stampe e scritte.

### Il corpo: le manopole sono ammesse

Un corpo parametrico regolato su **livelli limitati, scelti da noi**, è un
avatar legittimo, non solo un ripiego. La fedeltà alla persona resta il
traguardo ideale, ma non è più un requisito che escluda le manopole.

Il motivo è che le manopole non sono l'alternativa al corpo fedele: ne sono la
struttura. Anche la strada «dalla foto» produce gli stessi numeri — altezza,
spalle, proporzioni — e la foto, se arriverà, sarà un modo automatico di
regolarle. Partire dalle manopole non chiude quella porta, è il primo pezzo
della stessa strada.

### Cosa questo ADR non decide

- quale corpo base: MPFB2, Anny, MHR, o un servizio esterno (`D-04`);
- la faccia: quella della persona, o una testa neutra (`D-10`);
- se i livelli sostituiscono i centimetri di `Misure` o li arrotondano (`D-11`);
- da quale corpo base parte l'avatar di ciascuno (`D-12`);
- come si disegna il 3D nell'app.

## Conseguenze

**Lo 0004 resta valido in tutto il resto**: la foto diventa la texture, lo
scontorno è un passo della pipeline di analisi, `colore.hex` è destinato a
diventare il ripiego e non il requisito, gli slot restano. Le citazioni dello
0004 nel codice — fra le altre `domain/models.py` (e quindi `modelli.ts`),
`domain/vision.py`, `handlers/analisi.py`, `guidafoto.tsx`, la schermata
dell'avatar — riguardano quelle parti, e restano vere. La riga di stato in testa
allo 0004 rimanda qui.

**Se si prendono entrambe le strade, corpo e capi nascono dalla stessa mesh
base.** Ogni livello del corpo è una shape key, e ogni template di capo deve
avere le stesse shape key: quando il corpo cambia livello, il capo lo segue. Un
template modellato su un altro corpo non segue niente. È anche il motivo per cui
i livelli devono restare pochi: le combinazioni capo × corpo si possono guardare
tutte, una per una, prima che le veda un utente. Con manopole libere no.

**Un servizio «selfie → avatar» non si sposa con i template.** Ogni utente
arriverebbe con una mesh diversa, e ogni capo andrebbe adattato a ciascuna. Non
è escluso — questo ADR non esclude niente di nuovo — ma è il costo da mettere
sul piatto se la faccia vera diventa un requisito.

**`Misure` è già l'ingresso delle manopole.** `altezza_cm`, `corporatura`,
`spalle_cm` e `lunghezza_gamba_cm` stanno in `Profilo.misure`: i livelli
dell'avatar leggono da lì, non da una seconda copia. Le tre corporature di oggi
le ha scelte un agente, non l'utente (`D-09`).

**`Profilo.avatar_foto_chiave` diventa facoltativa per il corpo.** La sua
descrizione in `domain/models.py` la chiama «l'ingresso del corpo 3D fedele alla
persona»: resta vero per la strada dalla foto, ma con le manopole il corpo
esiste anche senza. La descrizione non si tocca adesso; si rilegge quando si
tocca il campo.

**Una foto vera verso un servizio esterno** (fal per SAM 3D Body, o un servizio
di avatar) è un flusso di dati nuovo: si decide a parte, non discende da qui.

## Alternative scartate

**Cancellare lo 0004, e i suoi limiti con lui.** Il suo cuore — l'avatar veste
le foto, non i colori — è ancora la direzione, e il codice lo cita in molti
punti: toglierlo lascerebbe quelle citazioni senza bersaglio, e correggerle
toccherebbe `services/api/` e `apps/mobile/`, cioè due rilasci e una
rigenerazione dei contratti per una modifica di sole parole. Gli ADR sono un
registro, non uno stato corrente: una decisione ribaltata si supera, non si
riscrive.

**Lasciare lo 0004 com'è e procedere.** Il lavoro su un corpo a manopole o su un
template contraddirebbe un ADR «accettata» senza che niente lo dica. Il prossimo
che lo legge — persona o agente — riporterebbe il lavoro alla direzione vecchia,
convinto di correggere un errore.

**Scegliere adesso il corpo base e la faccia.** Le informazioni per farlo ci
sono in parte, ma la scelta è dell'utente, che si è preso il tempo per farla.
Questo ADR toglie i vincoli perché quella scelta si possa fare senza
contraddire niente.
