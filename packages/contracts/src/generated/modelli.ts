/**
 * GENERATO — non modificare a mano.
 *
 * Fonte di verità: services/api/src/domain/models.py
 * Rigenera con: npm run contracts:generate
 */

export type TipoCapo = 'top' | 'pantaloni' | 'scarpe' | 'capospalla' | 'abito' | 'accessorio'
export type Stagione = 'primavera' | 'estate' | 'autunno' | 'inverno' | 'mezza_stagione' | 'tutto_lanno'
export type StatoCapo = 'pulito' | 'da_lavare' | 'in_lavaggio'
export type StatoAnalisi = 'in_corso' | 'completata' | 'fallita'
/**
 * Gli attributi che il modello di visione legge dalla foto.
 *
 * Ognuno porta la sua confidenza: è il motivo per cui `Capo` non ha un unico
 * punteggio complessivo.
 */
export type AttributoCapo = 'tipo' | 'colore' | 'materiale' | 'fantasia' | 'stagione' | 'vestibilita' | 'lavaggio'
/**
 * Le cinque posizioni che l'avatar sa vestire.
 *
 * I valori coincidono con le chiavi di `mannequin.setOutfit()`.
 */
export type SlotAvatar = 'top' | 'bottom' | 'outer' | 'shoes' | 'dress'
/**
 * I due lavori veri che l'IA fa nel prodotto.
 *
 * Il playground esercita questi, non una chat generica: così provare un
 * provider nuovo significa aggiungere un adapter, mai toccare una schermata.
 */
export type JobIa = 'analisi_capo' | 'suggerimento'
export type EsitoEsecuzione = 'ok' | 'vago' | 'errore'
export type OrigineOutfit = 'manuale' | 'ia' | 'suggerito_modificato'

/**
 * Generato da services/api/src/domain/models.py — non modificare a mano.
 */
export interface Contratti {
  AggiornamentoCapo?: AggiornamentoCapo
  AnalisiAvviata?: AnalisiAvviata
  AnalisiVisione?: AnalisiVisione
  AttributoCapo?: AttributoCapo
  Capo?: Capo
  CapoSintetico?: CapoSintetico
  Colore?: Colore
  ContestoSuggerimento?: ContestoSuggerimento
  CorrezioniCapo?: CorrezioniCapo
  ElencoCapi?: ElencoCapi
  EsecuzionePlayground?: EsecuzionePlayground
  EsitoAnalisi?: EsitoAnalisi
  EsitoEsecuzione?: EsitoEsecuzione
  EsitoPlayground?: EsitoPlayground
  FiltroArmadio?: FiltroArmadio
  FotoCapo?: FotoCapo
  ImpegnoAgenda?: ImpegnoAgenda
  JobIa?: JobIa
  LetturaCapo?: LetturaCapo
  Meteo?: Meteo
  ModelloDisponibile?: ModelloDisponibile
  NuovoCapoManuale?: NuovoCapoManuale
  NuovoOutfit?: NuovoOutfit
  OrigineOutfit?: OrigineOutfit
  Outfit?: Outfit
  PreferenzeStile?: PreferenzeStile
  PresetPrompt?: PresetPrompt
  Profilo?: Profilo
  RichiestaAnalisi?: RichiestaAnalisi
  RichiestaPlayground?: RichiestaPlayground
  RichiestaSuggerimenti?: RichiestaSuggerimenti
  RichiestaUpload?: RichiestaUpload
  RiepilogoArmadio?: RiepilogoArmadio
  RispostaSuggerimenti?: RispostaSuggerimenti
  SlotAvatar?: SlotAvatar
  Stagione?: Stagione
  StatoAnalisi?: StatoAnalisi
  StatoCapo?: StatoCapo
  Suggerimento?: Suggerimento
  TipoCapo?: TipoCapo
  UploadFirmato?: UploadFirmato
  UsoToken?: UsoToken
  Vestizione?: Vestizione
  VestizioneColori?: VestizioneColori
}
export interface AggiornamentoCapo {
  correzioni?: CorrezioniCapo
  nome?: string | null
  preferito?: boolean | null
  stato?: StatoCapo | null
  etichette?: string[] | null
  appunti?: string | null
}
/**
 * Le correzioni dell'utente, una per attributo, tutte tipizzate.
 *
 * Volutamente non è `dict[str, str]`: correggere il colore significa mandare
 * nome più hex, e il tipo deve stare nell'enum. Un dizionario di stringhe
 * farebbe passare «maglietta» come tipo e lo scopriremmo sull'avatar.
 */
