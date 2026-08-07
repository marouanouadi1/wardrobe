/**
 * I token del design di Wardrobe.
 *
 * Una regola sopra tutte, e vale la pena scriverla qui perché è l'unica che
 * l'utente impara senza accorgersene: **il citron è dell'intelligenza
 * artificiale**. Compare dove parla il modello — il match di un suggerimento,
 * il badge «letto dalla foto», il pulsante che esegue una prova nel playground —
 * e in nessun altro posto. Un pulsante «Salva» verde acido romperebbe
 * l'associazione, e con essa il modo in cui l'occhio orienta la schermata.
 */

export const colori = {
  /** Nero d'inchiostro: testo, superfici forti, barra di navigazione. */
  inchiostro: '#15151A',
  /** Crema: il testo sopra l'inchiostro. */
  crema: '#F7F4EF',
  /** Il bianco delle schede: caldo, non clinico. */
  scheda: '#FFFDF9',
  /** Lo sfondo dell'app. */
  sfondo: '#F2EEE7',
  /** Citron: solo IA. */
  citron: '#D7F45C',
  /** Citron tenue, per i fondi delle etichette di match. */
  citronTenue: '#EFF6D2',
  /** Verde oliva scuro: leggibile su citronTenue. */
  oliva: '#8A7B2E',
  olivaScuro: '#5F6B1E',
  /** Corallo: attenzione, incertezza, capi da lavare. */
  corallo: '#FF6A45',
  coralloTenue: '#FFE3DA',
  /** L'interno dell'armadio, per la vista «appeso». */
  armadioAlto: '#2A2521',
  armadioBasso: '#1A1715',
  asta: '#B9AE99',
} as const

export const testoSu = {
  chiaro: {
    forte: colori.inchiostro,
    medio: 'rgba(21,21,26,0.72)',
    tenue: 'rgba(21,21,26,0.52)',
    debole: 'rgba(21,21,26,0.4)',
  },
  scuro: {
    forte: colori.scheda,
    medio: 'rgba(247,244,239,0.78)',
    tenue: 'rgba(247,244,239,0.55)',
    debole: 'rgba(247,244,239,0.4)',
  },
} as const

export const linee = {
  chiara: 'rgba(21,21,26,0.14)',
  scura: 'rgba(247,244,239,0.16)',
  tenue: 'rgba(21,21,26,0.06)',
} as const

/** Angoli morbidi: 26 per le schede, 99 per tutto ciò che è una pillola. */
export const raggi = {
  piccolo: 14,
  medio: 20,
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
} as const
