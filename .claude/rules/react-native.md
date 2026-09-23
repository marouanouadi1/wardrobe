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
| `src/ui/stati.tsx` | `Caricamento`, **`PistaIndeterminata`**, `AttesaLunga`, `Vuoto`, `Errore`, **`SenzaRete`**, `StatoRisorsa` |
| `src/ui/guscio.tsx` | `Testata` (con lo slot **`azioni`** a destra del titolo, alternativo a `fotoProfilo`), `Schermata`, `GuscioAutenticazione`, **`BarraSchede`** + `schedaDi()`, **`SfondoAura`** (il gradiente + i due aloni radiali del deck; i colori stanno in `fondi`, la geometria qui) |
| `src/ui/righe.tsx` | `RigaNavigabile`, `RigaStatistiche`, **`RigaImpostazione`** |
| `src/ui/capi.tsx` | `SchedaFoto`, `PiedeFoto`, `CapoInGriglia`, **`CasellaAggiungi`**, **`SchedaOutfit`**, **`ElencoOutfit`**, **`RigaFotoInCoda`**, **`SlotMancanti`** (la lista che `(tabs)/armadio.tsx` e `app/outfit.tsx` mostrano **entrambe**), `Miniatura`, `MiniaturaFoto`, `MotiviProposta`, `Attributo` |
| `src/ui/avviso.tsx` | `Avviso` (coriandolo globale), `Conferma`, **`Foglio`** (il menu che sale dal basso: una voce **senza `onPress` è spenta e mostra il suo `perche`**, non viene omessa) |
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
**l'azione è `colori.inchiostro`, non l'accento.** Ogni azione primaria e ogni
pillola selezionata si dipingono di inchiostro; `colori.primario` (`#5566D6`) fa
il cromo, i link e i luoghi dove parla il modello. L'unica azione tinta di
primario è il «+» della barra delle schede.

*Fino al 2026-09-22 la regola era un'altra* — «l'ambra è dell'intelligenza
artificiale, e in nessun altro posto» — *e l'ambra non esiste più*: la palette
viene dal deck «Aura», dove l'accento fa **entrambi** i mestieri. Se il modello
deve tornare ad avere un colore suo, il posto è `tokens.ts` e il costo è una
riga: la scelta è registrata in `docs/QUESTIONI.md`.

La regola completa: **nessun colore composto a mano, primitive incluse.** Vale
per gli esadecimali *e* per i letterali `rgba()`. Per una velatura c'è
`velo(colore, alfa)` (`tokens.ts`). Esempio del perché: `app/calendario.tsx:99`
scriveva `rgba(21,21,26,0.4)`, che **è** esattamente `testoSu.chiaro.debole` —
una costante duplicata che nessuno avrebbe aggiornato quando il token fosse
cambiato. Da `T-19`/`T-20` (`docs/DA_FARE.md`) questa classe non è più solo
scritta: `test/convenzioni/colori.test.ts` la rifiuta, leggendo `app/` e `src/`
con l'AST di TypeScript.

Non sono violazioni, e non vanno «corrette»: `PALETTE_COLORI` in
`src/dati/dominio.ts` (sono i colori **dei capi**, dati di dominio) e
`backgroundColor` in `app.json` (configurazione nativa dello splash, non può
importare un token).

**Un fondo non si ridipinge dal di fuori.** `<BottonePrimario style={{
backgroundColor: … }} />` cambia il fondo e lascia dentro un testo calcolato per
quello vecchio: è la forma esatta della regressione di PR #4. Se serve un fondo
diverso, si aggiunge **una variante alla primitiva** (come `accento` e `chiaro`
su `BottonePrimario`, o `vetro` su `Scheda`), così il colore del testo si
calcola insieme al fondo. Lo verifica `test/convenzioni/primitive.test.ts`.

## Le griglie: una riga ci deve stare, e `flexShrink` vale 0

Le misure delle griglie (`griglie.armadio`, `griglie.outfit`, `griglie.mese`)
stanno in `tema/tokens.ts` perché una schermata e il suo scheletro devono
disegnarle identiche — **le altezze di testo comprese**: `altezzaNome` non è un
numero scelto, è l'interlinea vera del componente che sta al suo posto
(`Math.round(tipografia.minuto * 1.3)`, che è ciò che `ui/testo.tsx` applica a
`Forte`). E il testo che uno scheletro promette alto una riga va tappato a una
riga sul serio: senza `numberOfLines={1}` un nome lungo ne prende due, la
tessera diventa più alta delle sorelle e in un `flexWrap` la riga va storta. Ma c'è una seconda ragione, che è costata un difetto vero:

> In React Native **`flexShrink` è 0 di default**, al contrario del web. Una
> cella con `width: '13.1%'` dentro un `flexWrap` **non si stringe** per far
> entrare le sorelle: va a capo.

