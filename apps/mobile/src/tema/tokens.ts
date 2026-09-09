/**
 * I token del design di Wardrobe.
 *
 * Una regola sopra tutte, e vale la pena scriverla qui perché è l'unica che
 * l'utente impara senza accorgersene: **l'ambra è dell'intelligenza
 * artificiale**. Compare dove parla il modello — il match di un suggerimento,
 * il badge «letto dalla foto» — e in nessun altro posto. Un pulsante «Salva»
 * in questo colore romperebbe l'associazione, e con essa il modo in cui
 * l'occhio orienta la schermata.
 *
 * Era un giallo citron: sostituito con l'ambra perché troppo acceso, restando
 * comunque un colore che nessun capo in foto ha mai — non si confonde mai con
 * un colore di tessuto vero.
 */

import { Easing } from 'react-native'

/** Il bianco caldo delle superfici: le schede e il fondo delle foto. */
const BIANCO_CALDO = '#FFFDF9'

export const colori = {
  /** Nero d'inchiostro: testo, superfici forti, barra di navigazione. */
  inchiostro: '#15151A',
  /** Crema: il testo sopra l'inchiostro. */
  crema: '#F7F4EF',
  /** Il bianco delle schede: caldo, non clinico. */
  scheda: BIANCO_CALDO,
  /** Lo sfondo dell'app. */
  sfondo: '#F2EEE7',
  /**
   * Il fondo su cui si posa la foto di un capo: **uno solo per tutti i capi**,
   * mai il colore del capo stesso. Le foto scontornate sono PNG trasparenti,
   * quindi questo è ciò che si vede intorno al capo — e un capo blu su fondo
   * blu è il difetto che questo token esiste per evitare. Vale anche da
   * segnaposto mentre la foto arriva dalla rete.
   */
  fondoFoto: BIANCO_CALDO,
  /** Ambra: solo IA. */
  ambra: '#F5B324',
  /** Ambra tenue, per i fondi delle etichette di match. */
  ambraTenue: '#FBE9C6',
  /** Ambra scura: leggibile su ambraTenue. */
  ambraMedio: '#A66E1D',
  ambraScuro: '#8A5A12',
  /** Corallo: attenzione, incertezza, capi da lavare. */
  corallo: '#FF6A45',
  coralloTenue: '#FFE3DA',
  /** La pelle del manichino a primitive tinte (`docs/adr/0004`). */
  pelle: '#E7DFD2',
} as const

export const testoSu = {
  chiaro: {
    forte: colori.inchiostro,
    medio: 'rgba(21,21,26,0.72)',
    tenue: 'rgba(21,21,26,0.52)',
    debole: 'rgba(21,21,26,0.4)',
  },
  scuro: {
    // Tutti e quattro sulla stessa base — l'rgb di `crema`, non di `scheda`:
    // erano due bianchi diversi, e il gradino opaco era il più bianco dei
    // quattro invece del più forte della stessa famiglia.
    forte: colori.crema,
    medio: 'rgba(247,244,239,0.78)',
    tenue: 'rgba(247,244,239,0.55)',
    debole: 'rgba(247,244,239,0.4)',
  },
} as const

