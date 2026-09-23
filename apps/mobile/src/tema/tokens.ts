/**
 * I token del design di Aura.
 *
 * **L'azione è inchiostro, non l'accento.** È la regola che un'interfaccia
 * come questa fa sbagliare per prima, perché l'istinto è colorare il pulsante
 * più importante: qui no. Ogni azione primaria — «Entra», «Salva
 * nell'armadio», «Mettilo oggi» — si dipinge di `inchiostro`, e così ogni
 * pillola selezionata. L'accento `primario` non fa mai da fondo a un'azione,
 * con la sola eccezione del «+» della barra delle schede, che è l'unico posto
 * dove un'azione deve staccarsi dal cromo che la contiene.
 *
 * Il `primario` fa due mestieri: **dove parla il modello** (il match di un
 * suggerimento, il badge «letto dalla foto», «proposto da Aura») e **il cromo**
 * (link, progressi, spunte, la scheda attiva). Li fa con lo stesso colore
 * perché così li fa la proposta di redesign da cui questi token vengono.
 *
 * Prima esisteva un `ambra` riservato al solo primo mestiere — *«l'ambra è
 * dell'intelligenza artificiale, e in nessun altro posto»* — e quella regola
 * qui non c'è più: è una scelta dell'utente del 2026-09-22, registrata in
 * `docs/QUESTIONI.md`. Se un domani il modello deve tornare ad avere un colore
 * suo, il posto è questo file e il costo è una riga: le primitive che lo
 * userebbero (`BadgeIa`, `MotiviProposta`, `PuntiniAttesa`, `AttesaLunga`)
 * leggono già un token solo.
 *
 * I valori vengono dal deck `~/wardrobe-schermate/`, spogliato per intero: 24
 * velature distinte d'inchiostro e 19 di bianco, collassate qui sotto in una
 * scala. Non sono trascritte a una a una — è lo stesso lavoro che `tipografia`
 * ha già fatto in questo file, e per la stessa ragione.
 */

import { Easing } from 'react-native'

export const colori = {
  /**
   * L'accento di Aura. Cromo, link, progressi, e dove parla il modello.
   * **Mai il fondo di un'azione**: quello è `inchiostro`.
   */
  primario: '#5566D6',
  /**
   * Il `primario` scurito, per il testo che si posa sulle sue velature.
   * L'unico scostamento deliberato dal deck: là il badge «SICURO · 97» scrive
   * l'accento pieno sul proprio fondo velato, e il contrasto che ne esce è
   * 4.1:1 — sotto la soglia per un testo piccolo. Questo ne dà 6.5:1.
   */
  primarioScuro: '#3A48A8',
  /** Inchiostro: il testo, e il fondo di ogni azione primaria. */
  inchiostro: '#15181F',
  /**
   * Il bianco. Non è più «il bianco delle schede» — nel deck una scheda è
   * *traslucida*, e il suo fondo sta in `superfici.vetro` — ma la tinta da cui
   * ogni velatura chiara si compone, e il testo sopra l'inchiostro.
   */
  scheda: '#FFFFFF',
  /**
   * La tinta piatta sotto tutto: si vede per un istante prima che il gradiente
   * di `fondi` dipinga, e dietro a ciò che non ha un fondo suo. È la prima
   * fermata della tavolozza neutra.
   */
  sfondo: '#F8F9FC',
  /**
   * Il fondo su cui si posa la foto di un capo: **uno solo per tutti i capi**,
   * mai il colore del capo stesso. Le foto scontornate sono PNG trasparenti,
   * quindi questo è ciò che si vede intorno al capo — e un capo blu su fondo
   * blu è il difetto che questo token esiste per evitare. Vale anche da
   * segnaposto mentre la foto arriva dalla rete.
   */
  fondoFoto: '#FFFFFF',
  /** Attenzione e incertezza: il testo, il tratto, «Elimina». */
  pericolo: '#8F3A26',
  /**
   * La seconda tinta dell'attenzione. Il deck ne usa due: questa **solo
   * velata**, per i fondi e i bordi, perché `pericolo` velato viene fangoso.
   */
  pericoloVelato: '#C1553F',
  /**
   * `velature.pericolo` composto su bianco, **opaco**. Serve a chi non sa su
   * che fondo si posa: `Avviso` galleggia sopra qualunque schermata, e un velo
   * al 10% sopra una schermata scura lascerebbe il suo testo d'inchiostro
   * illeggibile. Chi sta su una schermata chiara usa la velatura, non questo.
   */
  pericoloTenue: '#F9EEEC',
  /** La pelle del manichino a primitive tinte (`docs/adr/0004`). */
  pelle: '#E7DFD2',
} as const

