# 0013 — Il corpo si calcola nell'app, dai dati di MakeHuman, e si disegna con `three`

**Stato:** accettata · **Data:** 2026-10-24 · **Discende da:** [0012](0012-il-corpo-dell-avatar-nasce-in-mpfb2.md) · **Decide:** come si disegna il 3D nell'app, che lo 0011 e lo 0012 lasciavano aperto

## Contesto

Lo 0012 ha scelto il corpo di MakeHuman e ha lasciato aperte due cose: **chi disegna il 3D
nell'app**, e se il corpo ci arriva come glTF. Indicava una direzione attesa — un glTF con
una shape key per livello, i cui pesi l'app regola da sé — senza deciderla.

Il 2026-10-24 l'utente ha chiesto di portare l'avatar di MakeHuman nella scheda «Come mi
sta», con i cursori che l'agente ritiene opportuni, e di rivederli poi uno per uno in una
pagina a parte per decidere cosa tenere. L'elenco dei cursori, quindi, **cambierà** subito
dopo essere nato.

Due prove fatte fuori dal repo pesano sulla scelta (`~/wardrobe-banco-3d/makehuman/STATO.md`):

- l'**esploratore dei cursori** del 18 ottobre rifà in JavaScript il conto di MPFB sui suoi
  dati grezzi, e coincide con MPFB entro la quantizzazione dei target (0,011 mm);
- la **strada dei morph cotti** (un glTF con un morph per livello) funziona, ma le macro di
  MakeHuman si moltiplicano fra loro: la somma di morph diversi è un'approssimazione,
  misurata fino a 0,31 cm, e ogni cambio di elenco vuol dire rifare il glTF in Blender.

## Decisione

**Il corpo si calcola nell'app, con lo stesso conto di MPFB, e si disegna con `three` su
`expo-gl`.**

1. **I dati sono quelli di MakeHuman, non un glTF.** `tools/avatar/estrai.py` legge dai file
   di MPFB 2.0.18 il corpo base, i target, lo scheletro e gli accessori, e li mette in tre
   pacchetti in `apps/mobile/assets/avatar/` (`comune.bin`, `donna.bin`, `uomo.bin`). Dentro
   ci sono **solo i target che i cursori dell'app possono chiedere**, calcolati dall'elenco;
   le macro che l'app non muove (età, proporzioni, sodezza, etnie) stanno al centro. Sono
   CC0 come tutto ciò che viene da MakeHuman (ADR 0012).
2. **Il motore è `apps/mobile/src/avatar/motore.ts`**: il motore dell'esploratore portato in
   TypeScript, senza `three` e senza React Native. Forma, aggancio degli accessori (`.mhclo`),
   posa a braccia giù, altezza cercata dai centimetri. Lo prova
   `test/avatar/motore.test.ts` contro vertici calcolati da MPFB vero in Blender
   (`tools/avatar/riferimento.py`).
3. **Si disegna con `three`, da solo**, sul contesto WebGL di `expo-gl` (`scena.ts`,
   `VistaAvatar.tsx`), sul telefono come sul web. **Niente `@react-three/fiber`**: la sua
   entrata nativa è CommonJS e faceva caricare a Metro due istanze di `three` (`T-35`). Senza
   di lui il bundle Android ne ha una sola — verificato sulla source map.
4. **L'elenco dei cursori è uno, in `src/avatar/cursori.ts`**: lo leggono la schermata, il
   motore, l'estrattore (con `node`) e la pagina di revisione. Ogni cursore è un cursore di
   MakeHuman con il suo nome, su **cinque livelli**, perché lo 0011 e lo 0012 li vogliono
   pochi.
5. **Il profilo salva i cursori per nome**: `Avatar.cursori` è `{nome di MakeHuman: valore}`
   in una colonna `jsonb`, accanto al corpo di partenza, alla pelle e ai capelli. Togliere o
   aggiungere un cursore non chiede né una migrazione né un cambio di contratto. L'altezza
   resta `Misure.altezza_cm` (ADR 0011).

## Perché non il glTF a morph target

- **L'esattezza.** Calcolando i target come MPFB, ogni combinazione di cursori è il corpo che
  MakeHuman darebbe, non una somma approssimata di morph.
- **Il costo di cambiare elenco.** Uno script Python di cinque secondi, senza Blender, contro
  un glTF da rifare. È il costo che conta adesso, con l'elenco in revisione.
- **Gli accessori e i capi.** Capelli, strato neutro e — domani — i capi da template si
  agganciano al corpo come in MakeHuman (`adatta()`, ClothesService), quindi seguono qualunque
  combinazione. Con i morph ogni capo dovrebbe portare le stesse shape key del corpo.
- **Meno dipendenze dalla GPU del telefono.** I morph di `three` passano da una texture 3D
  (`texImage3D`), che su `expo-gl` nessuno ha provato. Qui la GPU riceve solo posizioni.

## Cosa costa

- **I pacchetti pesano 12,4 MB**, e non sono compressi: Hermes non ha `DecompressionStream`
  e una libreria in più per scompattarli è un'altra dipendenza. L'APK è uno zip e li
  comprime da sé. Il grosso sono i target delle macro, che toccano tutti i 19.158 vertici.
- **Il conto gira sul processore del telefono** a ogni tocco su un livello: 14 ms in un
  Chrome da scrivania; **su Hermes non è stato misurato**. I livelli aiutano: un tocco, un
  conto, non uno per ogni frame di trascinamento.
- **Ogni rigenerazione dei pacchetti aggiunge circa 12 MB alla storia di git**: sono
  binari, e git non li comprime bene. Con l'elenco in revisione ne arriveranno alcune;
  se diventano molte, la strada è Git LFS o una cartella fuori dal repo, ed è da decidere.
- **I pacchetti e il riferimento del test si rigenerano a mano**, su una macchina con
  Blender 4.5 e MPFB: la CI non li può rifare, li confronta soltanto.

**La posa fa parte del corpo.** Il motore mette le braccia distese lungo i fianchi
(`POSA` in `motore.ts`, scelta dell'utente del 2026-10-24), e un capo da template si
drappeggia **in questa posa**, come la maglietta di prova del 23 ottobre si drappeggiava in
quella di allora (braccia a 12°, gomito piegato): cambiare la posa vuol dire rifare il
drappeggio dei capi.

## Cosa questo ADR non decide

- **Quali cursori**: l'elenco di oggi è una proposta dell'agente, in revisione dall'utente.
- La faccia (`D-10`), i livelli contro i centimetri (`D-11`: oggi solo l'altezza è collegata a
  `Misure`), le parole del corpo di partenza (`D-12`).
- **Come l'avatar indossa i capi**: per ora porta uno strato neutro grigio (un abito di
  sistema di MakeHuman, di una tinta sola), e l'outfit si legge accanto. Tingere un modello
  del colore dominante resta escluso (ADR 0011).

## Alternative scartate

**`@react-three/fiber` su `expo-gl`.** È quello che usava il banco scartato a settembre:
porta la causa di `T-35`, e per una scena con un corpo solo non dà niente che `three` da solo
non dia.

**Una WebView con l'esploratore dentro.** Riuserebbe il codice validato così com'è, ma
`react-native-webview` non c'è sul web, i dati dovrebbero passare come testo, e ci sarebbero
due motori da tenere allineati invece di uno.

**Un corpo per utente cotto sul server** (Blender senza interfaccia). Già scartato dallo
0012: con pochi livelli il telefono basta.
