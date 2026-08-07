# I 10 capi campione per il banco di valutazione

Questa cartella contiene i capi fotografati apposta per confrontare i modelli
di visione fra loro: non capi veri di un armadio, non foto stock — capi tuoi,
fotografati come li fotograferesti per l'app, di cui però conosci già la
risposta giusta. È quella risposta, scritta a mano in `campioni.json`, che
rende possibile dire «questo modello ha sbagliato il colore» invece di «il
modello ha risposto con confidenza alta», che è tutto quello che il prodotto
sa dire oggi (vedi `domain.playground.valuta_lettura`).

## Le 10 caratteristiche da coprire

Non contano le foto belle: contano le foto che fanno inciampare un modello.
Scegli 10 capi che coprano queste caratteristiche, una per capo — sono già
nell'ordine in cui compaiono in `campioni.json` (`c01`..`c10`):

1. **Baseline facile** — un capo a tinta unita, colore netto e inconfondibile
   (rosso, blu, verde). Se un modello sbaglia qui, non serve altro per
   scartarlo.
2. **Bianco difficile** — bianco ottico, panna, écru o avorio: la differenza
   fra queste sfumature è dove i modelli scivolano più spesso.
3. **Luce avversa** — lo stesso tipo di capo di prima (o un altro chiaro),
   fotografato con luce artificiale calda di sera, o in controluce: misura
   se il modello compensa il bilanciamento del bianco o legge il colore
   falsato dalla lampada.
4. **Materiale riconoscibile** — denim, maglia a trecce grosse, velluto a
   coste: un materiale che si vede bene anche a occhio. Serve da controllo:
   se sbaglia anche questo, il problema non è la difficoltà.
5. **Materiale ambiguo** — misto lana/acrilico, viscosa che sembra seta,
   piqué che sembra jersey: materiali che si confondono anche dal vivo.
6. **Ai margini della tassonomia** — una gonna o un vestito corto, capi che
   nella nostra tassonomia fissa (`TipoCapo`: top, pantaloni, scarpe,
   capospalla, abito, accessorio) non hanno una casella ovvia. Misura se il
   modello segue le istruzioni del system prompt, non se «vede bene».
7. **Un accessorio** — sciarpa, cintura, cappello: nessuno slot avatar, per
   vedere se il modello risponde `accessorio` invece di forzarlo in un tipo
   sbagliato.
8. **Una fantasia non a tinta unita** — righe, quadri, pois, una fantasia
   floreale piccola. Quasi tutti i capi facili sono «tinta unita»: questo è
   quello che stressa il campo `fantasia` davvero.
9. **Una mezza stagione** — una giacca leggera, un trench, un capo da
   stagione di passaggio: verifica se il modello usa `mezza_stagione`
   invece di appiattire su primavera o autunno.
10. **Etichetta leggibile in primo piano** — fotografa il cartellino interno
    a fuoco, insieme al capo: è l'unico dei dieci in cui `materiale`,
    `lavaggio` e la taglia dentro `vestibilita` sono davvero valutabili.
    Sugli altri nove, quei tre campi restano "non valutati" — vedi sotto.

Non serve rispettare l'ordine alla lettera: se un tuo capo copre due
caratteristiche insieme (es. un maglione di lana con l'etichetta a vista),
va benissimo, e ne libera un decimo per qualcos'altro.

## Come e cosa fotografare

Le stesse condizioni che il prodotto si aspetta davvero — non uno studio
fotografico. `domain.vision.SYSTEM_PROMPT_ANALISI` lo dice esplicitamente al
modello: *"scattata in casa da una persona qualunque: luce imperfetta, capo
steso sul letto o appeso a una porta"*. Un banco di valutazione fatto con
foto professionali misurerebbe un'altra cosa.

- Un capo per foto, ben visibile, senza altri capi in primo piano.
- Salva ogni foto come `c01.jpg`, `c02.jpg`, … `c10.jpg` dentro questa
  cartella (`tests/fixtures/campioni/foto/`), JPEG, indicativamente sotto i
  300 KB — non serve più risoluzione di quella che l'app userebbe davvero.
- Per il campione 10 (l'etichetta), assicurati che il testo sul cartellino
  sia leggibile nella foto, non solo presente.

## Come compilare la verità

Non serve scrivere JSON a mano: `docs/banco-di-prova-modelli.xlsx` (scheda
«Verità capi campione») ha le stesse 10 righe di `campioni.json`, con un
foglio «Leggimi» che spiega le convenzioni in italiano semplice. Compilalo lì
— anche chi non ha mai scritto una riga di codice può farlo — poi da
`services/api` genera il JSON con:

```
uv run python scripts/campioni_da_excel.py
```

Il resto di questa sezione descrive il formato JSON risultante: serve solo
se compili `campioni.json` direttamente, o per capire cosa produce lo script.

Il file ha già le 10 righe con l'`id`, la `descrizione` (la caratteristica
da coprire) e il nome del file foto atteso. Per ognuna, riempi `verita` con
un valore per gli attributi che la foto permette davvero di giudicare —
`domain.models.AttributoCapo`: `tipo`, `colore`, `materiale`, `fantasia`,
`stagione`, `vestibilita`, `lavaggio`.

Tre modi di riempire un attributo, non uno solo:

```json
"tipo": { "attesi": ["top"] }
```
Un valore atteso. `vicini` (opzionale) elenca le risposte che consideri
comunque corrette per differenza lessicale, non di sostanza:
```json
"colore": { "attesi": ["panna"], "vicini": ["écru", "avorio", "bianco sporco"], "hex": "#E7DFD2", "tolleranza_hex": 45 }
```
Il colore è l'unico attributo con `hex` — è quello che conta davvero per il
punteggio (la distanza di colore, non il nome). Misuralo con un
selettore di colore su una foto scattata bene, o stimalo a occhio: la
`tolleranza_hex` (0-255, default 40) è quanto margine dai al modello prima
di dire «sbagliato» — alzala per capi da foto difficili (es. 80-90 sul
campione con luce avversa), abbassala per i colori netti del campione 1.

```json
"lavaggio": { "assente": true }
```
Un'assenza attesa: `null` è la risposta *giusta* — l'etichetta non è nella
foto. Usalo per tutti gli attributi che la foto non permette di leggere sui
campioni 1-9 (quasi sempre `lavaggio`, spesso `materiale` e la taglia dentro
`vestibilita`).

**Non scrivere nulla** per un attributo che non sai giudicare nemmeno tu
guardando la foto (es. il materiale esatto senza etichetta, se non sei
sicuro nemmeno tu): ometterlo da `verita` lo esclude dal punteggio invece di
contarlo come sbagliato per entrambi — «non valutato» è onesto, «assente» è
una risposta positiva che il modello deve indovinare (dire null), sono cose
diverse.

## Cosa NON serve fare

- Non serve una foto di una persona: la generazione immagini valutata in
  questo banco lavora solo sul capo, mai su chi lo indossa.
- Non serve licenziare o attribuire nulla: sono foto tue, di capi tuoi.
- Non serve rifare la foto se viene "brutta" — anzi, una foto imperfetta è
  spesso il punto (vedi caratteristica 3).