export interface CorrezioniCapo {
  tipo?: TipoCapo | null
  colore?: Colore | null
  materiale?: string | null
  fantasia?: string | null
  stagione?: Stagione | null
  vestibilita?: string | null
  lavaggio?: string | null
}
/**
 * Nome leggibile più esadecimale.
 *
 * L'hex non è un vezzo: è quello che il manichino 3D di oggi usa per tingere le
 * mesh, e per ora senza hex l'avatar non sa indossare il capo. È il primo passo:
 * l'ADR 0004 porta l'avatar a vestire la foto scontornata del capo come texture,
 * e allora il colore diventa il ripiego invece del requisito.
 */
export interface Colore {
  nome: string
  hex: string
}
/**
 * L'app riceve un identificativo e interroga lo stato: l'analisi è lenta.
 *
 * Tenerla asincrona è ciò che permette il caricamento in blocco di venti foto
 * senza che l'app resti appesa a una richiesta HTTP di quaranta secondi.
 */
export interface AnalisiAvviata {
  esecuzione_id: string
  stato?: StatoAnalisi
}
/**
 * Traccia di chi ha letto la foto, quando, e con quanta sicurezza.
 */
export interface AnalisiVisione {
  provider: string
  modello: string
  eseguita_il: string
  confidenze?: {
    [k: string]: number
  }
  corretti_a_mano?: AttributoCapo[]
  note?: string | null
}
export interface Capo {
  id: string
  nome: string
  tipo: TipoCapo
  slot: SlotAvatar
  colore: Colore
  foto: FotoCapo
  brand?: string | null
  sottotipo?: string | null
  materiale?: string | null
  fantasia?: string | null
  stagione?: Stagione | null
  vestibilita?: string | null
  lavaggio?: string | null
  stato?: StatoCapo
  preferito?: boolean
  ultimo_uso?: string | null
  volte_indossato?: number
  analisi?: AnalisiVisione | null
  /**
   * Tag liberi dell'utente (es. «lavoro», «da viaggio»): il modello di visione non li scrive mai, per questo restano fuori da `LetturaCapo`.
   */
  etichette?: string[]
  /**
   * Nota libera dell'utente sul capo. Mai vista dal modello di visione.
   */
  appunti?: string | null
  creato_il: string
  aggiornato_il: string
}
export interface FotoCapo {
  /**
   * Chiave dell'oggetto su S3
   */
  chiave: string
  /**
   * URL firmato, a vita breve
   */
  url?: string | null
  larghezza?: number | null
  altezza?: number | null
  /**
   * Chiave della stessa foto dopo lo scontorno: soggetto isolato, sfondo trasparente. Assente se lo scontorno non è ancora passato o è fallito — in quel caso l'app mostra l'originale, mai un buco vuoto.
   */
  chiave_scontornata?: string | null
  /**
   * URL firmato della foto scontornata
   */
  url_scontornata?: string | null
}
/**
 * Il capo come lo vede il modello di suggerimento.
 *
 * Volutamente magro: meno token per capo significa più capi nel contesto.
 */
