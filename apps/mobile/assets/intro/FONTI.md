# Da dove vengono le immagini di `assets/intro/`

Questo file esiste perché queste immagini finiscono dentro un APK distribuito: di
ognuna si deve poter dire da dove viene e con che diritto la usiamo. **Un'immagine
che entra qui senza la sua riga non entra.**

## La giostra del passo 1

Sei degli otto capi sono **generati con Google Gemini** dall'utente il 2026-09-23, in due tavole da
otto riquadri ciascuna (`Gemini_Generated_Image_mzmyvqmzmyvqmzmy.jpeg` e
`Gemini_Generated_Image_yu0vpgyu0vpgyu0v.jpeg`, 1408×768). Da lì ogni capo è stato
ritagliato dal suo riquadro e scontornato.

| File | Tavola, riquadro | Lavorazione oltre lo scontorno | Lato × lato | Peso |
|---|---|---|---|---|
| `felpa-rossa.png` | `mzmy…`, riga 2 col. 1 | tolto il gancio della gruccia | 212×270 | 64 KB |
| `pantaloni-turchesi.png` | `mzmy…`, riga 1 col. 2 | — | 220×278 | 52 KB |
| `abito-a-fiori.png` | `yu0v…`, riga 1 col. 2 | tolta la gruccia di legno | 142×284 | 78 KB |
| `maglietta-viola.png` | `mzmy…`, riga 2 col. 3 | tolta la gruccia sopra il colletto | 239×261 | 89 KB |
| `cappello-fucsia.png` | `mzmy…`, riga 1 col. 4 | tolto lo sgabello (per colore, poi riempiti i buchi chiusi) | 279×155 | 75 KB |
| `sneaker-multicolore.png` | `yu0v…`, riga 1 col. 1 | — | 235×119 | 45 KB |

**Con che diritto.** Non c'è una licenza di terzi: le immagini non vengono da una
banca immagini né da un sito di prodotti. Le ha generate l'utente, e i Termini di
servizio di Google, sezione «Your content», dicono: *«Some of our services allow
you to generate original content. Google won't claim ownership over that
content.»* (<https://policies.google.com/terms>, verificato il 2026-09-23). Il rischio di
un'immagine generata non è il copyright di un fotografo: è che il modello riproduca
un **marchio**. Per questo ogni capo è stato guardato ingrandito prima di entrare,
e uno è stato scartato (sotto). Restano due etichette senza scritta leggibile: il
cartellino scuro sul collo della felpa e quello bianco dentro la maglietta.

**Perché sono sotto i 600 px chiesti.** Ogni riquadro della tavola è di circa
350×380: più di così non c'è. Basta comunque, perché il cerchio ha un tetto
(`LATO_MASSIMO` in `app/intro.tsx`, il lato di un 390×844). La tessera più grande
è larga 94 pt su qualunque schermo, e la foto ne occupa l'82%: circa 77 pt, cioè
231 px a densità 3×. Senza il tetto, su un 430×932 si arriverebbe a 106 pt, e su
un tablet Android a 208 pt: lì le foto si stirerebbero.

**Come sono state lavorate.** Ritaglio del riquadro con ImageMagick. Scontorno con
`rembg` (modello `isnet-general-use`), in un ambiente Python usa-e-getta **fuori dal
repo**, quindi nessuna dipendenza nuova. Poi taglio sul contorno. Le correzioni
della tabella sono fatte con maschere per colore e per componente connessa.
Controllo finale: ogni PNG composto su bianco, cioè sul fondo della `Scheda` che lo
ospita, e guardato.

### Eccezione: `giacca-pelle.png` e `borsa-nera.png` — fonte sconosciuta

| File | Lavorazione oltre lo scontorno | Lato × lato | Peso |
|---|---|---|---|
| `giacca-pelle.png` | cancellato il marchio «FIVE FOUR FIVE» dall'etichetta e dalla fodera | 600×587 | 58 KB |
| `borsa-nera.png` | — | 320×465 | 117 KB |

**Queste due righe non rispettano la regola in testa al file, e lo dicono.** Le ha
fornite l'utente il 2026-09-23 (`jacket.webp`, 1600×2001, e `borsa.jpg`, 452×584)
**senza una fonte**. Dai file sembrano foto da catalogo di un negozio online: la
giacca portava un marchio leggibile sull'etichetta e ripetuto sulla fodera, e la
borsa è stata ridimensionata da un server web (`gd-jpeg`). Il problema è stato
detto all'utente prima di montarle, e l'utente ha deciso di metterle lo stesso,
come eccezione.

Il marchio è stato tolto, ma **il diritto d'autore sulla foto resta di chi l'ha
scattata**: la licenza di queste due immagini non la sappiamo. Il rimedio è
sostituirle con due immagini di cui si possa scrivere la riga, per esempio due capi
generati come gli altri sei. La voce è `T-49` in `docs/DA_FARE.md`: quando si
chiude, questa sezione sparisce.

### Scartate, e perché

- **Le sneaker gialle** della tavola `mzmy…` (riga 1 col. 3): portano lo swoosh Nike.
- **La gonna verde** (`mzmy…`, riga 2 col. 4) e **i mocassini arancio** (`yu0v…`, riga 2
  col. 3): erano nella giostra, e sono usciti per far posto a giacca e borsa.
- **Le tre foto scaricate dall'utente** (`vestito_1.jpg`, `vestito_2.jpg`,
  `vestito_3.jpg`): senza il link della pagina d'origine la licenza non si può
  scrivere qui. `vestito_2` avrebbe comunque avuto lo swoosh Nike e una persona.

## I passi 2 e 3

`felpa-blu-con-cappuccio.png`, `pantaloni-grigi-dritti.png` (la proposta del passo
3) e `omino-fronte.png` (il passo 2) vengono dal deck di design
`~/wardrobe-schermate/` e non sono stati toccati da questa modifica. La stanga del
passo 1 usava anche `ciabatte-blu-tre-strisce.png`, cancellata insieme alla stanga:
non la leggeva più nessuno.
