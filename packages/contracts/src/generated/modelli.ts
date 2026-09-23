/**
 * GENERATO — non modificare a mano.
 *
 * Fonte di verità: services/api/src/domain/models.py
 * Rigenera con: npm run contracts:generate
 */

export type TipoCapo = 'top' | 'pantaloni' | 'scarpe' | 'capospalla' | 'abito' | 'accessorio'
export type Stagione = 'primavera' | 'estate' | 'autunno' | 'inverno' | 'mezza_stagione' | 'tutto_lanno'
export type StatoCapo = 'pulito' | 'da_lavare' | 'in_lavaggio'
export type StatoSegnalazione = 'ricevuta' | 'in_lavorazione' | 'risolta'
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
 * Tre corporature.
 *
 * **Il deck non dice quali sono**: mostra solo «Media» come valore corrente di
 * un selettore di cui non elenca le voci. Queste tre le abbiamo scelte noi, ed
 * è registrato in `docs/DOMANDE_APERTE.md` (`D-09`) perché è una lacuna di
 * specifica, non una decisione presa.
 */
export type Corporatura = 'minuta' | 'media' | 'robusta'
export type RuoloChat = 'utente' | 'wardrobe'
/**
 * Su che taglie ragioniamo — **lo dice la persona, non lo deduciamo.**
 *
 * Il deck lo scrive nell'occhiello della schermata: «Scegli tu il sistema di
 * taglie: non lo deduco da nome o foto». Non è una preferenza di comodo: è il
 * punto in cui l'app promette di non indovinare il genere di qualcuno.
 */
export type SistemaTaglie = 'donna' | 'uomo' | 'unisex'
/**
 * La taglia abituale, nel sistema a lettere.
 *
 * **Non copre i sistemi numerici** (38/40/42 italiani, 6/8/10 inglesi), e la
 * scelta è consapevole: le lettere sono le sole cinque che valgono per tutti e
 * tre i `SistemaTaglie`, e sono le sole che l'app oggi sappia offrire. Una
 * enum accetta esattamente ciò che l'interfaccia può produrre; un `str` libero
 * lascerebbe entrare «medium», «42» e «M» — tre modi di dire la stessa cosa
 * che nessuno normalizzerebbe mai più.
 *
 * Allargarla ai numeri è `T-44`: costa un cambio di contratto, **non** una
 * migrazione dei dati — una enum che diventa `str` lascia valide le righe già
 * scritte, ed è il verso buono in cui sbagliare.
 */
export type Taglia = 'xs' | 's' | 'm' | 'l' | 'xl'
export type OrigineOutfit = 'manuale' | 'ia' | 'suggerito_modificato'
/**
 * In che unità si **mostrano** le lunghezze. Non in che unità si salvano.
 *
 * `Misure` le tiene in centimetri e basta — il nome dei campi lo dice
 * (`altezza_cm`). Questa è una preferenza di lettura: cambiarla non riscrive
 * nessun dato, e due dispositivi dello stesso utente vedono lo stesso numero
 * perché la conversione avviene all'ultimo momento, non al salvataggio.
 *
 * Il deck ne governa tre — lunghezze, peso, temperatura. Le altre due non
 * esistono qui: **non c'è nessun campo peso** in tutto il dominio (e il deck
 * stesso scrive «non te lo chiedo»), e la temperatura richiede il meteo, che
 * il backend riceve ma non è mai andato a prendere. Offrirle vorrebbe dire
 * due selettori che non comandano niente.
 */
export type UnitaLunghezza = 'cm' | 'pollici'

/**
 * Generato da services/api/src/domain/models.py — non modificare a mano.
 */