export interface CapoSintetico {
  id: string
  nome: string
  tipo: TipoCapo
  slot: SlotAvatar
  colore: string
  hex: string
  materiale?: string | null
  stagione?: Stagione | null
  stato?: StatoCapo
  etichette?: string[]
}
/**
 * Tutto ciò che lo stilista può sapere, e nient'altro.
 *
 * È anche il payload che il playground mostra in chiaro: se un suggerimento
 * esce strano, si guarda qui prima di dare la colpa al modello.
 */
export interface ContestoSuggerimento {
  capi_disponibili: CapoSintetico[]
  meteo?: Meteo | null
  agenda?: ImpegnoAgenda[]
  in_lavaggio?: string[]
  indossati_di_recente?: string[]
  preferenze?: PreferenzeStile
  richiesta_utente?: string | null
  numero_proposte?: number
}
export interface Meteo {
  citta: string
  temp_c: number
  condizione: string
  percepita_c?: number | null
}
export interface ImpegnoAgenda {
  ora: string
  titolo: string
  dress_code?: string | null
}
export interface PreferenzeStile {
  stili?: string[]
  palette?: string[]
  evita?: string[]
}
export interface ElencoCapi {
  capi: Capo[]
  totale: number
}
/**
 * Riga dello storico: serve a confrontare provider a distanza di giorni.
 */
export interface EsecuzionePlayground {
  id: string
  eseguita_il: string
  job: JobIa
  provider: string
  modello: string
  temperatura: number
  latenza_ms: number
  costo_eur?: number | null
  esito: EsitoEsecuzione
  preset?: string | null
}
export interface EsitoAnalisi {
  esecuzione_id: string
  stato: StatoAnalisi
  capo?: Capo | null
  errore?: string | null
}
export interface EsitoPlayground {
  ok: boolean
  esito: EsitoEsecuzione
  provider: string
  modello: string
  latenza_ms: number
  uso?: UsoToken | null
  costo_eur?: number | null
  testo?: string | null
  lettura?: LetturaCapo | null
  suggerimenti?: Suggerimento[]
  errore?: string | null
}
export interface UsoToken {
  token_input?: number
  token_output?: number
}
/**
 * Quello che il modello di visione dichiara di aver letto dalla foto.
 *
 * Tutto opzionale per costruzione: «se un attributo non è leggibile metti
 * null, non tirare a indovinare». Non è ancora un `Capo` — diventa tale solo
 * passando da `domain.vision.crea_capo`.
 */
export interface LetturaCapo {
  tipo?: TipoCapo | null
  sottotipo?: string | null
  nome_proposto?: string | null
  colore?: Colore | null
  materiale?: string | null
  fantasia?: string | null
  stagione?: Stagione | null
  vestibilita?: string | null
  lavaggio?: string | null
  confidenze?: {
    [k: string]: number
  }
}
/**
 * Una proposta dello stilista, già validata contro l'armadio vero.
 */
export interface Suggerimento {
  titolo: string
  match: number
  vestizione: Vestizione
  /**
   * @maxItems 3
   */
  perche: [] | [string] | [string, string] | [string, string, string]
}
/**
 * Chi occupa quale slot dell'avatar. I valori sono id di capo.
 *
 * Le chiavi sono quelle di `mannequin.setOutfit()`: non tradurle.
 */
export interface Vestizione {
  top?: string | null
  bottom?: string | null
  outer?: string | null
  shoes?: string | null
  dress?: string | null
}
export interface FiltroArmadio {
  tipo?: TipoCapo | null
  stato?: StatoCapo | null
  solo_preferiti?: boolean
  testo?: string | null
}
/**
 * Una riga della lista modelli del playground.
 */
