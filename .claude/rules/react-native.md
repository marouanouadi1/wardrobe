# Standard React Native — app `apps/mobile`

Lo legge: `mobile`, e `reviewer` quando il diff tocca `apps/mobile/`.


## Prima di aggirare un problema, chiedi se puoi toglierlo

> Se togliessi la mia soluzione, il problema tornerebbe? Se sì, è un **tampone**:
> la causa è ancora dove era.

Un tampone è legittimo quando la causa non si può togliere adesso — ma allora si
**dichiara** dov'è, si apre la voce del rimedio in `docs/DA_FARE.md`, e quando il
rimedio arriva **il tampone si toglie**.

Il segnale che distingue i due casi: **il rimedio toglie righe, il tampone ne
aggiunge.**

Per esteso, con l'esempio, in `CLAUDE.md` e in `docs/adr/0008`.

## L'invariante

**Una schermata compone le primitive: non ridefinisce una card, un bottone o un
badge a mano, e non compone un colore da sé.** Se manca una forma si aggiunge in
`src/ui/`; se manca un colore si aggiunge a `src/tema/tokens.ts`.

## Le nove primitive

Sono **nove**, non sette. Guardale prima di crearne una: quasi sempre esiste già
qualcosa che fa il 90%.

| File | Cosa contiene |
|---|---|
| `src/ui/base.tsx` | il grosso: `Toccabile`, `Campo`, `Scheda`, `Pillola`, `Segmenti`, `BottonePrimario`, `BottoneSecondario`, `Badge`, `BollaChat`, `Icona`, `BottoneTondo`, `LinkTesto`, `Comparsa`… |
| `src/ui/testo.tsx` | `Titolo`, `Numero`, `Corpo`, `Forte`, `TestoErrore`, `Etichetta`, e il tipo `Taglia` |
| `src/ui/stati.tsx` | `Caricamento`, `AttesaLunga`, `Vuoto`, `Errore`, `StatoRisorsa` |
| `src/ui/guscio.tsx` | `Testata`, `Schermata`, `GuscioAutenticazione` |
| `src/ui/righe.tsx` | `RigaNavigabile`, `RigaStatistiche` |
| `src/ui/capi.tsx` | `SchedaFoto`, `PiedeFoto`, `CapoInGriglia`, `Miniatura`, `Attributo` |
| `src/ui/avviso.tsx` | `Avviso` (coriandolo globale), `Conferma` |
| **`src/ui/fondo.tsx`** | il tipo `Su`, `Fondo`, `useFondo()` — **la base della regola qui sotto** |
| **`src/ui/scheletri.tsx`** | `Blocco`, `ScheletroProposta`, `ScheletroGrigliaCapi`, `ScheletroCalendario`, `ScheletroSchedaOutfit` — 280 righe di forme già pronte |

## `su`: il fondo si eredita, non si ridichiara

> **La fonte normativa è il docblock di `src/ui/fondo.tsx:1-22`. Rileggilo: qui
> c'è la sintesi, lì c'è il ragionamento.**

`su` (`'chiaro' | 'scuro'`) dice su che fondo un componente si posa. Dal commit
`ee7f492` **non è più una prop passata a mano riga per riga: è un contesto React**
(`<Fondo>` / `useFondo()`). Il motivo: `Scheda` e `BollaChat` ricevono
`children: ReactNode`, e un `ReactNode` non si può far attraversare da una prop.

Tre casi, e sbagliarli produce testo invisibile:

| Chi | Cosa scrive | Perché |
|---|---|---|
| dipinge **in opaco** | `su={su ?? 'chiaro'}` — **asserisce** ciò che dipinge | altrimenti una `Scheda` chiara dentro una `Schermata su="scuro"` erediterebbe `'scuro'` e il suo testo ci sparirebbe sopra |
| dipinge **in trasparenza** (velature al 4-6%, `Segmenti`, `Attributo`) | `su={su}` — **inoltra** | una velatura non fonda un fondo: prende quello di sotto, e asserire lì fabbricherebbe lo stesso difetto capovolto |
| non dipinge nulla | **non lo scrive**: eredita | |

**`tsc` non vede questa classe di difetti**, perché `su` è opzionale. È già
costata una regressione reale: la PR #4, «Fix invisible text on the onboarding
light button». Da qui il test in `test/ui/leggibilita.test.tsx`, che non verifica
l'inoltro di una prop ma **il colore risolto contro il fondo effettivamente
dipinto** — un invariante che sopravvive al prossimo refactor del meccanismo.

## I colori: nessuno si compone a mano

`src/tema/tokens.ts` è la fonte di verità per colori, tipografia, spazi, raggi,
ombre, durate. La regola scritta in cima al file vale come vincolo di prodotto:
**`colori.ambra` (`#F5B324`) compare solo dove parla il modello** — badge di
match, «letto dalla foto» — mai su un'azione dell'utente.