export const linee = {
  chiara: 'rgba(21,21,26,0.14)',
  scura: 'rgba(247,244,239,0.16)',
  tenue: 'rgba(21,21,26,0.06)',
  /** Un filo più marcata di `tenue`: bordi di schede su fondo chiaro. */
  media: 'rgba(21,21,26,0.08)',
  /** Il chevron di fine riga su fondo chiaro — `righe.tsx` e `profilo.tsx`
   *  scrivevano lo stesso esadecimale a mano in due file. */
  chevron: 'rgba(21,21,26,0.3)',
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
 * Le due griglie che una schermata e il suo scheletro di caricamento devono
 * disegnare identiche, o al momento dello scambio il contenuto salta di
 * qualche pixel.
 *
 * Stanno qui e non nelle due schermate perché la copia è già il difetto che
 * questo progetto racconta per le enum: due elenchi della stessa cosa
 * divergono in silenzio, e nessun `tsc` se ne accorge. Leggono da qui
 * `ui/capi.tsx` (`CapoInGriglia`), `app/(tabs)/armadio.tsx`, `app/calendario.tsx`
 * e `ui/scheletri.tsx`.
 */
export const griglie = {
  /** L'armadio: due colonne, con `spazi.m` in mezzo. */
  armadio: {
    colonna: '47.5%',
    distanza: spazi.m,
    altezzaFoto: 182,
    /** L'idioma `raggi.medio + 2` di `CapoInGriglia`. */
    raggio: raggi.medio + 2,
  },
  /** Il mese: sette colonne, una cella un filo più alta che larga. */
  mese: {
    colonna: '13.1%',
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
    shadowColor: '#15151A',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  alta: {
    shadowColor: '#15151A',
    shadowOpacity: 0.14,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  bassa: {
    shadowColor: '#15151A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const

export const superfici = {
  suScuro: {
    /** Il fondo, un filo più chiaro dell'inchiostro, di una riga su fondo scuro. */
    riga: 'rgba(247,244,239,0.05)',
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
   * L'ambra qui sarebbe sbagliata due volte. Per la regola in cima a questo
   * file: uno scheletro non è il modello che parla, è il posto dove il
   * contenuto non è ancora arrivato. E perché mezzo schermo di ambra pulsante
   * sarebbe comunque insostenibile da guardare.
   */
  scheletro: {
    chiaro: 'rgba(21,21,26,0.085)',
    scuro: 'rgba(247,244,239,0.10)',
  },
} as const

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

/**
 * Un colore con opacità, senza ridigitare `rgba(...)` per ogni velatura quasi
 * identica di uno stesso colore (l'ambra al 12%, al 14%, al 18%...). Sostituisce
 * anche il citron ritirato (`rgba(215,244,92,*)`, vedi sopra): con `velo(colori.ambra, α)`
 * la velatura resta ambra, non il verde che non esiste più nel design.
 */
export function velo(esadecimale: string, alfa: number): string {
  const pulito = esadecimale.replace('#', '')
  const r = parseInt(pulito.substring(0, 2), 16)
  const g = parseInt(pulito.substring(2, 4), 16)
  const b = parseInt(pulito.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alfa})`
}

export const caratteri = {
  /** Display: titoli, numeri grandi. Stretto, con letterspacing negativo. */
  display: 'BricolageGrotesque_800ExtraBold',
  /** Testo: tutto il resto. */
  testo: 'Manrope_500Medium',
  testoForte: 'Manrope_700Bold',
  testoNero: 'Manrope_800ExtraBold',
} as const

/**
 * La scala tipografica. `ui/testo.tsx` documenta da tempo tre taglie per
 * `Titolo` — «40 (onboarding), 27 (testata), 19 (sezione)» — ma il codice ne
 * usa undici, e un terzo delle occorrenze di `taglia` in tutto l'app sono
 * mezzi punti (`13.5`, `12.5`, `11.5`…) indistinguibili a schermo l'uno
 * dall'altro: il sintomo di una taglia scelta a occhio, componente per
 * componente, invece che da un elenco.
 *
 * `Titolo`/`Corpo`/`Forte`/`Etichetta` accettano una chiave di qui oltre a un
 * numero — `taglia="sezione"` invece di `taglia={19}` — senza smettere di
 * accettare un numero per i casi che hanno una vera ragione di scostarsi
 * (un titolo che deve stare esattamente in una riga, per esempio). Non è un
 * rifacimento delle taglie esistenti: i call site restano quello che erano
 * finché non li si tocca per un altro motivo.
 */
export const tipografia = {
  micro: 11,
  minuto: 12.5,
  corpo: 14,
  guida: 16,
  sezione: 19,
  testata: 27,
  eroe: 40,
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
} as const