export interface ModelloDisponibile {
  provider: string
  id: string
  etichetta: string
  visione: boolean
  note?: string | null
  costo_input_eur_mtok?: number | null
  costo_output_eur_mtok?: number | null
  configurato?: boolean
  /**
   * Falso sui modelli che hanno rimosso il parametro e rifiutano la richiesta con 400. In un banco di prova una manopola che non fa niente è peggio di una manopola assente: da lì si traggono conclusioni sbagliate.
   */
  accetta_temperatura?: boolean
}
/**
 * Un capo inserito a mano, senza passare dal modello di visione.
 *
 * Nessuna `AnalisiVisione`: un capo che non è mai stato letto da un modello
 * non ha confidenze da mostrare, e non deve fingere di averle. Tipo e
 * colore restano obbligatori — sono gli stessi due attributi che
 * `ATTRIBUTI_INDISPENSABILI` chiede alla lettura automatica: senza tipo il
 * capo non ha uno slot per l'avatar, senza colore il manichino di oggi non
 * ha niente da tingere.
 */
export interface NuovoCapoManuale {
  nome: string
  tipo: TipoCapo
  colore: Colore
  chiave_foto: string
  brand?: string | null
  sottotipo?: string | null
  materiale?: string | null
  fantasia?: string | null
  stagione?: Stagione | null
  vestibilita?: string | null
  lavaggio?: string | null
  etichette?: string[]
  appunti?: string | null
}
export interface NuovoOutfit {
  nome: string
  vestizione: Vestizione
  occasione?: string | null
  origine?: OrigineOutfit
}
export interface Outfit {
  id: string
  nome: string
  vestizione: Vestizione
  occasione?: string | null
  origine?: OrigineOutfit
  volte_indossato?: number
  ultimo_uso?: string | null
  creato_il: string
}
export interface PresetPrompt {
  id: string
  etichetta: string
  job: JobIa
  system_prompt: string
  temperatura?: number
  max_token?: number
}
export interface Profilo {
  id: string
  nome: string
  citta?: string | null
  preferenze?: PreferenzeStile
  foto_url?: string | null
  /**
   * Foto a figura intera della persona. Oggi la usa l'avatar 2D, quando il manichino 3D non basta; nella direzione dell'ADR 0004 è l'ingresso del corpo 3D fedele alla persona, non un ripiego
   */
  avatar_foto_chiave?: string | null
  creato_il: string
}
export interface RichiestaAnalisi {
  chiave_foto: string
  provider?: string | null
  modello?: string | null
}
export interface RichiestaPlayground {
  job: JobIa
  provider: string
  modello: string
  system_prompt?: string | null
  temperatura?: number
  max_token?: number
  /**
   * Obbligatoria per il job analisi_capo
   */
  chiave_foto?: string | null
  /**
   * Obbligatorio per il job suggerimento
   */
  contesto?: ContestoSuggerimento | null
}
export interface RichiestaSuggerimenti {
  richiesta_utente?: string | null
  meteo?: Meteo | null
  agenda?: ImpegnoAgenda[]
  numero_proposte?: number
  provider?: string | null
  modello?: string | null
}
export interface RichiestaUpload {
  content_type: string
  nota?: string | null
}
export interface RiepilogoArmadio {
  totale: number
  da_lavare: number
  dormienti: number
  valore_dormiente_eur?: number | null
}
export interface RispostaSuggerimenti {
  suggerimenti: Suggerimento[]
  contesto: ContestoSuggerimento
  provider: string
  modello: string
  latenza_ms: number
}
/**
 * Risposta all'app prima che carichi la foto: l'upload va diretto a S3.
 */
export interface UploadFirmato {
  chiave: string
  url: string
  metodo?: string
  intestazioni?: {
    [k: string]: string
  }
  scade_in_s: number
}
/**
 * La stessa vestizione, risolta in colori: è ciò che il renderer riceve oggi.
 *
 * Il manichino non indossa fotografie, tinge primitive: per questo il colore
 * dominante estratto dalla foto è, per ora, il ponte fra le due feature di punta.
 * Non è il traguardo — vedi ADR 0004: il capo va visto dalla sua foto
 * scontornata, applicata come texture. Questo modello resterà per il ripiego.
 */
export interface VestizioneColori {
  top?: string | null
  bottom?: string | null
  outer?: string | null
  shoes?: string | null
  dress?: string | null
}
