# Changelog

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

**Le versioni non si scrivono qui a mano**: le alza la pipeline di rilascio dai
conventional commit (`docs/adr/0005`). Qui si scrive **cosa è cambiato per chi usa
il prodotto**, con una riga in `## Non rilasciato` nella stessa PR che fa il
cambiamento.

Le sezioni sono tre perché ci sono **due flussi di versione indipendenti**
(`mobile-v*` e `api-v*`): un elenco unico lineare mentirebbe su cosa è stato
rilasciato e quando.

La storia precedente al 2026-09-11 vive nei tag e nei messaggi di commit e **non
è stata ricostruita qui a posteriori**: una ricostruzione è una supposizione
travestita da registro.

## Non rilasciato

### mobile
- **Quando il server non risponde, «Oggi» lo dice chiaramente** invece di
  sembrare un armadio vuoto, e offre di riprovare.
- **Con pochi capi si vede cosa manca**, non solo che manca qualcosa: una
  casella per il sopra e una per il sotto, piena o tratteggiata.
- **Prima di chiedere l'accesso alle foto l'app spiega perché**, e solo la
  prima volta.
- **Caricando più foto si vede una riga per ciascuna**: quale sta arrivando,
  quale è già in armadio, e quale non è andata — col suo motivo accanto. Prima
  c'era un solo «sto guardando il capo 3 di 7» e alla fine un numero di falliti
  senza dire quali.
- **Quando una foto non viene letta ora c'è una schermata, non un messaggio che
  sparisce**, e «Riprova» non la ricarica: la foto è già sul server.
- **Due schermate nuove**: «Come viene bene» spiega come fotografare un capo, e
  «Da rivedere» raccoglie i capi su cui il modello aveva un dubbio, invece di
  farli scoprire uno per volta.
- **La barra in basso c'è sempre**, e resta accesa sulla scheda da cui sei
  arrivato: sul dettaglio di un capo resta illuminata «Armadio», in chat
  «Oggi», sul calendario «Profilo». Prima su quelle schermate spariva del
  tutto. Il «+» porta a «Aggiungi» da ovunque.
- **Il dettaglio di un capo ha un menu «···»**, e la foto non viene più
  tagliata: il capo si vede per intero, qualunque forma abbia. Le azioni che
  non possiamo ancora fare — rifare la foto, non suggerirlo più, eliminarlo —
  sono lì, spente, con scritto cosa manca.
- **«In lavatrice» si può finalmente scegliere.** I tre stati di un capo sono
  tre pillole; prima un interruttore solo ne raggiungeva due, e il terzo si
  poteva vedere ma non impostare.
- **Il suggeritore è una chat sola.** Erano tre modi di chiedere la stessa cosa
  allo stesso stilista: restano gli spunti rapidi e la chat. Le proposte pronte
  si guardano in «Oggi», dove già erano.
- **L'app si chiama Aura.** Il nome sotto l'icona e i testi che lo dicevano
  («Chiedi tu a Wardrobe», «proposto da Wardrobe») ora dicono Aura. I nomi
  interni — pacchetti, cartelle, tabelle — non sono cambiati: quello è un
  lavoro a sé, e uno dei pezzi (l'identificatore dell'app sullo store) non si
  può cambiare senza pubblicare un'app diversa.
- **Gli outfit salvati sono una vista dell'armadio.** In cima all'Armadio c'è
  un segmento «Capi | Outfit», come nel deck. La schermata `/outfit` resta
  dov'è — il Profilo ci rimanda e un link diretto continua a funzionare — e
  mostra la stessa lista. La scheda di un outfit ha cambiato forma: tessere
  quadrate col capo dentro per intero invece di una copertina che lo tagliava.
- **Le impostazioni sono una schermata sola.** Nove voci in tre gruppi, invece
  che sparse fra Profilo e il sistema. Quelle che ancora non funzionano si
  vedono spente, con scritto cosa manca — nella lingua di chi legge, non in
  quella di chi sviluppa.