/**
 * Un colore con opacità, senza ridigitare `rgba(...)` per ogni velatura quasi
 * identica di uno stesso colore. È l'unica via legittima per una velatura: il
 * gate `test/convenzioni/colori.test.ts` rifiuta ogni `rgba()` scritto a mano
 * fuori da questo file.
 *
 * **Vuole un esadecimale a sei cifre.** Un `#FFF` produce `NaN` e un colore
 * che non si vede — per questo `colori.scheda` è scritto `#FFFFFF`.
 */
export function velo(esadecimale: string, alfa: number): string {
  const pulito = esadecimale.replace('#', '')
  const r = parseInt(pulito.substring(0, 2), 16)
  const g = parseInt(pulito.substring(2, 4), 16)
  const b = parseInt(pulito.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alfa})`
}

/**
 * Le due scale del testo, indicizzate da `su`. I quattro gradini vengono dai
 * quattro gruppi in cui cadono le 24 velature d'inchiostro del deck; il più
 * usato è `tenue` (106 occorrenze: l'occhiello, l'etichetta maiuscola).
 */
export const testoSu = {
  chiaro: {
    forte: colori.inchiostro,
    /** Assorbe anche il .70/.72/.78 del deck. */
    medio: velo(colori.inchiostro, 0.68),
    tenue: velo(colori.inchiostro, 0.62),
    /** Il chevron di fine riga, l'icona spenta. */
    debole: velo(colori.inchiostro, 0.45),
  },
  scuro: {
    // Tutti e quattro sulla stessa base — l'rgb di `scheda`: erano due bianchi
    // diversi, e il gradino opaco era il più bianco dei quattro invece del più
    // forte della stessa famiglia.
    forte: colori.scheda,
    medio: velo(colori.scheda, 0.78),
    tenue: velo(colori.scheda, 0.6),
    debole: velo(colori.scheda, 0.4),
  },
} as const

export const linee = {
  /** Il tratteggio, la linea marcata. */
  chiara: velo(colori.inchiostro, 0.16),
  scura: velo(colori.scheda, 0.16),
  /** Il fondo di una pista, di un badge muto. */
  tenue: velo(colori.inchiostro, 0.07),
  /** La linea che separa due righe di un elenco. */
  media: velo(colori.inchiostro, 0.1),
  /** Il chevron di fine riga su fondo chiaro — `righe.tsx` e `profilo.tsx`
   *  scrivevano lo stesso esadecimale a mano in due file. */
  chevron: velo(colori.inchiostro, 0.45),
} as const

/**
 * Le velature dei due colori che ne hanno bisogno: il fondo di un badge, di
 * una bolla d'icona, di un riquadro d'avviso.
 *
 * Il `pericolo` si vela partendo da `pericoloVelato`, non da `pericolo`: è
 * quello che fa il deck, e il motivo è che `#8F3A26` diluito vira al fango
 * mentre `#C1553F` resta un rosso.
 */
export const velature = {
  /** Il fondo di un badge del modello, o della scheda attiva. */
  primario: velo(colori.primario, 0.14),
  /** Il fondo di un riquadro d'attenzione. */
  pericolo: velo(colori.pericoloVelato, 0.1),
  /** Il suo bordo. */
  pericoloBordo: velo(colori.pericoloVelato, 0.22),
} as const

