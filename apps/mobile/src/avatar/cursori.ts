/**
 * I cursori di MakeHuman che l'app mette in mano: quali, con che parole, su quali livelli.
 *
 * **È l'unica fonte dell'elenco.** Lo leggono la schermata dell'avatar, il motore (per sapere
 * quali target muovere), `tools/avatar/estrai.py` (per mettere nei pacchetti solo i target che
 * servono) e la pagina di revisione dei cursori. Per questo il file **non importa niente che
 * esista a runtime**: l'estrattore lo legge con `node`, che toglie i tipi e lo esegue così com'è.
 * Niente `enum`, niente import di valori — solo `import type`, che sparisce.
 *
 * **Ogni cursore è un cursore di MakeHuman, con il suo nome e il suo intervallo**: è la scelta
 * dell'utente del 2026-10-18, dopo una prima versione con manopole miscelate e spinte oltre 1.
 * Qui si sceglie solo *quali* — e su quanti **livelli**: cinque, perché gli ADR 0011 e 0012
 * vogliono livelli pochi (i capi da template si guardano su ogni combinazione). Passare dai
 * livelli a un cursore continuo non costa niente, il contrario sì: per questo si parte da qui.
 *
 * Il nome è anche la chiave salvata nel profilo (`Avatar.cursori`), e il valore salvato è quello
 * di MakeHuman, non l'indice del livello: se i livelli cambiano, i profili restano leggibili.
 *
 * **L'altezza non è qui**: viene da `Misure.altezza_cm` (ADR 0011, «i livelli leggono da lì, non
 * da una seconda copia») e il motore cerca il valore della macro che la raggiunge.
 */

import type { CorpoBase } from '@wardrobe/contracts'

export type Zona = 'corpo' | 'busto' | 'fianchi' | 'gambe' | 'braccia'

export interface Cursore {
  /** Il nome di MakeHuman: per le macro la chiave (`weight`), per gli altri il cursore di `target.json`. */
  nome: string
  tipo: 'macro' | 'regionale'
  etichetta: string
  /** Le parole ai due capi della scala, da sinistra a destra. */
  estremi: readonly [string, string]
  zona: Zona
  /** Solo per questi corpi di partenza. Assente: per tutti. */
  corpi?: readonly CorpoBase[]
  /** I valori ammessi, nella scala di MakeHuman: 0…1 per le macro, −1…+1 per gli altri. */
  livelli: readonly number[]
  /** Il valore di partenza, che è anche il corpo medio di MakeHuman. */
  neutro: number
}

const MACRO = [0, 0.25, 0.5, 0.75, 1] as const
const REGIONALE = [-1, -0.5, 0, 0.5, 1] as const

export const ZONE: readonly { zona: Zona; nome: string }[] = [
  { zona: 'corpo', nome: 'Corpo intero' },
  { zona: 'busto', nome: 'Busto' },
  { zona: 'fianchi', nome: 'Fianchi' },
  { zona: 'gambe', nome: 'Gambe' },
  { zona: 'braccia', nome: 'Braccia' },
]

/**
 * Scelti per come cambiano il modo in cui **un capo cade**, non per l'anatomia: l'avatar esiste
 * per vestirsi. Viso, testa ed età restano fuori — la faccia è `D-10`, l'età chiede i target
 * «old» (altri 4 MB per corpo) e non sposta una taglia.
 */
export const CURSORI: readonly Cursore[] = [
  { nome: 'weight', tipo: 'macro', etichetta: 'Peso', estremi: ['meno', 'più'], zona: 'corpo', livelli: MACRO, neutro: 0.5 },
  {
    nome: 'muscle',
    tipo: 'macro',
    etichetta: 'Muscolatura',
    estremi: ['meno', 'più'],
    zona: 'corpo',
    livelli: MACRO,
    neutro: 0.5,
  },
  {
    nome: 'cupsize',
    tipo: 'macro',
    etichetta: 'Seno',
    estremi: ['più piccolo', 'più grande'],
    zona: 'busto',
    corpi: ['donna'],
    livelli: MACRO,
    neutro: 0.5,
  },
  {
    nome: 'torso-muscle-pectoral-decr-incr',
    tipo: 'regionale',
    etichetta: 'Pettorali',
    estremi: ['meno', 'più'],
    zona: 'busto',
    corpi: ['uomo'],
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'measure-shoulder-dist-decr-incr',
    tipo: 'regionale',
    etichetta: 'Spalle',
    estremi: ['più strette', 'più larghe'],
    zona: 'busto',
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'measure-bust-circ-decr-incr',
    tipo: 'regionale',
    etichetta: 'Torace',
    estremi: ['più stretto', 'più ampio'],
    zona: 'busto',
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'measure-waist-circ-decr-incr',
    tipo: 'regionale',
    etichetta: 'Vita',
    estremi: ['più stretta', 'più larga'],
    zona: 'busto',
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'measure-napetowaist-dist-decr-incr',
    tipo: 'regionale',
    etichetta: 'Lunghezza del busto',
    estremi: ['più corto', 'più lungo'],
    zona: 'busto',
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'measure-hips-circ-decr-incr',
    tipo: 'regionale',
    etichetta: 'Fianchi',
    estremi: ['più stretti', 'più larghi'],
    zona: 'fianchi',
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'buttocks-volume-decr-incr',
    tipo: 'regionale',
    etichetta: 'Glutei',
    estremi: ['meno', 'più'],
    zona: 'fianchi',
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'upperlegs-height-decr-incr',
    tipo: 'regionale',
    etichetta: 'Lunghezza delle gambe',
    estremi: ['più corte', 'più lunghe'],
    zona: 'gambe',
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'measure-thigh-circ-decr-incr',
    tipo: 'regionale',
    etichetta: 'Cosce',
    estremi: ['più sottili', 'più piene'],
    zona: 'gambe',
    livelli: REGIONALE,
    neutro: 0,
  },
  {
    nome: 'measure-upperarm-circ-decr-incr',
    tipo: 'regionale',
    etichetta: 'Braccia',
    estremi: ['più sottili', 'più piene'],
    zona: 'braccia',
    livelli: REGIONALE,
    neutro: 0,
  },
]

/** I cursori che valgono per un corpo di partenza, nell'ordine dell'elenco. */
export function cursoriPer(corpo: CorpoBase): Cursore[] {
  return CURSORI.filter((c) => !c.corpi || c.corpi.includes(corpo))
}

/** Il livello più vicino a un valore salvato: un profilo scritto con altri livelli resta leggibile. */
export function livelloVicino(cursore: Cursore, valore: number | undefined): number {
  if (valore === undefined || !Number.isFinite(valore)) return cursore.neutro
  let migliore = cursore.livelli[0]
  for (const l of cursore.livelli) if (Math.abs(l - valore) < Math.abs(migliore - valore)) migliore = l
  return migliore
}