Non è un errore, non è un avviso, non è un tipo sbagliato. `griglie.mese`
chiedeva `7 × 13.1% + 6 × 6px`, che entra solo in uno schermo da 478pt: su ogni
telefono il calendario mostrava **sei** giorni per riga, con le lettere
disallineate rispetto alle date (`T-37`). Da qui
`test/convenzioni/griglie.test.ts`, che fa il conto — `n × colonna% × utile +
(n−1) × distanza ≤ utile`, con `utile` = larghezza meno due `spazi.xl` — da
320pt a 480pt.

**Se cambi il `paddingHorizontal` di `Schermata`, cambia anche quel test**: è la
stessa coppia che `Schermata` dichiara già verso `(tabs)/_layout.tsx`.

## Uno stato non è una rotta

Il deck disegna come schermate cose che nell'app sono **stati di una schermata
che esiste già**: `offline` («non ti raggiungo») e `pochicapi` («mi manca un
pezzo») vivono entrambe dentro `app/(tabs)/oggi.tsx`, perché a uno stato non si
naviga — non esiste un percorso `/offline`, e crearne uno vorrebbe dire poterci
arrivare quando la rete funziona.

Un deck non ha altro modo di mostrare uno stato che disegnarlo come schermata.
Tradurlo in una rotta è il modo più facile di sbagliare questa traduzione.

**E `SenzaRete` nasce da una richiesta fallita, non da un rilevatore di rete.**
`@react-native-community/netinfo` non è nel lock — e qui il lock ha già fatto
male tre volte (`T-03`, `T-23`, `T-31`) — ma la ragione vera viene prima: una
spia di rete direbbe «il wifi è acceso» mentre il server è giù. Quello che
sappiamo è `erroreCaricamento` di `useArmadio()`: non siamo riusciti a
parlargli. Si dice quello.

## La foto: la sequenza sta in `src/dati/foto.ts`, non nelle schermate

`caricaUnaFoto(uri)` e `analizzaFoto(uri, segnale?)` — più `analizzaCaricata(chiave)`,
che è quello che serve per **riprovare senza rimandare i byte**. Le quattro
chiamate erano scritte a mano in tre punti (`T-21`, chiusa).

Due cose da non rompere:

- **Il segnale copre solo la seconda metà.** `api.caricaFoto` passa da
  `expo-file-system`, non da `fetch`, e non accetta un `AbortSignal`: chi
  annulla mentre la foto sale vede la schermata cambiare, ma l'upload prosegue.
  Il docblock lo dice; nasconderlo sarebbe un regresso, non una semplificazione.
- **`EsitoAnalisi.errore` è testo, non un codice.** Si mostra, non si
  interpreta — `.claude/rules/python.md` dice che l'app discrimina sul campo
  `errore`, mai sul messaggio. È il motivo per cui le **due** schermate
  d'errore del deck («non riesco a staccare lo sfondo», «la lettura non è
  riuscita») nell'app sono **una**: non sono distinguibili.

## La barra delle schede vive fuori dal navigatore

`BarraSchede` (`src/ui/guscio.tsx`) è montata **una volta sola** in
`app/_layout.tsx`, sopra lo `Stack`. Stava nella prop `tabBar` di `<Tabs>`, e
per questo esisteva solo dentro il gruppo `(tabs)`: sul dettaglio di un capo,
in chat, sul calendario non era spenta — **non c'era**.

Il prezzo del trasloco è che lo stato del navigatore non è più disponibile: la
scheda accesa si deduce dal percorso con `schedaDi(usePathname())`.

**`schedaDi` è un elenco di ciò che c'è, non di ciò che si esclude.** Una rotta
che non compare nella mappa non accende nessuna scheda **e non mostra la
barra**. Capovolgerlo — «tutto tranne accedi e registrati» — farebbe comparire
la pillola sulla schermata di accesso alla prima rotta nuova che qualcuno
dimentica. `test/convenzioni/navigazione.test.ts` lo tiene fermo, e diventa
rosso anche quando una rotta nuova resta senza una decisione.

**La stessa funzione decide lo spazio in fondo.** `Schermata` aveva una prop
`tab` che ogni schermata di scheda doveva ricordarsi di passare, più un
commento in due file che diceva di tenere allineati i due conti: due modi di
sapere la stessa cosa. La prop non c'è più — `Schermata` chiama `schedaDi` da
sé, e `altezzaBarra()` è il conto, scritto una volta.

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

## Una sola copia di React, dichiarata in due punti

`react` e `react-dom` sono dichiarati **sia** in `package.json` di root **sia**
in `apps/mobile/package.json`, alla stessa versione esatta (oggi `19.2.3`,
pinnata da Expo SDK 57) — altrimenti tornano le due copie che `T-23` ha chiuso
(`docs/adr/0008`). **Quando Expo alza il pin, si alza in entrambi i file nella
stessa modifica**: `package.json` è JSON e non può portare un commento che lo
spieghi da solo, e questa riga è il posto dove si va a cercarlo.

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