- **Si possono dare taglia, altezza e corporatura.** Servono a vestire
  l'avatar, sono tutte facoltative, e si cancellano quando vuoi: `Impostazioni
  → Misure e taglia`. Il sistema di taglie lo scegli tu — l'app non lo deduce
  dal nome né dalle foto.
- **Centimetri o pollici, lo scegli tu** (`Impostazioni → Unità`), e la scelta
  ti segue su ogni dispositivo perché sta sul profilo. Cambia solo come le
  leggi: le misure che hai dato restano quelle. Peso e temperatura non ci sono
  — non esiste un peso da nessuna parte, e il meteo non arriva ancora.
- **Puoi scaricare i tuoi dati** (`Impostazioni → Scarica i tuoi dati`): uno
  zip con i capi, gli outfit, il profilo con le misure, le conversazioni con lo
  stilista e le segnalazioni — **con dentro le foto vere**, non dei link che
  scadono. Si apre il browser per salvarlo, e il link vale un quarto d'ora.
- **Si può svuotare l'armadio** (`Impostazioni → Svuota l'armadio`): via capi
  e foto, outfit, conversazioni e il diario di cosa hai messo. **Restano**
  l'account, le tue misure, le preferenze di stile e la foto per l'avatar — e
  la schermata te lo dice prima, in due elenchi separati, coi numeri veri.
  Bisogna scrivere «SVUOTA» per confermare, e non si torna indietro.
- **Le schermate d'apertura sono quelle nuove.** Erano rimaste indietro: la
  prima diceva ancora «wardrobe». Ora sono i tre passi del deck — l'armadio che
  scorre appeso alla stanga, l'avatar con la tua taglia, lo stilista a cui
  chiedere — e l'accesso ha il «Mostra» sulla password. Entrando per la prima
  volta si fanno tre passi: account, misure, stile. Le misure si possono
  saltare.
- **La palette viene dal deck «Aura».** I token di colore sono nominati per
  ruolo: `primario` (l'accento, `#5566D6`), `inchiostro`, `scheda` (il bianco
  da cui si compone ogni velatura), `pericolo`. Spariscono `ambra`, `crema` e
  `corallo`, e con l'ambra sparisce l'invariante che la riservava
  all'intelligenza artificiale — la regola nuova è che **l'azione è
  inchiostro, non l'accento**, ed è quella del deck. Il passaggio ha corretto
  una classe di difetti che nasceva da sé: dove l'ambra (chiara) portava testo
  inchiostro, il primario (scuro) lo avrebbe portato ancora, a 3.6:1 — pillola
  attiva, badge, bolle, bottone tondo e il «+» della barra ora scrivono chiaro
  sul proprio fondo.
- **Le schermate hanno un fondo.** `SfondoAura` dipinge il gradiente a tre
  fermate e i due aloni radiali del deck, in una delle quattro tavolozze
  (`caldo`, `freddo`, `neutro`, `oro`). Per ora lo portano «Oggi» e le due
  schermate di accesso; le altre restano sulla tinta piatta finché non si
  convertono.
- **L'armadio è quello del deck**: griglia a **tre** colonne di tessere
  quadrate di vetro — il capo ci sta dentro per intero, un cappotto lungo non
  si taglia più — col cuore sui preferiti, il badge «da lavare», il nome sotto
  la tessera e la casella tratteggiata «Aggiungi» **dentro** la griglia. Due
  righe di filtri: la categoria, e le qualità («♥ Preferiti», «Pronti da
  mettere», «Da lavare», «Usati di rado») con la regola di un filtro per
  dimensione, così non si può comporre a mano una selezione vuota per
  costruzione. Lo stato vuoto distingue «l'armadio è vuoto» da «i filtri non
  trovano niente».
