/**
 * Le poche regole di dominio che servono anche sul telefono.
 *
 * Attenzione a cosa NON c'è qui: nessuna soglia scritta a mano. Le soglie
 * arrivano da `@wardrobe/contracts`, generate dai modelli Python. Se un giorno
 * il backend decide che un attributo è incerto sotto 90 invece di 86, questa
 * app cambia comportamento senza che nessuno la tocchi.
 */

import {
  type AttributoCapo,
  type Capo,
  LIMITI_MISURE_CM,
  MESI_PER_DORMIENTE,
  type Profilo,
  SOGLIA_INCERTEZZA,
  type SlotAvatar,
  type Stagione,
  type TipoCapo,
  VALORI_ATTRIBUTO_CAPO,
  type UnitaLunghezza,
  type Vestizione,
  type VestizioneColori,
} from '@wardrobe/contracts'
import { ETICHETTE } from '../tema/tokens'

/**
 * Le categorie di capo, nell'ordine in cui `ETICHETTE.tipo` le elenca — la
 * stessa fonte che dà loro un'etichetta italiana. Prima erano una seconda
 * dichiarazione letterale, ricopiata identica in `carica.tsx` e in
 * `capo/[id].tsx`.
 */
export const TIPI_CAPO = Object.keys(ETICHETTE.tipo) as TipoCapo[]

/** Le stagioni, nello stesso ordine di `ETICHETTE.stagione`. */
export const STAGIONI = Object.keys(ETICHETTE.stagione) as Stagione[]

const SLOT_DI_TIPO: Record<TipoCapo, SlotAvatar> = {
  top: 'top',
  pantaloni: 'bottom',
  scarpe: 'shoes',
  capospalla: 'outer',
  abito: 'dress',
  // Gli accessori non hanno posto sull'avatar: restano in armadio.
  accessorio: 'top',
}

export function slotDiTipo(tipo: TipoCapo): SlotAvatar {
  return SLOT_DI_TIPO[tipo]
}

export const SLOT_ORDINATI: readonly SlotAvatar[] = ['outer', 'top', 'bottom', 'shoes'] as const

/** Gli attributi da mostrare in pericolo, quelli che il modello non sa bene. */
export function attributiIncerti(capo: Capo): AttributoCapo[] {
  const analisi = capo.analisi
  if (!analisi?.confidenze) return []
  const corretti = new Set(analisi.corretti_a_mano ?? [])
  return VALORI_ATTRIBUTO_CAPO.filter((attributo) => {
    if (corretti.has(attributo)) return false
    const confidenza = analisi.confidenze?.[attributo]
    return typeof confidenza === 'number' && confidenza < SOGLIA_INCERTEZZA
  })
}

export function dormiente(capo: Capo, adesso = new Date()): boolean {
  if (!capo.ultimo_uso) return true
  const limite = new Date(adesso)
  limite.setMonth(limite.getMonth() - MESI_PER_DORMIENTE)
  return new Date(capo.ultimo_uso) < limite
}

/** I capi fermi da più di `MESI_PER_DORMIENTE`: Profilo e Calendario lo contavano ciascuno per conto proprio. */
export function capiDormienti(capi: Capo[], adesso = new Date()): Capo[] {
  return capi.filter((capo) => dormiente(capo, adesso))
}

/** Quanti capi sono in lavatrice: Oggi e l'Armadio lo contavano ciascuno a modo suo. */
export function daLavare(capi: Iterable<Capo>): number {
  let n = 0
  for (const capo of capi) if (capo.stato !== 'pulito') n += 1
  return n
}

/** Solo il pulito: lo stesso filtro di `capi_disponibili`
 * (`services/api/src/domain/wardrobe.py`), che decide cosa lo stilista può usare.
 * Serve anche qui per non chiedere una proposta che il backend non può produrre. */
export function capiDisponibili(capi: Iterable<Capo>): Capo[] {
  return Array.from(capi).filter((capo) => capo.stato === 'pulito')
}

/**
 * Gli slot che mancano per comporre almeno un outfit: stessa regola di
 * `vestizione_indossabile` (`services/api/src/domain/wardrobe.py`) — un
 * abito basta da solo, altrimenti servono un capo in `top` e uno in
 * `bottom`, le scarpe non sono richieste. Chiamare su `capiDisponibili(...)`,
 * non sull'armadio intero: il backend applica quel filtro per primo, e la
 * guardia deve prevedere cosa vedrà davvero.
 *
 * `capiDisponibili` da solo controllava il criterio sbagliato — il pulito,
 * non la componibilità — e un armadio con un solo top pulito passava il suo
 * filtro comunque, portando `/suggerimenti` a un 502 garantito.
 */
export function slotMancanti(capi: Iterable<Capo>): SlotAvatar[] {
  const slot = new Set<SlotAvatar>()
  for (const capo of capi) slot.add(capo.slot)
  if (slot.has('dress')) return []
  const mancanti: SlotAvatar[] = []
  if (!slot.has('top')) mancanti.push('top')
  if (!slot.has('bottom')) mancanti.push('bottom')
  return mancanti
}

/** Se l'armadio ha almeno una combinazione indossabile: nessuno slot manca. */
export function componibile(capi: Iterable<Capo>): boolean {
  return slotMancanti(capi).length === 0
}

/** Il nome di battesimo dal profilo — «Buongiorno, Marta» invece di «Buongiorno, Marta Rossi». */
export function nomeDiBattesimo(profilo: Profilo | null | undefined): string | undefined {
  return profilo?.nome?.split(' ')[0]
}

export function perId(capi: Capo[]): Map<string, Capo> {
  return new Map(capi.map((capo) => [capo.id, capo]))
}

