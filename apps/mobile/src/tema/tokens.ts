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
  /** Un filo più marcata di `tenue`: bordi di schede su fondo chiaro. */
  media: 'rgba(21,21,26,0.08)',
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