La regola completa: **nessun colore composto a mano, primitive incluse.** Vale
per gli esadecimali *e* per i letterali `rgba()`, che sono la violazione che resta
oggi. Per una velatura c'è `velo(colore, alfa)` (`tokens.ts`). Esempio del perché:
`app/calendario.tsx:99` scrive `rgba(21,21,26,0.4)`, che **è** esattamente
`testoSu.chiaro.debole` — una costante duplicata che nessuno aggiornerà quando il
token cambia.

Non sono violazioni, e non vanno «corrette»: `PALETTE_COLORI` in
`src/dati/dominio.ts` (sono i colori **dei capi**, dati di dominio) e
`backgroundColor` in `app.json` (configurazione nativa dello splash, non può
importare un token).

**Un fondo non si ridipinge dal di fuori.** `<BottonePrimario style={{
backgroundColor: … }} />` cambia il fondo e lascia dentro un testo calcolato per
quello vecchio: è la forma esatta della regressione di PR #4. Se serve un fondo
diverso, si aggiunge **una variante alla primitiva** (come `ambra` e `chiaro` su
`BottonePrimario`), così il colore del testo si calcola insieme al fondo. Lo
verifica `test/convenzioni/primitive.test.ts`.

## Le props: i nomi sono una convenzione, non un gusto

| Prop | Significato |
|---|---|
| `colore` | il primo piano: testo, icona |
| `sfondo` | il fondo |
| `taglia` | il corpo del carattere |
| `misura` | la dimensione di un'icona o di una bolla |
| `su` | su che fondo il componente si posa |

`su` è `'chiaro' | 'scuro'`, **mai** un booleano `scuro`/`scura`: il booleano
costringerebbe all'accordo di genere e quindi a scrivere il nome due volte.

## Lo stato di una risorsa

Due meccanismi legittimi, e vanno distinti prima di dire che qualcosa è duplicato:

1. **`src/dati/risorsa.ts`** — `useRisorsa(fetcher)` per una risorsa che si carica
   al montaggio, `useAzione()` per un'azione che aspetta un tocco. Entrambe danno
   `caricamento`/`errore` pronti per `<StatoRisorsa>` o `<Caricamento>`.
2. **`src/dati/archivio.tsx`** — lo store: `useArmadio()` espone già `pronto`,
   `erroreCaricamento`, `suggerimentiInCorso`. Le schermate che leggono di lì
   **non stanno aggirando `useRisorsa`**: stanno usando l'altra gamba del sistema.

Quello che non si fa è **una terza strada**: una nuova coppia
`useState<boolean>` per caricamento ed errore dentro una schermata, o una
sequenza di chiamate API scritta a mano quando una delle due astrazioni la
copre.

Due dettagli in `risorsa.ts` che sembrano stranezze e non lo sono — non
«semplificarli»: la `useRef` su `carica` invece di metterla nelle dipendenze, e
il `setTimeout(…, 0)` nell'effetto, che sposta le `setState` fuori dal corpo
sincrono (regola `react-hooks/set-state-in-effect`).

## Le enum non si ridigitano

`TIPI_CAPO`, `STAGIONI` stanno in `src/dati/dominio.ts`; `VALORI_*` e le soglie
arrivano da `@wardrobe/contracts`. Dettaglio e catena in
`.claude/rules/contratti.md`. Due copie della stessa enum divergono in silenzio —
è già successo.

## Un tampone in piedi, e va saputo

`apps/mobile/package.json` contiene un `jest.moduleNameMapper` che forza i test a
risolvere una copia sola di React. **È un tampone, non un rimedio**
(`docs/adr/0008`): le due copie continuano a esistere, e il conflitto resta
attivo ovunque fuori dai test.

La causa è che il `package.json` della root non dichiara `react`, mentre decine di
pacchetti hoisted lì lo chiedono come peer con `*`. Il rimedio è dichiararlo in
root — e **quando arriva, il mapper si cancella**.

Sta scritto qui perché `package.json` è JSON e non può portare un commento: il
posto dove lo si incontra non può spiegarlo. Voce completa: `T-23` in
`docs/DA_FARE.md`.

## Dove NON vanno i test

**Mai sotto `apps/mobile/app/`**: `main` è `expo-router/entry`, quindi ogni file
lì dentro diventa una **rotta**. Un `oggi.test.tsx` registrerebbe `/oggi.test` e
finirebbe nel bundle di `expo export --platform web`, che gira in CI. I test
vivono in `apps/mobile/test/`.

## Verifica prima di chiudere

```bash
npm run typecheck --workspace @wardrobe/mobile
npm run lint --workspace @wardrobe/mobile
npm run mobile:test
npm run build:web --workspace @wardrobe/mobile
```