export interface Contratti {
  AggiornamentoCapo?: AggiornamentoCapo
  AggiornamentoSegnalazione?: AggiornamentoSegnalazione
  AnalisiAvviata?: AnalisiAvviata
  AnalisiVisione?: AnalisiVisione
  AttributoCapo?: AttributoCapo
  Capo?: Capo
  CapoSintetico?: CapoSintetico
  Colore?: Colore
  ContestoSuggerimento?: ContestoSuggerimento
  ContoSvuotamento?: ContoSvuotamento
  ConversazioneChat?: ConversazioneChat
  Corporatura?: Corporatura
  CorrezioniCapo?: CorrezioniCapo
  Credenziali?: Credenziali
  ElencoCapi?: ElencoCapi
  ElencoConversazioniChat?: ElencoConversazioniChat
  ElencoMessaggiChat?: ElencoMessaggiChat
  ElencoSegnalazioni?: ElencoSegnalazioni
  EsitoAnalisi?: EsitoAnalisi
  EsportazionePronta?: EsportazionePronta
  FiltroArmadio?: FiltroArmadio
  FotoCapo?: FotoCapo
  ImpegnoAgenda?: ImpegnoAgenda
  LetturaCapo?: LetturaCapo
  MessaggioChat?: MessaggioChat
  Meteo?: Meteo
  Misure?: Misure
  ModelloDisponibile?: ModelloDisponibile
  NuovaSegnalazione?: NuovaSegnalazione
  NuovoOutfit?: NuovoOutfit
  OrigineOutfit?: OrigineOutfit
  Outfit?: Outfit
  PreferenzeStile?: PreferenzeStile
  Profilo?: Profilo
  Registrazione?: Registrazione
  RichiestaAnalisi?: RichiestaAnalisi
  RichiestaMessaggioChat?: RichiestaMessaggioChat
  RichiestaSuggerimenti?: RichiestaSuggerimenti
  RichiestaSvuotamento?: RichiestaSvuotamento
  RichiestaUpload?: RichiestaUpload
  RiepilogoArmadio?: RiepilogoArmadio
  RispostaChat?: RispostaChat
  RispostaSuggerimenti?: RispostaSuggerimenti
  RuoloChat?: RuoloChat
  Segnalazione?: Segnalazione
  SistemaTaglie?: SistemaTaglie
  SlotAvatar?: SlotAvatar
  Stagione?: Stagione
  StatoAnalisi?: StatoAnalisi
  StatoCapo?: StatoCapo
  StatoSegnalazione?: StatoSegnalazione
  Suggerimento?: Suggerimento
  Taglia?: Taglia
  TipoCapo?: TipoCapo
  TokenAccesso?: TokenAccesso
  UnitaLunghezza?: UnitaLunghezza
  UploadFirmato?: UploadFirmato
  UsoToken?: UsoToken
  Vestizione?: Vestizione
  VestizioneColori?: VestizioneColori
  VoceElencoConversazioni?: VoceElencoConversazioni
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
export interface AggiornamentoSegnalazione {
  stato: StatoSegnalazione
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
   * Chiave dell'oggetto nell'archivio foto
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
 * Se un suggerimento esce strano, è questo il payload da guardare prima di
 * dare la colpa al modello.
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
/**
 * Quanto è stato cancellato davvero.
 *
 * Non è telemetria: è l'unico modo che ha la persona di sapere che
 * l'operazione ha fatto ciò che prometteva. Un `204 No Content` dopo
 * un'azione irreversibile lascia solo da fidarsi.
 */
export interface ContoSvuotamento {
  capi: number
  outfit: number
  conversazioni: number
  usi_registrati: number
  foto: number
}
/**
 * Un contenitore di turni: da quando la chat ha smesso di essere una
 * sola sessione continua per utente (vedi docs/adr/0006).
 *
 * Rispecchia esattamente le colonne di `conversazioni_chat` — niente qui
 * dentro che l'adapter debba inventare per poterla salvare. `turni` e
 * `anteprima`, che servono solo all'elenco, vivono in
 * `VoceElencoConversazioni`, non qui.
 */
export interface ConversazioneChat {
  id: string
  titolo: string
  creata_il: string
  ultimo_turno_il: string
}
/**
 * Il corpo di POST /auth/accedi. Nessun requisito sulla password: qui
 * deve solo passare a `bcrypt.checkpw`, non essere accettabile — quello
 * vincolo vive in `Registrazione`, non qui, altrimenti un account creato
 * quando il minimo era più basso non potrebbe più accedere.
 */
export interface Credenziali {
  email: string
  password: string
}
export interface ElencoCapi {
  capi: Capo[]
  totale: number
}
export interface ElencoConversazioniChat {
  conversazioni: VoceElencoConversazioni[]
}
/**
 * `ConversazioneChat` più ciò che solo l'elenco calcola — un aggregato
 * su `messaggi_chat`, non colonne proprie di `conversazioni_chat`.
 */
export interface VoceElencoConversazioni {
  conversazione: ConversazioneChat
  turni: number
  anteprima: string
}
export interface ElencoMessaggiChat {
  messaggi: MessaggioChat[]
  conversazione?: ConversazioneChat | null
}
/**
 * Un turno di una conversazione con lo stilista.
 *
 * `testo` sul turno di Wardrobe è la prosa libera della risposta
 * (`RispostaStilista.risposta`), quella che si mostra a schermo;
 * `suggerimenti`, quando presenti, sono gli outfit proposti nello stesso
 * turno. La cronologia rimandata al modello (`domain.chat.cronologia_da_messaggi`)
 * riappende gli id di `suggerimenti` al testo, perché il modello non li
 * perda al turno successivo.
 */
export interface MessaggioChat {
  id: string
  ruolo: RuoloChat
  testo: string
  suggerimenti?: Suggerimento[]
  creato_il: string
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
export interface ElencoSegnalazioni {
  segnalazioni: Segnalazione[]
  amministratore?: boolean
}
/**
 * La copia che l'app tiene di una segnalazione già inviata a Sentry
 * (vedi `apps/mobile/src/dati/segnalazioni.ts`, `apriSegnalazione()`).
 *
 * Sentry resta il canale che avvisa chi lavora sull'app; questa riga è
 * quello che permette a chi ha segnalato — che a Sentry non ha accesso —
 * di vedere che è arrivata e a che punto è.
 */
export interface Segnalazione {
  id: string
  utente_id: string
  testo: string
  stato?: StatoSegnalazione
  creata_il: string
  aggiornata_il: string
}
export interface EsitoAnalisi {
  esecuzione_id: string
  stato: StatoAnalisi
  capo?: Capo | null
  errore?: string | null
}
/**
 * L'indirizzo da cui l'archivio si scarica, e per quanto ancora vale.
 *
 * **È l'unica parte che attraversa il confine.** L'app non riceve i dati: ne
 * riceve un URL firmato, che apre nel browser di sistema — un'app React
 * Native non ha un «scarica», e il browser ce l'ha.
 *
 * `scade_il` non è decorativo: l'URL è di fatto una credenziale al portatore
 * su tutto l'armadio, quindi l'interfaccia deve poter dire che è a tempo
 * invece di lasciar credere che sia un link da conservare.
 */
export interface EsportazionePronta {
  url: string
  scade_il: string
}
export interface FiltroArmadio {
  tipo?: TipoCapo | null
  stato?: StatoCapo | null
  solo_preferiti?: boolean
  testo?: string | null
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
 * Come si veste un corpo, non com'è fatto.
 *
 * **Ogni campo è opzionale, e il modello intero può non esserci.** Non è
 * lassismo: la schermata del deck offre «Le inserisco dopo» accanto a
 * «Continua», e promette «puoi cancellarle quando vuoi». Un `Misure` assente
 * è quella promessa mantenuta — non un profilo a metà da riempire.
 *
 * Gli estremi non sono decorativi. Servono a rifiutare un dito che scivola
 * (`1680` invece di `168`) prima che finisca in un `jsonb` e da lì
 * nell'avatar, dove diventerebbe una persona alta sedici metri.
 */
export interface Misure {
  sistema_taglie?: SistemaTaglie | null
  taglia?: Taglia | null
  altezza_cm?: number | null
  corporatura?: Corporatura | null
  spalle_cm?: number | null
  lunghezza_gamba_cm?: number | null
}
/**
 * Una riga del catalogo dei modelli di un provider — `ProviderLlm.modelli()`.
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
export interface NuovaSegnalazione {
  testo: string
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
export interface Profilo {
  id: string
  nome: string
  citta?: string | null
  preferenze?: PreferenzeStile
  misure?: Misure | null
  unita_lunghezza?: UnitaLunghezza
  foto_url?: string | null
  /**
   * Foto a figura intera della persona. Oggi la usa l'avatar 2D, quando il manichino 3D non basta; nella direzione dell'ADR 0004 è l'ingresso del corpo 3D fedele alla persona, non un ripiego
   */
  avatar_foto_chiave?: string | null
  creato_il: string
}
/**
 * Il corpo di POST /auth/registrati. L'allowlist (`EMAIL_AMMESSE`) e il
 * hash della password li applica `handlers/auth.py`; qui c'è solo la forma
 * del dato, non la sua ammissibilità.
 */
export interface Registrazione {
  email: string
  password: string
}
export interface RichiestaAnalisi {
  chiave_foto: string
  provider?: string | null
  modello?: string | null
}
export interface RichiestaMessaggioChat {
  testo: string
  meteo?: Meteo | null
  agenda?: ImpegnoAgenda[]
  /**
   * Assente: apre una conversazione nuova, col titolo dedotto dal messaggio.
   */
  conversazione_id?: string | null
}
export interface RichiestaSuggerimenti {
  richiesta_utente?: string | null
  meteo?: Meteo | null
  agenda?: ImpegnoAgenda[]
  numero_proposte?: number
  provider?: string | null
  modello?: string | null
}
/**
 * Il corpo di `POST /armadio/svuota`.
 *
 * **La parola esiste per rendere impossibile l'incidente.** Il tocco sullo
 * schermo è già dietro un campo in cui scrivere «SVUOTA», ma quella è una
 * difesa dell'interfaccia: sparisce con un refresh, un deep-link, un `curl`
 * ricopiato, o una richiesta rimandata due volte dalla libreria di rete. Un
 * `Literal` la porta nel contratto, quindi un `POST` senza intenzione
 * esplicita prende un 422 e non cancella niente — e il tipo TypeScript
 * generato contiene la parola, così non la si ridigita di là.
 */
export interface RichiestaSvuotamento {
  conferma: 'SVUOTA'
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
export interface RispostaChat {
  utente: MessaggioChat
  wardrobe: MessaggioChat
  conversazione: ConversazioneChat
  contesto: ContestoSuggerimento
  provider: string
  modello: string
  latenza_ms: number
}
export interface RispostaSuggerimenti {
  suggerimenti: Suggerimento[]
  contesto: ContestoSuggerimento
  provider: string
  modello: string
  latenza_ms: number
}
export interface TokenAccesso {
  token: string
}
/**
 * Risposta all'app prima che carichi la foto: l'upload va diretto
 * all'archivio foto, senza passare dal backend.
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
export interface UsoToken {
  token_input?: number
  token_output?: number
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