/** Angoli morbidi: 26 per le schede, 99 per tutto ciò che è una pillola. */
export const raggi = {
  piccolo: 14,
  medio: 20,
  /** L'idioma `raggi.medio + 4` che tornava in ogni riga navigabile. */
  medioAlto: 24,
  scheda: 26,
  grande: 30,
  pillola: 99,
} as const

export const spazi = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 22,
  xxl: 30,
} as const

/**
 * La scala tipografica. `ui/testo.tsx` documenta da tempo tre taglie per
 * `Titolo` — «40 (onboarding), 27 (testata), 19 (sezione)» — ma il codice ne
 * usa 28 valori distinti, e un terzo delle occorrenze di `taglia` in tutto
 * l'app sono mezzi punti (`13.5`, `12.5`, `11.5`…) indistinguibili a schermo
 * l'uno dall'altro: il sintomo di una taglia scelta a occhio, componente per
 * componente, invece che da un elenco.
 *
 * `nano` è l'unica chiave aggiunta insieme allo sweep che ha portato le 88
 * occorrenze numeriche di `taglia` sulla scala: un pavimento mancava
 * davvero — otto etichette maiuscole vivevano fra 8.5 e 10.5, sotto `micro`.
 * Il vuoto fra `sezione` (19) e `testata` (27) invece non è un buco da
 * riempire: gli otto `Titolo` che ci cadono in mezzo (20-25) non hanno un
 * ruolo comune, sono la stessa deriva «a occhio» che questa scala esiste per
 * fermare — ci sono finiti su `testata` o `sezione` per ruolo, non per il
 * numero più vicino.
 *
 * `Titolo`/`Corpo`/`Forte`/`Etichetta`/`Numero` accettano una chiave di qui
 * oltre a un numero — `taglia="sezione"` invece di `taglia={19}` — senza
 * smettere di accettare un numero per i casi che hanno una vera ragione di
 * scostarsi (un titolo che deve stare esattamente in una riga, per esempio).
 */
export const tipografia = {
  nano: 10,
  micro: 11,
  minuto: 12.5,
  corpo: 14,
  guida: 16,
  sezione: 19,
  testata: 27,
  eroe: 40,
} as const

/**
 * Le griglie che una schermata e il suo scheletro di caricamento devono
 * disegnare identiche, o al momento dello scambio il contenuto salta di
 * qualche pixel.
 *
 * Stanno qui e non nelle due schermate perché la copia è già il difetto che
 * questo progetto racconta per le enum: due elenchi della stessa cosa
 * divergono in silenzio, e nessun `tsc` se ne accorge. Leggono da qui
 * `ui/capi.tsx` (`CapoInGriglia`, `CasellaAggiungi`, `SchedaOutfit`),
 * `app/(tabs)/armadio.tsx`, `app/calendario.tsx` e `ui/scheletri.tsx`.
 */
