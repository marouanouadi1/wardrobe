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
  MESI_PER_DORMIENTE,
  SOGLIA_INCERTEZZA,
  type SlotAvatar,
  type TipoCapo,
  VALORI_ATTRIBUTO_CAPO,
  type Vestizione,
  type VestizioneColori,
} from '@wardrobe/contracts'

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

/** Gli attributi da mostrare in corallo, quelli che il modello non sa bene. */
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

export function eIncerto(capo: Capo, attributo: AttributoCapo): boolean {
  return attributiIncerti(capo).includes(attributo)
}

export function valoreAttributo(capo: Capo, attributo: AttributoCapo): string | null {
  switch (attributo) {
    case 'colore':
      return capo.colore.nome
    case 'tipo':
      return capo.tipo
    default:
      return (capo[attributo] as string | null | undefined) ?? null
  }
}

export function dormiente(capo: Capo, adesso = new Date()): boolean {
  if (!capo.ultimo_uso) return true
  const limite = new Date(adesso)
  limite.setMonth(limite.getMonth() - MESI_PER_DORMIENTE)
  return new Date(capo.ultimo_uso) < limite
}

export function perId(capi: Capo[]): Map<string, Capo> {
  return new Map(capi.map((capo) => [capo.id, capo]))
}

export function vestizioneIndossabile(vestizione: Vestizione): boolean {
  if (vestizione.dress) return true
  return Boolean(vestizione.top && vestizione.bottom)
}

/**
 * Traduce una vestizione in colori.
 *
 * Il ponte com'è oggi: il manichino non indossa le fotografie, tinge superfici
 * con i colori che il modello di visione ha letto dalle foto dei capi. È il primo
 * passo, non il traguardo — la direzione è che il capo si veda dalla sua foto
 * scontornata, applicata come texture (`docs/adr/0004`). Quando arriverà, questa
 * funzione resta per il ripiego: serve ancora quando la texture non c'è.
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

export function capiDiVestizione(vestizione: Vestizione, capi: Map<string, Capo>): Capo[] {
  return SLOT_ORDINATI.concat('dress')
    .map((slot) => vestizione[slot])
    .filter((id): id is string => Boolean(id))
    .map((id) => capi.get(id))
    .filter((capo): capo is Capo => Boolean(capo))
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