- **Il calendario mostrava sei giorni per riga su ogni telefono.** La griglia
  del mese chiedeva più larghezza di quanta ne esista, e in React Native una
  cella che non entra non si stringe: va a capo. Le lettere dei giorni erano
  disallineate rispetto alle date. Corretta, e ora un test impedisce che
  succeda a qualunque griglia.
- **`Scheda` ha la variante `vetro`**: bianco traslucido con un filo di luce
  sul bordo, la superficie su cui il deck poggia quasi tutto.
- I colori composti a mano (`rgba()`, esadecimali) in 7 file fra schermate e
  primitive sono stati sostituiti con i token di `tema/tokens.ts` o con
  `velo(colore, alfa)`, che produce lo stesso formato senza spazi: nessun
  pixel cambia, con un'eccezione dichiarata — il fondo dell'attributo
  «incerto» in `Attributo` riusa `colori.coralloTenue` invece di un
  esadecimale mai promosso a token, e passa da `#FFF1EC` a `#FFE3DA`
  (leggermente più saturo). Un nuovo gate
  (`test/convenzioni/colori.test.ts`) rifiuta ora un colore scritto a mano
  ovunque in `app/` e `src/`, con le sole eccezioni di `tema/tokens.ts` (la
  fonte) e `dati/dominio.ts` (`PALETTE_COLORI`, dati di dominio).
- `BottonePrimario` ha la variante `pericolo` (sfondo corallo, testo crema): la
  conferma di `Avviso` non ridipinge più il fondo dal punto di chiamata.
- Corretto `BottonePrimario`: `sfondo` e `su` venivano da due ternarie con una
  precedenza diversa, e `pericolo + disabilitato` dipingeva un fondo chiaro
  dichiarando `su="scuro"` a chi ci stava dentro. Una sola `variante` decide
  ora entrambi, insieme al colore del testo.
- Il gate `test/convenzioni/primitive.test.ts` non legge più i sorgenti come
  testo (un regex che si fermava alla prima `>`, quasi sempre quella di
  `onPress={() => …}` su una chiamata multi-riga) ma con l'AST di TypeScript,
  e non controlla più un elenco di primitive scritto a mano: lo deriva da
  `src/ui/**`. Ha trovato due primitive dimenticate (`Campo`, `BarraChiedi`)
  e una terza mai considerata (`PiedeFoto`); `BottoneSecondario`, che dipinge
  un fondo senza asserire un `<Fondo>`, resta controllato come eccezione
  dichiarata, col motivo scritto accanto.
- Ripristinati in `overrides` alla radice i pin di `typescript` e
  `react-native-worklets`, cancellati per errore insieme all'aggiunta di
  `react`/`react-test-renderer`.
- Il gate sulle primitive copre anche la prop `sfondo`, non solo `style`:
  `Scheda` e `SchedaFoto` la accettano e calcolano `su` per conto loro, quindi
  `<Scheda sfondo={colori.inchiostro}>` dipingeva una card quasi nera
  dichiarando `chiaro` a chi ci stava dentro. I tre punti di chiamata che
  passavano `sfondo` senza `su` ora lo dicono — tutti e tre su fondo chiaro,
  quindi nessun pixel cambia: cambia che adesso è scritto.
- `PALETTE_BOTTONE_PRIMARIO` usa `velo(colori.inchiostro, 0.08)` e
  `testoSu.chiaro.debole` invece dei due `rgba()` identici scritti a mano.
- Una sola copia di React nel monorepo: `react` e `react-dom` sono dichiarati
  anche in `dependencies` di root, alla stessa versione esatta di
  `apps/mobile` (19.2.3). Prima la root non dichiarava nessuno dei due, e
  decine di pacchetti Expo hoisted lì li chiedevano come peer con `*`: npm
  installava l'ultima pubblicata, e il conflitto fra le due copie (dispatcher
  nullo al primo hook) era tamponato solo dentro jest da un
  `moduleNameMapper` — che è stato tolto, non più necessario. Il ricalcolo
  del lock ha aggiornato anche una serie di pacchetti Expo/Metro non pinnati
  a versione esatta, alle ultime versioni compatibili con i loro range.