export const griglie = {
  /**
   * L'armadio: **tre colonne** di tessere quadrate, come nel deck. Erano due,
   * con una foto alta 182 e il nome sovrapposto in basso; ora il capo sta
   * dentro un quadrato qualunque forma abbia, e il nome va **sotto** la
   * tessera. Le tre lettrici (`CapoInGriglia`, `app/(tabs)/armadio.tsx`,
   * `ScheletroGrigliaCapi`) vanno cambiate insieme o la griglia vera e il suo
   * scheletro divergono.
   */
  armadio: {
    // 3 × 30.8% + due `spazi.s` sta nella larghezza utile **anche a 320pt**,
    // con 5px di margine. 31.4% ne lasciava 0.0 e sarebbe andata a capo al
    // primo arrotondamento: il conto lo fa `test/convenzioni/griglie.test.ts`.
    colonna: '30.8%',
    distanza: spazi.s,
    /** `aspectRatio`, non un'altezza: la tessera è un quadrato. */
    proporzione: 1,
    raggio: raggi.medio,
    /** Fra il quadrato e il nome sotto. */
    distanzaNome: 7,
    /**
     * L'altezza della riga del nome. Non è un numero scelto: è l'interlinea
     * vera di `<Forte taglia="minuto">` — `ui/testo.tsx` la calcola come
     * `fontSize × 1.3`. Lo scheletro deve disegnarla **alta uguale**, o al
     * momento dello scambio ogni riga si accorcia di qualche pixel: è la
     * stessa deriva che questo blocco esiste per impedire, in piccolo.
     */
    altezzaNome: Math.round(tipografia.minuto * 1.3),
  },
  /**
   * La scheda di un outfit salvato: una riga di tessere quadrate, poi il nome
   * e una riga di riepilogo. La cornice è una `Scheda vetro` — qui stanno solo
   * i numeri che la scheda vera e `ScheletroSchedaOutfit` devono condividere.
   */
  outfit: {
    /** Quante tessere entrano nella riga: oltre, il capo non si riconosce più. */
    quante: 3,
    distanza: spazi.s,
    raggioTessera: raggi.piccolo,
    proporzione: 1,
    /** L'interlinea vera di `<Forte taglia="guida">` — stessa regola di `armadio`. */
    altezzaNome: Math.round(tipografia.guida * 1.3),
    /** Quella di `<Corpo taglia="minuto">`, che in `ui/testo.tsx` è ×1.5. */
    altezzaMeta: Math.round(tipografia.minuto * 1.5),
  },
  /**
   * Il mese: sette colonne, una cella un filo più alta che larga.
   *
   * Era `13.1%`, e **non ci stava**: `7 × 13.1% + 6 × 6px` entra solo in una
   * larghezza utile di 434px, cioè uno schermo da 478pt, che non esiste. In
   * React Native `flexShrink` vale **0** di default, quindi la settima cella
   * non si stringeva: andava a capo, e il calendario mostrava sei giorni per
   * riga con le lettere dei giorni disallineate rispetto alle date. Difetto
   * pre-esistente, trovato scrivendo il gate — vedi `T-37` in `DA_FARE.md`.
   */
  mese: {
    colonna: '12.2%',
    distanza: 6,
    /** `aspectRatio`, non un'altezza: la cella si stringe col telefono. */
    proporzione: 1 / 1.25,
    raggio: 13,
  },
} as const

/**
 * Ombre morbide e diffuse, mai nette: è ciò che distingue questa direzione da
 * un'interfaccia «da stampa».
 */