export function capiDiVestizione(vestizione: Vestizione, capi: Map<string, Capo>): Capo[] {
  return SLOT_ORDINATI.concat('dress')
    .map((slot) => vestizione[slot])
    .filter((id): id is string => Boolean(id))
    .map((id) => capi.get(id))
    .filter((capo): capo is Capo => Boolean(capo))
}

/**
 * Traduce una vestizione in colori: il ponte del manichino a primitive tinte.
 *
 * Il manichino non indossa le fotografie, tinge superfici con i colori che il
 * modello di visione ha letto dalle foto dei capi. È il primo passo, non il
 * traguardo — la direzione è che il capo si veda dalla sua foto scontornata,
 * applicata come texture (`docs/adr/0004`). Quando arriverà, questa funzione
 * resta per il ripiego: serve ancora quando la texture non c'è.
 */
export function coloriDiVestizione(vestizione: Vestizione, capi: Map<string, Capo>): VestizioneColori {
  const risolvi = (id: string | null | undefined) => (id ? (capi.get(id)?.colore.hex ?? null) : null)
  return {
    top: risolvi(vestizione.top),
    bottom: risolvi(vestizione.bottom),
    outer: risolvi(vestizione.outer),
    shoes: risolvi(vestizione.shoes),
    dress: risolvi(vestizione.dress),
  }
}

/**
 * Una manciata di colori comuni: più veloce che digitare un esadecimale a
 * mano, per il form manuale e per la correzione di un colore letto male.
 */
export const PALETTE_COLORI = [
  { nome: 'Bianco', hex: '#F7F4EF' },
  { nome: 'Nero', hex: '#1C1C21' },
  { nome: 'Grigio', hex: '#8A8A8E' },
  { nome: 'Panna', hex: '#E7DFD2' },
  { nome: 'Blu', hex: '#3B5A80' },
  { nome: 'Indaco', hex: '#46536B' },
  { nome: 'Verde', hex: '#5B6B4F' },
  { nome: 'Rosso', hex: '#A6392C' },
  { nome: 'Cammello', hex: '#A9805A' },
  { nome: 'Rosa', hex: '#D9A9A0' },
] as const

/**
 * La foto da mostrare: quella scontornata se c'è, altrimenti l'originale.
 *
 * Uno sfondo trasparente non è sempre garantito — il servizio di scontorno
 * può non essere configurato o può fallire (vedi `handlers/analisi.py`) — e
 * in quel caso l'app deve comunque mostrare qualcosa, mai un riquadro vuoto.
 */
export function fotoDaMostrare(capo: Capo): string | undefined {
  return capo.foto.url_scontornata ?? capo.foto.url ?? undefined
}

/** «3 giorni», «ieri», «4 mesi»: come lo scrive il design. */
export function quandoUsato(iso: string | null | undefined): string {
  if (!iso) return 'mai usato'
  const giorni = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (giorni <= 0) return 'oggi'
  if (giorni === 1) return 'ieri'
  if (giorni < 30) return `${giorni} giorni`
  const mesi = Math.round(giorni / 30)
  return mesi === 1 ? 'un mese' : `${mesi} mesi`
}

/**
 * ────────────── Le lunghezze: si salvano in centimetri, si mostrano come vuoi
 *
 * `Misure` tiene solo centimetri — lo dice il nome dei campi (`altezza_cm`), e
 * `unita_lunghezza` sul profilo è una preferenza di **lettura**. La conversione
 * sta qui, all'ultimo momento, e mai al salvataggio: così cambiare unità non
 * riscrive nessun dato e non può perdere precisione a ogni giro.
 */

const CM_PER_POLLICE = 2.54

/** Da centimetri all'unità scelta, arrotondato all'intero che si digita. */
export function daCentimetri(cm: number, unita: UnitaLunghezza): number {
  return unita === 'cm' ? cm : Math.round(cm / CM_PER_POLLICE)
}

/** Il verso opposto: quello che si è digitato, in centimetri da salvare. */
export function aCentimetri(valore: number, unita: UnitaLunghezza): number {
  return unita === 'cm' ? valore : Math.round(valore * CM_PER_POLLICE)
}

/** Come si scrive l'unità accanto a un numero. */
export function simboloUnita(unita: UnitaLunghezza): string {
  return unita === 'cm' ? 'cm' : '″'
}

/** Un numero di centimetri, scritto come va letto: «168 cm», «66″». */
export function formattaLunghezza(cm: number, unita: UnitaLunghezza): string {
  return `${daCentimetri(cm, unita)} ${simboloUnita(unita)}`
}

/**
 * Gli estremi accettati, nell'unità che si sta digitando.
 *
 * **Non è una divisione e basta.** Il server valida in centimetri, e la
 * conversione arrotonda: un minimo di 120 cm diviso 2,54 fa 47,24, ma digitare
 * `47` darebbe 119 cm — che il server rifiuta. Il minimo si arrotonda **per
 * eccesso** e il massimo **per difetto**, così ogni valore che questa funzione
 * accetta è ancora dentro i limiti veri dopo la conversione. Il verso opposto
 * (floor sul minimo) farebbe passare il campo e cadere il salvataggio, con un
 * errore che l'utente non può correggere perché il campo gli dà ragione.
 */
export function limitiIn(
  chiave: keyof typeof LIMITI_MISURE_CM,
  unita: UnitaLunghezza,
): { min: number; max: number } {
  const { min, max } = LIMITI_MISURE_CM[chiave]
  if (unita === 'cm') return { min, max }
  return { min: Math.ceil(min / CM_PER_POLLICE), max: Math.floor(max / CM_PER_POLLICE) }
}