### api
- **Il profilo porta le misure del corpo** (`Profilo.misure`): sistema di
  taglie, taglia, altezza, corporatura, spalle e lunghezza gamba — tutte
  facoltative, e l'intero blocco può non esserci. Gli estremi accettati
  (`LIMITI_MISURE_CM`) attraversano il confine verso l'app, così la validazione
  è un numero solo invece di due copie che divergono. **Nessuna migrazione**:
  `profili.dati` è `jsonb`.
- **`Profilo.unita_lunghezza`** (`cm` | `pollici`): in che unità si *mostrano*
  le lunghezze, non in che unità si salvano — `Misure` resta in centimetri. Il
  default è `cm`, così ogni profilo già salvato lo riceve leggendolo: **nessuna
  migrazione**.
- **`POST /esportazione`**: firma un indirizzo a scadenza breve da cui
  scaricare tutti i dati di chi lo chiede. L'archivio si compone alla
  richiesta e **non viene salvato da nessuna parte** — una copia in giacenza
  avrebbe bisogno di una scadenza e di qualcosa che la ripulisca, e
  renderebbe bugiarda la cancellazione dell'armadio.
- **`POST /armadio/svuota`**: cancella capi, outfit, conversazioni e usi di
  chi chiama, in **una transazione**, e le foto **per prefisso** invece che per
  elenco di chiavi. Profilo, account e segnalazioni restano. Il corpo deve
  portare `conferma: "SVUOTA"`, un `Literal` nel contratto: una richiesta senza
  intenzione esplicita prende 422 e non cancella niente.
- (niente di visibile: solo l'ordine dei gate di coverage in CI. La soglia
  aggregata si applicava *dentro* lo step Pytest, e quando scattava saltava le
  due soglie per sottoalbero — il gate più debole nascondeva i due che contano.
  Ora è l'ultima.)

### progetto
- Lo stato del progetto vive in `docs/PROGRESS.md`, `docs/QUESTIONI.md`,
  `docs/DOMANDE_APERTE.md` e `docs/TEST_COVERAGE.md` invece che nel README.
- Gli standard per area vivono in `.claude/rules/`; `CLAUDE.md` resta la sintesi.
- Corretta in `CLAUDE.md` la regola di `su`, che descriveva ancora il regime
  precedente al commit `ee7f492`.
- Gate nuovi in CI, tutti verdi al primo giro: soglie di coverage sul backend
  (totale, dominio, handler), i primi test dell'app, e un controllo che i numeri
  dichiarati nelle docs siano quelli veri.
- `docs/DA_FARE.md`: il lavoro trovato mentre se ne fa un altro, scritto subito
  invece che ricordato. Assorbe i «debiti dichiarati» che stavano in
  `PROGRESS.md`, che torna a dire solo cosa esiste.
- **Prima di aggirare un problema, si prova a toglierlo** (`docs/adr/0008`): la
  regola che viene prima delle altre, ripetuta di proposito in `CLAUDE.md`, nelle
  cinque rules e in tutti e nove gli agenti.
- L'URL dell'APK che EAS restituisce non viene più interpolato dentro il `run:`
  che lo scarica: passa da `env:`, e schema e dominio si controllano prima di
  seguirlo. Era l'ultimo punto in cui un valore di provenienza esterna finiva
  nel testo di uno script, in un job che ha `contents: write` e `GH_TOKEN`.
- Il permesso di scrivere sul repo non è più dichiarato a livello di workflow:
  `api.yml` e `mobile.yml` hanno `contents: read` alla radice e
  `contents: write` dentro il solo job che rilascia. I job che eseguono il
  codice della PR — `quality`, `contracts`, `checks` e i due di `docs.yml` —
  fanno checkout con `persist-credentials: false`, così il token non resta nel
  `.git/config` del runner mentre quel codice gira.