export const ombre = {
  scheda: {
    shadowColor: colori.inchiostro,
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  alta: {
    shadowColor: colori.inchiostro,
    shadowOpacity: 0.14,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  bassa: {
    shadowColor: colori.inchiostro,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const

/**
 * Le superfici a vetro: il carattere del redesign, e l'unica cosa che non si
 * ottiene con un token di colore solo.
 *
 * Nel deck una superficie è bianco traslucido su un fondo in gradiente. I 19
 * alfa distinti che ci sono finiti cadono in cinque gruppi, e questi cinque
 * coprono 338 delle ~340 occorrenze. **Non c'è nessuna sfocatura**: il
 * `backdrop-filter` del deck sfoca un gradiente liscio, cioè quasi niente, e
 * `expo-blur` non è installato — la voce è aperta in `docs/QUESTIONI.md`.
 */
export const superfici = {
  /** Il riquadro d'informazione, il fondo tratteggiato. */
  vetroTenue: velo(colori.scheda, 0.5),
  /** **La scheda.** Il gradino più usato del deck. */
  vetro: velo(colori.scheda, 0.6),
  /** La barra «chiedi», la miniatura, il campo. */
  vetroAlto: velo(colori.scheda, 0.7),
  /** Il pill galleggiante, la barra delle schede. */
  vetroSaldo: velo(colori.scheda, 0.82),
  /** Il filo di luce sul bordo di ogni vetro, e il fondo del menu «···». */
  bordo: velo(colori.scheda, 0.92),
  suScuro: {
    /** Il fondo, un filo più chiaro dell'inchiostro, di una riga su fondo scuro. */
    riga: velo(colori.scheda, 0.05),
  },
  /**
   * Il grigio degli scheletri di caricamento, indicizzato da `su` come
   * `testoSu` — così una primitiva scrive `superfici.scheletro[su]` e ha finito.
   *
   * Non è `linee.tenue` né `linee.media`: quelle sono tarate per un bordo da
   * 1px, e un rettangolo di 330px riempito con il colore di un bordo sparisce
   * sul fondo. Non è nemmeno un colore nuovo — è l'inchiostro velato, la
   * stessa famiglia di tutto il resto — ma è una superficie, e una superficie
   * merita un nome di superficie.
   *
   * Il `primario` qui sarebbe sbagliato: uno scheletro non è il modello che
   * parla, è il posto dove il contenuto non è ancora arrivato. E mezzo schermo
   * di accento pulsante sarebbe comunque insostenibile da guardare.
   */
  scheletro: {
    chiaro: velo(colori.inchiostro, 0.085),
    scuro: velo(colori.scheda, 0.1),
  },
} as const

/**
 * I quattro fondi di schermata: un gradiente a tre fermate più due aloni
 * radiali, come nella mappa `LIGHT` del deck.
 *
 * Qui c'è **solo il colore**: dove stanno gli aloni e quanto sono grandi è
 * geometria, e vive in `Schermata` (`ui/guscio.tsx`) — un token che portasse
 * anche le coordinate costringerebbe a duplicarle il giorno in cui una
 * schermata ne vuole tre.
 */
export const fondi = {
  /** Oggi, chat, conversazioni, «mi manca un pezzo». */
  caldo: {
    gradiente: ['#FBF7F3', '#F1EEF4', '#E6E8F2'],
    fermate: [0, 0.44, 1],
    aloneA: { colore: '#FFC4A0', alfa: 0.42 },
    aloneB: { colore: '#96A6FF', alfa: 0.3 },
  },
  /** Armadio, dettaglio capo, calendario, outfit. */
  freddo: {
    gradiente: ['#F3F5FA', '#E7ECF5', '#DDE4F0'],
    fermate: [0, 0.46, 1],
    aloneA: { colore: '#8598FF', alfa: 0.36 },
    aloneB: { colore: '#A0D0EB', alfa: 0.34 },
  },
  /** Accesso, impostazioni, caricamento, errori: tutto ciò che non ha umore. */
  neutro: {
    gradiente: ['#F8F9FC', '#EEF1F7', '#E6EAF3'],
    fermate: [0, 0.5, 1],
    aloneA: { colore: '#D2D6E6', alfa: 0.5 },
    aloneB: { colore: '#8598FF', alfa: 0.2 },
  },
  /** Benvenuto, avatar, creazione dell'avatar: dove si promette qualcosa. */
  oro: {
    gradiente: ['#FDF8EF', '#F4EEE6', '#E9E6F0'],
    fermate: [0, 0.46, 1],
    aloneA: { colore: '#FFCE82', alfa: 0.46 },
    aloneB: { colore: '#A8B4FF', alfa: 0.26 },
  },
} as const

/** Quale fondo porta una schermata. Il nome è quello della chiave di `fondi`. */
export type NomeFondo = keyof typeof fondi

/**
 * Le durate del movimento, in millisecondi.
 *
 * Erano numeri sparsi: 200/250/300 per lo stesso identico gesto — una foto che
 * prende il posto del suo segnaposto, in tre file diversi — 160 e 380 nei
 * puntini di `PuntiniAttesa`, 900 nella barra di `AttesaLunga`.
 *
 * L'unico posto dove la scala **non** si stringe è fra `pulsazione` e
 * `respiro`, e vale la pena dire perché: l'energia percepita di un movimento
 * cresce con l'area, non con il tempo. Il ritmo che fa respirare tre puntini
 * da 7px (380ms per mezzo ciclo) su un rettangolo da 330px non respira,
 * lampeggia. Riusare `pulsazione` per uno scheletro sembrerebbe economico ed è
 * il motivo per cui `respiro` esiste separato.
 */
export const durate = {
  /** 160 — lo scarto fra una voce e la successiva in una sequenza scaglionata:
   *  i puntini di `PuntiniAttesa`, le righe di una lista che entra con
   *  `Comparsa`. */
  scaglione: 160,
  /** 220 — la dissolvenza breve: la foto che sostituisce il proprio segnaposto
   *  (`transition` di `expo-image`). Assorbe i 200/250/300 di prima. */
  breve: 220,
  /** 320 — la comparsa di un blocco al montaggio (`Comparsa`, `ui/base.tsx`). */
  media: 320,
  /** 380 — mezza pulsazione di qualcosa di piccolo: i tre puntini, 7px l'uno. */
  pulsazione: 380,
  /** 900 — la corsa avanti, e poi indietro, della barra di `AttesaLunga`. */
  corsa: 900,
  /** 1000 — mezza pulsazione di una superficie grande: uno scheletro di
   *  caricamento. Non è `pulsazione` allungata a occhio: è la soglia sotto la
   *  quale un rettangolo grande smette di respirare e comincia a lampeggiare. */
  respiro: 1000,
} as const

/**
 * Le curve del movimento. Tre, perché tre sono i gesti che questa app anima:
 * qualcosa che va e torna, qualcosa che entra una volta sola, qualcosa che esce.
 *
 * Tutte e tre funzionano col driver nativo: `Animated` campiona la funzione di
 * easing in una tabella di frame prima di spedirla al lato nativo — è già
 * quello che fanno `PuntiniAttesa` e `AttesaLunga` con `Easing.inOut(Easing.ease)`.
 */
export const curve = {
  /** Va e torna senza spigoli agli estremi: una pulsazione, una barra che rimbalza. */
  respiro: Easing.inOut(Easing.ease),
  /** Entra veloce e si posa: tutto ciò che compare una volta sola. */
  entrata: Easing.out(Easing.cubic),
  /** Esce accelerando: tutto ciò che sparisce. */
  uscita: Easing.in(Easing.cubic),
} as const

export const caratteri = {
  /** Display: titoli, numeri grandi. Stretto, con letterspacing negativo. */
  display: 'BricolageGrotesque_800ExtraBold',
  /** Testo: tutto il resto. */
  testo: 'Manrope_500Medium',
  testoForte: 'Manrope_700Bold',
  testoNero: 'Manrope_800ExtraBold',
} as const

/** Le etichette italiane delle enum generate dal backend. */
export const ETICHETTE = {
  tipo: {
    top: 'Top',
    pantaloni: 'Pantaloni',
    scarpe: 'Scarpe',
    capospalla: 'Capospalla',
    abito: 'Abito',
    accessorio: 'Accessorio',
  },
  slot: { outer: 'Fuori', top: 'Sopra', bottom: 'Sotto', shoes: 'Scarpe', dress: 'Abito' },
  stato: { pulito: 'Pulito', da_lavare: 'Da lavare', in_lavaggio: 'In lavatrice' },
  attributo: {
    tipo: 'Categoria',
    colore: 'Colore',
    materiale: 'Materiale',
    fantasia: 'Fantasia',
    stagione: 'Stagione',
    vestibilita: 'Vestibilità',
    lavaggio: 'Lavaggio',
  },
  stagione: {
    primavera: 'Primavera',
    estate: 'Estate',
    autunno: 'Autunno',
    inverno: 'Inverno',
    mezza_stagione: 'Mezza stagione',
    tutto_lanno: "Tutto l'anno",
  },
  sistemaTaglie: { donna: 'Donna', uomo: 'Uomo', unisex: 'Unisex' },
  // Le lettere si scrivono maiuscole: nel dominio sono minuscole perché una
  // `StrEnum` lo è, ma «xs» in un bottone è un refuso, non uno stile.
  taglia: { xs: 'XS', s: 'S', m: 'M', l: 'L', xl: 'XL' },
  corporatura: { minuta: 'Minuta', media: 'Media', robusta: 'Robusta' },
  // Il nome per intero, non il simbolo: queste etichette stanno su un
  // bottone di impostazioni, dove «cm» da solo non dice cosa si sta
  // scegliendo. Il simbolo accanto a un numero lo dà `simboloUnita()`.
  unitaLunghezza: { cm: 'Centimetri', pollici: 'Pollici' },
} as const
