# 0012 — Il corpo dell'avatar nasce in MPFB2, e nell'app arriva solo il suo output

**Stato:** accettata · **Data:** 2026-10-23 · **Chiude:** `D-04` di
`docs/DOMANDE_APERTE.md` · **Discende da:** [0011](0011-il-corpo-a-manopole-e-i-capi-da-template-tornano-possibili.md)

## Contesto

L'ADR 0011 ha ammesso un corpo parametrico regolato su pochi livelli scelti da
noi, e ha lasciato all'utente la scelta del corpo base fra MPFB2 (MakeHuman per
Blender), Anny (NAVER LABS Europe) e MHR (Meta). I template dei capi si
modellano su quel corpo, con le sue stesse shape key: la scelta andava fatta
prima dei capi.

Nel decidere è venuta fuori una domanda che vale la pena fissare, perché il nome
«MakeHuman» la rende ambigua: **MakeHuman è un pacchetto da aggiungere al
progetto, un programma, o altro?**

## Decisione

**Il corpo base è quello di MakeHuman, costruito con MPFB2** dentro Blender. La
scelta è dell'utente, il 2026-10-23.

MPFB2 è un add-on di Blender (4.2 o successivo), installato dalla piattaforma
delle estensioni. È la linea attiva del progetto MakeHuman: il programma
standalone è fermo dal 2020 e la sua ultima versione è stata di sole correzioni.
MPFB2 usa gli stessi asset di sistema e lo stesso formato di MakeHuman, e non ha
bisogno del programma per funzionare.

**Non è una dipendenza dell'app né del backend.** Non entra in `package.json`,
in `pyproject.toml`, né in un container: è uno strumento di produzione dei
contenuti, su una macchina di lavoro. Del progetto entra solo il suo **output**:

1. in Blender, con MPFB2, si costruisce il corpo base e si fissano i livelli
   dell'ADR 0011 — altezza, spalle, corporatura. Ogni livello è una **shape
   key** della mesh;
2. si esporta in **glTF** con le shape key, usando «create export copy» di MPFB2
   per applicare i modificatori senza perdere le shape key né il personaggio
   originale.

I template dei capi seguono la stessa strada: si modellano in Blender sulla
stessa mesh base, con le stesse shape key, e si esportano allo stesso modo.

**La direzione attesa per il runtime, non decisa qui**: l'app spedisce il glTF
come asset statico e regola i pesi dei morph target da sé, senza chiamare il
backend e senza MakeHuman. È la strada più corta che i livelli pochi dello 0011
permettono, ma chi disegna il 3D e da quali dati legge i pesi restano aperti —
vedi sotto.

**Licenze.** Il codice di MPFB2 è GPL e quello di MakeHuman è AGPL, ma non li
distribuiamo. La mesh base, i target e gli asset di sistema sono CC0, e la FAQ
del progetto dichiara che non ci sono restrizioni né sull'output né sugli asset
inclusi. I vestiti e gli asset della community hanno licenze miste: ognuno si
controlla prima di usarlo, e un template nostro è la via che non pone la
domanda.

## Cosa questo ADR non decide

- la faccia (`D-10`), se i livelli sostituiscono o arrotondano i centimetri
  (`D-11`), da quale corpo base parte ciascuno (`D-12`): restano aperte, ma ora
  hanno un corpo su cui ragionare;
- come si disegna il 3D nell'app: quale visualizzatore, e se il glTF viaggia
  dentro l'app o arriva da fuori. Lo 0011 lo lasciava aperto, e resta aperto;
- da dove si leggono i pesi dei livelli: da `Profilo.misure` com'è oggi, o da
  un campo nuovo, dipende da `D-11`;
- quanti e quali livelli: pochi, per l'ADR 0011, e scelti guardando le
  combinazioni capo × corpo una per una.

## Conseguenze

- I file esportati sono asset del repo, e il sorgente Blender (`.blend`) va
  conservato con loro: un glTF non si rigenera dal nulla.
- Una modifica a un livello del corpo tocca **tutti** i template dei capi, che
  devono avere la stessa shape key. È il prezzo dichiarato nello 0011.
- La stima dei livelli da una foto a figura intera (SAM 3D Body o simili) resta
  compatibile: produrrebbe gli stessi pesi che oggi vengono da `Misure`. È un
  flusso di dati verso un servizio esterno e si approva a parte.

## Alternative scartate

**Anny (NAVER LABS Europe) e MHR (Meta).** Entrambi Apache 2.0, entrambi
parametrici. L'utente ha scelto MakeHuman il 2026-10-23. Le differenze che si
possono verificare:

- MPFB2 vive dentro Blender, cioè dove si modelleranno i template dei capi;
- la mesh base e gli asset di sistema di MakeHuman sono CC0;
- **il rischio noto**: il progetto stesso dichiara che alcune parti di MPFB2
  non sono finite e che alcuni strumenti sono stati provati poco. Va messo in
  conto prima di appoggiarci un flusso intero.

Non sono esclusi per sempre: cambiare corpo base vuol dire rifare i template, ed
è questo il costo da conoscere.

**Blender senza interfaccia sul server, una mesh per utente.** Possibile, non
necessario: con pochi livelli i morph target si regolano in app a costo zero.
Tornerebbe utile solo se il server dovesse stimare i livelli da una foto, ed è
una decisione a parte.

**Il programma MakeHuman standalone.** Fermo dal 2020, con una base di codice
che il progetto stesso non porta avanti. Usa gli stessi asset e lo stesso
formato di MPFB2, quindi non dà niente che MPFB2 non dia già.
