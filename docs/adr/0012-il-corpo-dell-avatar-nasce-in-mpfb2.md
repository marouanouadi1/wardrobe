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

**Il corpo base è quello di MakeHuman, costruito con MPFB2** dentro Blender.

MPFB2 è un add-on di Blender (4.2 o successivo), installato dalla piattaforma
delle estensioni. È la linea attiva del progetto MakeHuman: il programma
standalone è fermo dal 2020 e la sua ultima versione è stata di sole correzioni.
MPFB2 usa gli stessi asset di sistema e lo stesso formato di MakeHuman, e non ha
bisogno del programma per funzionare.

**Non è una dipendenza dell'app né del backend.** Non entra in `package.json`,
in `pyproject.toml`, né in un container: è uno strumento di produzione dei
contenuti, su una macchina di lavoro. Nel repo e nell'app entra solo il suo
**output**:

1. in Blender, con MPFB2, si costruisce il corpo base e si fissano i livelli
   dell'ADR 0011 — altezza, spalle, corporatura. Ogni livello è una **shape
   key** della mesh;
2. si esporta in **glTF** con le shape key, usando «create export copy» di MPFB2
   per applicare i modificatori senza perdere le shape key né il personaggio
   originale;
3. l'app spedisce quel file come asset statico, lo disegna con un visualizzatore
   3D e regola i pesi dei morph target leggendo `Profilo.misure`. Niente
   chiamata al backend, niente MakeHuman a runtime.

I template dei capi seguono la stessa strada: si modellano in Blender sulla
stessa mesh base, con le stesse shape key, e si esportano allo stesso modo.

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
- quale visualizzatore 3D usa l'app, e come si disegna;
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
parametrici. MPFB2 ha dalla sua uno strumento maturo per modellare i vestiti
sullo stesso corpo dentro Blender, cioè il pezzo che i template richiedono, e un
ecosistema di target e asset CC0 già fatto. Non sono esclusi per sempre: cambiare
corpo base vuol dire rifare i template, ed è questo il costo da conoscere.

**Blender senza interfaccia sul server, una mesh per utente.** Possibile, non
necessario: con pochi livelli i morph target si regolano in app a costo zero.
Tornerebbe utile solo se il server dovesse stimare i livelli da una foto, ed è
una decisione a parte.

**Il programma MakeHuman standalone.** Fermo, con una base di codice che il
progetto stesso non porta avanti. Produce gli stessi file di MPFB2, ma esporta
solo in formati che poi andrebbero comunque fatti passare da Blender.
