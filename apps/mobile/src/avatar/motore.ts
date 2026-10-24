/**
 * Il calcolo di MakeHuman (MPFB 2.0.18) rifatto nell'app, sui suoi dati grezzi (ADR 0013).
 *
 * È il motore dell'esploratore dei cursori del 2026-10-18 portato in TypeScript: ogni funzione
 * ricalca un pezzo di MPFB, citato accanto. La forma è il corpo base più la somma pesata dei
 * target; le macro scelgono quali target e con che peso; gli accessori (occhi, capelli, lo strato
 * neutro) si agganciano come dice il loro `.mhclo`; la posa abbassa le braccia.
 *
 * **Niente `three` e niente React Native qui dentro**, di proposito: lo provano i test di jest
 * contro i vertici calcolati da MPFB dentro Blender, e la pagina di revisione dei cursori lo
 * esegue così com'è. Chi disegna sta in `scena.ts`.
 *
 * Tutto nel sistema di MakeHuman: Y in alto, il davanti verso +Z, decimetri.
 */

import type { CorpoBase } from '@wardrobe/contracts'
import { cursoriPer } from './cursori'

// ── i pacchetti ───────────────────────────────────────────────────────────────

type NomeTipo = 'float32' | 'uint16' | 'int16' | 'uint32' | 'uint8'
type Vettore = Float32Array | Uint16Array | Int16Array | Uint32Array | Uint8Array
interface VoceArray {
  o: number
  n: number
  t: NomeTipo
}
interface VoceTarget {
  d: VoceArray
  i?: VoceArray
  s: number
}
interface VoceAccessorio {
  vertici: number
  rif: VoceArray
  pesi: VoceArray
  scarti: VoceArray
  scala: [number, number, number][]
  origine: VoceArray
  uv: VoceArray
  triangoli: VoceArray
  nasconde: VoceArray
}
interface ParteMacro {
  lowest: number
  highest: number
  low: string
  high: string
}
interface CursoreDelPacco {
  nome: string
  neg: string[]
  pos: string[]
}
interface Testa {
  formato: number
  genere?: number
  corpo?: { vertici: number; base: VoceArray; origine: VoceArray; uv: VoceArray; triangoli: VoceArray; nel_corpo: VoceArray }
  macro?: Record<string, { parts: ParteMacro[] }>
  macro_fisse?: Record<string, number> & { razze: Record<string, number> }
  cursori?: CursoreDelPacco[]
  target?: Record<string, VoceTarget>
  ossa?: { nome: string; padre: string | null }[]
  articolazioni?: Record<string, VoceArray>
  pesi?: Record<string, { i: VoceArray; w: VoceArray }>
  accessori?: Record<string, VoceAccessorio>
  tex?: Record<string, { w: number; h: number; rgba: VoceArray }>
}

export interface Pacco {
  testa: Testa
  arr: (v: VoceArray) => Vettore
}

const TIPI = { float32: Float32Array, uint16: Uint16Array, int16: Int16Array, uint32: Uint32Array, uint8: Uint8Array }

/** Legge un pacchetto di `tools/avatar/estrai.py`: 4 byte di lunghezza, la testa JSON, il blob. */
export function leggiPacco(byte: ArrayBuffer): Pacco {
  const lt = new DataView(byte).getUint32(0, true)
  const testa = JSON.parse(ascii(new Uint8Array(byte, 4, lt))) as Testa
  let base = 4 + lt
  while (base % 4) base++
  return { testa, arr: (v) => new TIPI[v.t](byte, base + v.o, v.n) }
}

// L'estrattore scrive la testa in ASCII puro (`ensure_ascii`): si legge senza `TextDecoder`,
// che Hermes non garantisce.
function ascii(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192))
  return s
}

// ── le macro ────────────────────────────────────────────────────────────────

const SOGLIA = 0.01
type Componente = [string, number]

// TargetService._interpolate_macro_components
function componenti(parti: ParteMacro[], valore: number): Componente[] {
  const out: Componente[] = []
  for (const p of parti) {
    if (valore > p.lowest && valore < p.highest) {
      const pos = (valore - p.lowest) / (p.highest - p.lowest)
      const basso = Math.round((1 - pos) * 1e4) / 1e4
      const alto = Math.round(pos * 1e4) / 1e4
      if (p.low) out.push([p.low, basso])
      if (p.high) out.push([p.high, alto])
    }
  }
  return out
}

/** TargetService.calculate_target_stack_from_macro_info_dict, con la stessa soglia e le stesse esclusioni. */
export function pilaMacro(
  macro: Record<string, { parts: ParteMacro[] }>,
  m: Record<string, number>,
  razze: Record<string, number>,
): [string, number][] {
  const c: Record<string, Componente[]> = {}
  for (const n of ['gender', 'age', 'muscle', 'weight', 'proportions', 'height', 'cupsize', 'firmness']) {
    c[n] = componenti(macro[n].parts, m[n])
  }
  const out: [string, number][] = []
  for (const [razza, rv] of Object.entries(razze)) {
    if (rv > 0.0001)
      for (const a of c.age)
        for (const g of c.gender) {
          if (g[0] === 'universal') continue
          const w = rv * g[1] * a[1]
          if (w > SOGLIA) out.push([`macrodetails/${razza}-${g[0]}-${a[0]}`, w])
        }
  }
  for (const g of c.gender)
    for (const a of c.age)
      for (const mu of c.muscle)
        for (const wg of c.weight) {
          const w = g[1] * a[1] * mu[1] * wg[1]
          if (w > SOGLIA) out.push([`macrodetails/universal-${g[0]}-${a[0]}-${mu[0]}-${wg[0]}`, w])
          for (const h of c.height) {
            const wh = w * h[1]
            if (wh > SOGLIA) out.push([`macrodetails/height/${g[0]}-${a[0]}-${mu[0]}-${wg[0]}-${h[0]}`, wh])
          }
        }
  for (const g of c.gender) {
    if (g[0] !== 'female') continue
    // come in MPFB: il peso del genere qui non entra («there are no male complementary targets»)
    for (const a of c.age)
      for (const mu of c.muscle)
        for (const wg of c.weight)
          for (const cu of c.cupsize)
            for (const f of c.firmness) {
              const nome = `breast/female-${a[0]}-${mu[0]}-${wg[0]}-${cu[0]}-${f[0]}`
              const w = a[1] * mu[1] * wg[1] * cu[1] * f[1]
              if (w > SOGLIA && !nome.includes('averagecup-averagefirmness') && !nome.includes('-baby-')) out.push([nome, w])
            }
  }
  for (const g of c.gender)
    for (const a of c.age)
      for (const mu of c.muscle)
        for (const wg of c.weight)
          for (const p of c.proportions) {
            const nome = `macrodetails/proportions/${g[0]}-${a[0]}-${mu[0]}-${wg[0]}-${p[0]}`
            const w = g[1] * a[1] * mu[1] * wg[1] * p[1]
            if (w > SOGLIA && !nome.includes('-baby-')) out.push([nome, w])
          }
  return out
}

// ── il corpo ─────────────────────────────────────────────────────────────────

const MACRO_AL_CENTRO = { age: 0.5, muscle: 0.5, weight: 0.5, proportions: 0.5, height: 0.5, cupsize: 0.5, firmness: 0.5 }

interface Target {
  d: Int16Array
  i: Uint16Array | null
  s: number
}
export interface Accessorio {
  nv: number
  rif: Uint16Array
  pesi: Float32Array
  scarti: Float32Array
  scala: [number, number, number][]
  origine: Uint32Array
  uv: Float32Array
  triangoli: Uint32Array
  nasconde: Uint16Array
}
export interface Texture {
  w: number
  h: number
  rgba: Uint8Array
}

/**
 * Lo stato di un corpo nel linguaggio di MakeHuman: le macro (fra cui `height`, che l'app
 * cerca da `Misure.altezza_cm`) e i cursori regionali, con il loro valore.
 */
export interface StatoMH {
  macro: Record<string, number>
  cursori: Record<string, number>
}

export class Umano {
  readonly corpoBase: CorpoBase
  readonly nv: number
  readonly base: Float32Array
  readonly corpo: { origine: Uint32Array; uv: Float32Array; triangoli: Uint32Array; nel: Uint16Array }
  readonly accessori: Record<string, Accessorio> = {}
  readonly tex: Record<string, Texture> = {}
  readonly macroFisse: Record<string, number>
  readonly razze: Record<string, number>
  readonly genere: number
  private readonly macro: Record<string, { parts: ParteMacro[] }>
  private readonly target: Record<string, Target> = {}
  private readonly cursori: Record<string, CursoreDelPacco> = {}
  private readonly articolazioni: Record<string, Uint16Array>
  readonly ossa: { nome: string; padre: string | null }[]
  readonly pesi: Record<string, { i: Uint16Array; w: Float32Array }>

  /** `comune` più il pacchetto del corpo, più eventuali pacchetti di candidati (la pagina di revisione). */
  constructor(corpoBase: CorpoBase, comune: Pacco, corpo: Pacco, ...altri: Pacco[]) {
    const t = comune.testa
    if (!t.corpo || !t.macro || !t.macro_fisse || !t.ossa || !t.articolazioni || !t.pesi) {
      throw new Error('il pacchetto comune del corpo è incompleto')
    }
    this.corpoBase = corpoBase
    this.nv = t.corpo.vertici
    this.base = comune.arr(t.corpo.base) as Float32Array
    this.corpo = {
      origine: comune.arr(t.corpo.origine) as Uint32Array,
      uv: comune.arr(t.corpo.uv) as Float32Array,
      triangoli: comune.arr(t.corpo.triangoli) as Uint32Array,
      nel: comune.arr(t.corpo.nel_corpo) as Uint16Array,
    }
    this.macro = t.macro
    const { razze, ...fisse } = t.macro_fisse
    this.macroFisse = fisse
    this.razze = razze
    this.genere = corpo.testa.genere ?? 0
    this.ossa = t.ossa
    this.articolazioni = Object.fromEntries(
      Object.entries(t.articolazioni).map(([k, v]) => [k, comune.arr(v) as Uint16Array]),
    )
    this.pesi = Object.fromEntries(
      Object.entries(t.pesi).map(([k, v]) => [k, { i: comune.arr(v.i) as Uint16Array, w: comune.arr(v.w) as Float32Array }]),
    )
    for (const p of [comune, corpo, ...altri]) this.aggiungi(p)
  }

  private aggiungi(p: Pacco) {
    for (const [k, v] of Object.entries(p.testa.target ?? {})) {
      this.target[k] = { d: p.arr(v.d) as Int16Array, i: v.i ? (p.arr(v.i) as Uint16Array) : null, s: v.s }
    }
    for (const c of p.testa.cursori ?? []) this.cursori[c.nome] = c
    for (const [nome, a] of Object.entries(p.testa.accessori ?? {})) {
      this.accessori[nome] = {
        nv: a.vertici,
        rif: p.arr(a.rif) as Uint16Array,
        pesi: p.arr(a.pesi) as Float32Array,
        scarti: p.arr(a.scarti) as Float32Array,
        scala: a.scala,
        origine: p.arr(a.origine) as Uint32Array,
        uv: p.arr(a.uv) as Float32Array,
        triangoli: p.arr(a.triangoli) as Uint32Array,
        nasconde: p.arr(a.nasconde) as Uint16Array,
      }
    }
    for (const [nome, x] of Object.entries(p.testa.tex ?? {})) {
      this.tex[nome] = { w: x.w, h: x.h, rgba: p.arr(x.rgba) as Uint8Array }
    }
  }

  /** Tutti i target con il loro peso: le macro, poi i cursori regionali (> 0 i «pos», < 0 i «neg»). */
  pila(stato: StatoMH): [string, number][] {
    // Ogni macro parte dal suo centro, come nel corpo di default di MakeHuman: una macro che
    // nessuno ha toccato non è assente, è a metà. Senza, peso e muscolatura mai mossi facevano
    // sparire tutta la pila delle macro, altezza compresa (il test contro MPFB l'ha preso).
    const m = { ...MACRO_AL_CENTRO, ...this.macroFisse, ...stato.macro, gender: this.genere }
    const pila = pilaMacro(this.macro, m, this.razze)
    for (const [nome, v] of Object.entries(stato.cursori)) {
      const c = this.cursori[nome]
      if (!c || !v) continue
      for (const rel of v > 0 ? c.pos : c.neg) pila.push([rel, Math.abs(v)])
    }
    return pila
  }

  /** Aggiunge a `out` un target con peso `w`. Un target che il pacchetto non ha è un errore, non uno zero. */
  aggiungiTarget(rel: string, w: number, out: Float64Array) {
    const t = this.target[rel]
    if (!t) throw new Error(`target mancante nei pacchetti: ${rel}`)
    const k = w * t.s
    const d = t.d
    if (t.i) {
      const idx = t.i
      for (let j = 0, n = idx.length; j < n; j++) {
        const v = idx[j] * 3
        const q = j * 3
        out[v] += d[q] * k
        out[v + 1] += d[q + 1] * k
        out[v + 2] += d[q + 2] * k
      }
    } else {
      for (let j = 0, n = d.length; j < n; j++) out[j] += d[j] * k
    }
  }

  /** La forma senza posa: il corpo base più la somma pesata dei target. */
  forma(stato: StatoMH, out = new Float64Array(this.nv * 3)): Float64Array {
    out.set(this.base)
    for (const [rel, w] of this.pila(stato)) this.aggiungiTarget(rel, w, out)
    return out
  }

  /** ClothesService.fit_clothes_to_human: tre vertici del corpo pesati, più uno scarto scalato sui tre assi. */
  adatta(nome: string, P: ArrayLike<number>, out?: Float64Array): Float64Array {
    const a = this.accessori[nome]
    const r = out ?? new Float64Array(a.nv * 3)
    const dim = a.scala.map(([v1, v2, d], asse) => Math.abs(P[v1 * 3 + asse] - P[v2 * 3 + asse]) / d)
    const { rif, pesi, scarti } = a
    for (let i = 0; i < a.nv; i++) {
      const r0 = rif[i * 3] * 3
      const r1 = rif[i * 3 + 1] * 3
      const r2 = rif[i * 3 + 2] * 3
      const w0 = pesi[i * 3]
      const w1 = pesi[i * 3 + 1]
      const w2 = pesi[i * 3 + 2]
      for (let k = 0; k < 3; k++) {
        r[i * 3 + k] = w0 * P[r0 + k] + w1 * P[r1 + k] + w2 * P[r2 + k] + scarti[i * 3 + k] * dim[k]
      }
    }
    return r
  }

  /** Il centro di un cubo `joint-*`: è da lì che MPFB prende teste e code delle ossa (strategia «CUBE»). */
  articolazione(nome: string, P: ArrayLike<number>): V3 {
    const vs = this.articolazioni[nome]
    const c: V3 = [0, 0, 0]
    for (const v of vs) {
      c[0] += P[v * 3]
      c[1] += P[v * 3 + 1]
      c[2] += P[v * 3 + 2]
    }
    return [c[0] / vs.length, c[1] / vs.length, c[2] / vs.length]
  }

  /** Quanto è alto il corpo, in centimetri, dai piedi alla cima della testa. */
  altezzaCm(P: ArrayLike<number>): number {
    let min = Infinity
    let max = -Infinity
    for (const v of this.corpo.nel) {
      const y = P[v * 3 + 1]
      if (y < min) min = y
      if (y > max) max = y
    }
    return (max - min) * 10
  }
}

// ── l'altezza da Misure ─────────────────────────────────────────────────────

/**
 * Il valore della macro `height` che dà al corpo l'altezza chiesta, con tutto il resto fermo.
 *
 * L'altezza di MakeHuman non è un numero di centimetri: è una macro da 0 a 1, e quanti
 * centimetri valga dipende da peso, muscolatura e dai cursori che allungano le gambe o il busto.
 * L'altezza misurata cresce con la macro, quindi si cerca per bisezione; ogni prova muove solo
 * i target dell'altezza. Fuori dall'intervallo raggiungibile si ferma all'estremo e lo dice.
 */
export function macroAltezza(
  u: Umano,
  stato: StatoMH,
  cm: number,
): { valore: number; raggiunta: number; minimo: number; massimo: number } {
  const senza = new Float64Array(u.nv * 3)
  senza.set(u.base)
  const conAltezza = { ...stato, macro: { ...stato.macro, height: 0.5 } }
  // la forma con la macro dell'altezza al centro, dove nessun target dell'altezza agisce
  for (const [rel, w] of u.pila(conAltezza)) u.aggiungiTarget(rel, w, senza)
  const prova = new Float64Array(u.nv * 3)
  const misura = (h: number) => {
    prova.set(senza)
    for (const [rel, w] of u.pila({ ...stato, macro: { ...stato.macro, height: h } })) {
      if (rel.startsWith('macrodetails/height/')) u.aggiungiTarget(rel, w, prova)
    }
    return u.altezzaCm(prova)
  }
  const minimo = misura(0)
  const massimo = misura(1)
  if (cm <= minimo) return { valore: 0, raggiunta: minimo, minimo, massimo }
  if (cm >= massimo) return { valore: 1, raggiunta: massimo, minimo, massimo }
  let basso = 0
  let alto = 1
  for (let i = 0; i < 18; i++) {
    const medio = (basso + alto) / 2
    if (misura(medio) < cm) basso = medio
    else alto = medio
  }
  const valore = (basso + alto) / 2
  return { valore, raggiunta: misura(valore), minimo, massimo }
}

// ── la posa ─────────────────────────────────────────────────────────────────

type V3 = [number, number, number]
/** Una trasformazione rigida: rotazione 3×3 per righe, poi traslazione. */
interface Rigida {
  r: number[]
  t: V3
}

/**
 * Le braccia distese lungo i fianchi: 4° dalla verticale, avambraccio allineato al braccio
 * (`gomito` è la piega che resta, zero), niente spinta in avanti, e 1,5 cm d'aria fra mano e
 * corpo. Su un corpo largo l'angolo sale da sé, un grado alla volta, finché quell'aria c'è
 * (22° sul corpo femminile più largo che i cursori fanno).
 *
 * Scelta dell'utente del 2026-10-24: prima era la posa dell'esploratore — 12°, gomito piegato
 * di altri 14° oltre la piega di riposo di MakeHuman, braccio 4° in avanti, 4 cm d'aria —, che
 * dava braccia alzate e mani in avanti. **I capi da template si drappeggiano in questa posa**:
 * la maglietta del 23 ottobre era fatta per quella di prima.
 */
export const POSA = { gradi: 4, massimo: 30, spazio: 0.15, avanti: 0, gomito: 0 } as const

const rad = (g: number) => (g * Math.PI) / 180
const sottrai = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norma = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const croce = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// Quaternion.setFromUnitVectors di three, poi la sua matrice: la stessa rotazione dell'esploratore.
function daVersoAVerso(da: V3, a: V3): number[] {
  let r = da[0] * a[0] + da[1] * a[1] + da[2] * a[2] + 1
  let x: number, y: number, z: number
  if (r < Number.EPSILON) {
    r = 0
    if (Math.abs(da[0]) > Math.abs(da[2])) [x, y, z] = [-da[1], da[0], 0]
    else [x, y, z] = [0, -da[2], da[1]]
  } else {
    ;[x, y, z] = croce(da, a)
  }
  const l = Math.hypot(x, y, z, r)
  return matriceQuaternione(x / l, y / l, z / l, r / l)
}
function matriceQuaternione(x: number, y: number, z: number, w: number): number[] {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ]
}
const ruota = (r: number[], v: V3): V3 => [
  r[0] * v[0] + r[1] * v[1] + r[2] * v[2],
  r[3] * v[0] + r[4] * v[1] + r[5] * v[2],
  r[6] * v[0] + r[7] * v[1] + r[8] * v[2],
]
/** La rotazione `r` attorno al punto `c`. */
function attorno(r: number[], c: V3): Rigida {
  const rc = ruota(r, c)
  return { r, t: [c[0] - rc[0], c[1] - rc[1], c[2] - rc[2]] }
}
/** Prima `b`, poi `a`. */
function componi(a: Rigida, b: Rigida): Rigida {
  const r = new Array<number>(9)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a.r[i * 3] * b.r[j] + a.r[i * 3 + 1] * b.r[3 + j] + a.r[i * 3 + 2] * b.r[6 + j]
  const t = ruota(a.r, b.t)
  return { r, t: [t[0] + a.t[0], t[1] + a.t[1], t[2] + a.t[2]] }
}
const applica = (m: Rigida, v: V3): V3 => {
  const p = ruota(m.r, v)
  return [p[0] + m.t[0], p[1] + m.t[1], p[2] + m.t[2]]
}

function matriciBraccio(u: Umano, P: ArrayLike<number>, lato: 'l' | 'r', gradi: number) {
  const spalla = u.articolazione(`joint-${lato}-shoulder`, P)
  const gomito = u.articolazione(`joint-${lato}-elbow`, P)
  const polso = u.articolazione(`joint-${lato}-hand`, P)
  const segno = Math.sign(spalla[0]) || 1
  const t = rad(gradi)
  const verso = norma([segno * Math.sin(t), -Math.cos(t), Math.sin(rad(POSA.avanti))])
  const r1 = daVersoAVerso(norma(sottrai(gomito, spalla)), verso)
  const su = attorno(r1, spalla)
  const gomitoP = applica(su, gomito)
  const d2 = norma(ruota(r1, sottrai(polso, gomito)))
  // L'avambraccio si allinea al braccio, poi si piega in avanti di POSA.gomito. Non basta
  // ruotare il braccio: nella posa di riposo di MakeHuman il gomito è già piegato, e con il
  // solo braccio giù l'avambraccio restava inclinato di 40° in avanti.
  const avambraccio = norma([verso[0], verso[1], verso[2] + Math.tan(rad(POSA.gomito))])
  const r2 = daVersoAVerso(d2, avambraccio)
  return { su, giu: componi(attorno(r2, gomitoP), su) }
}

/** I pesi dello scheletro, solo per le ossa che la posa muove: il braccio («su») e tutto ciò che sta sotto il gomito («giù»). */
export interface Pelle {
  lati: Record<'l' | 'r', { su: Float32Array; giu: Float32Array }>
  mossi: Record<'l' | 'r', Uint32Array>
  avambraccio: Uint32Array
  busto: Uint32Array
  acc: Record<string, Record<'l' | 'r', { su: Float32Array; giu: Float32Array; mossi: Uint32Array }>>
}

export function preparaPelle(u: Umano): Pelle {
  const nv = u.nv
  const totale = new Float32Array(nv)
  for (const p of Object.values(u.pesi)) for (let j = 0; j < p.i.length; j++) totale[p.i[j]] += p.w[j]
  const padre: Record<string, string | null> = Object.fromEntries(u.ossa.map((o) => [o.nome, o.padre]))
  const sotto = (osso: string, antenato: string) => {
    for (let o: string | null = osso; o; o = padre[o] ?? null) if (o === antenato) return true
    return false
  }
  const lati = {
    l: { su: new Float32Array(nv), giu: new Float32Array(nv) },
    r: { su: new Float32Array(nv), giu: new Float32Array(nv) },
  }
  const dominante = new Float32Array(nv)
  const tipo = new Int8Array(nv) // 1 braccio, 2 avambraccio o mano, 0 il resto
  for (const [osso, p] of Object.entries(u.pesi)) {
    let lato: 'l' | 'r' | null = null
    let quale: 'su' | 'giu' | null = null
    for (const l of ['l', 'r'] as const) {
      if (osso === `upperarm_${l}`) {
        lato = l
        quale = 'su'
      } else if (sotto(osso, `lowerarm_${l}`)) {
        lato = l
        quale = 'giu'
      }
    }
    for (let j = 0; j < p.i.length; j++) {
      const v = p.i[j]
      const w = p.w[j] / (totale[v] || 1)
      if (lato && quale) lati[lato][quale][v] += w
      if (w > dominante[v]) {
        dominante[v] = w
        tipo[v] = lato ? (quale === 'su' ? 1 : 2) : 0
      }
    }
  }
  const mossiDi = (su: Float32Array, giu: Float32Array, n: number) => {
    const a: number[] = []
    for (let v = 0; v < n; v++) if (su[v] + giu[v] > 1e-4) a.push(v)
    return Uint32Array.from(a)
  }
  const nel = new Uint8Array(nv)
  for (const v of u.corpo.nel) nel[v] = 1
  const avambraccio: number[] = []
  const busto: number[] = []
  for (let v = 0; v < nv; v++) {
    if (!nel[v]) continue
    if (tipo[v] === 2) avambraccio.push(v)
    else if (tipo[v] === 0) busto.push(v)
  }
  // i pesi degli accessori vengono dai tre vertici del corpo a cui sono agganciati
  const acc: Pelle['acc'] = {}
  for (const [nome, a] of Object.entries(u.accessori)) {
    const perLato = {} as Pelle['acc'][string]
    for (const l of ['l', 'r'] as const) {
      const su = new Float32Array(a.nv)
      const giu = new Float32Array(a.nv)
      for (let i = 0; i < a.nv; i++)
        for (let k = 0; k < 3; k++) {
          const r = a.rif[i * 3 + k]
          const w = a.pesi[i * 3 + k]
          su[i] += w * lati[l].su[r]
          giu[i] += w * lati[l].giu[r]
        }
      perLato[l] = { su, giu, mossi: mossiDi(su, giu, a.nv) }
    }
    acc[nome] = perLato
  }
  return {
    lati,
    mossi: { l: mossiDi(lati.l.su, lati.l.giu, nv), r: mossiDi(lati.r.su, lati.r.giu, nv) },
    avambraccio: Uint32Array.from(avambraccio),
    busto: Uint32Array.from(busto),
    acc,
  }
}

function pelleggia(
  P: ArrayLike<number>,
  out: Float64Array,
  indici: ArrayLike<number>,
  su: Float32Array,
  giu: Float32Array,
  M: { su: Rigida; giu: Rigida },
) {
  for (let n = 0; n < indici.length; n++) {
    const v = indici[n]
    const p: V3 = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]
    const a = applica(M.su, p)
    const b = applica(M.giu, p)
    const ws = su[v]
    const wg = giu[v]
    for (let k = 0; k < 3; k++) out[v * 3 + k] = p[k] + ws * (a[k] - p[k]) + wg * (b[k] - p[k])
  }
}

/** L'angolo delle braccia: parte da POSA.gradi e sale finché avambraccio e mano stanno a POSA.spazio dal busto, fascia per fascia. */
export function angoloBraccia(u: Umano, P: ArrayLike<number>, pel: Pelle): number {
  const fascia = 0.2
  const massimi = new Map<number, number>()
  for (const v of pel.busto) {
    const x = P[v * 3]
    if (x <= 0) continue
    const b = Math.floor(P[v * 3 + 1] / fascia)
    const m = massimi.get(b)
    if (m === undefined || x > m) massimi.set(b, x)
  }
  const sinistra = Array.from(pel.avambraccio).filter((v) => P[v * 3] > 0)
  let gradi: number = POSA.gradi
  for (; gradi < POSA.massimo; gradi++) {
    const M = matriciBraccio(u, P, 'l', gradi)
    const minimi = new Map<number, number>()
    for (const v of sinistra) {
      const p: V3 = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]
      const a = applica(M.su, p)
      const b = applica(M.giu, p)
      const ws = pel.lati.l.su[v]
      const wg = pel.lati.l.giu[v]
      const xp = p[0] + ws * (a[0] - p[0]) + wg * (b[0] - p[0])
      const yp = p[1] + ws * (a[1] - p[1]) + wg * (b[1] - p[1])
      const fb = Math.floor(yp / fascia)
      const m = minimi.get(fb)
      if (m === undefined || xp < m) minimi.set(fb, xp)
    }
    let spazio = Infinity
    for (const [fb, x] of minimi) {
      const m = massimi.get(fb)
      if (m !== undefined) spazio = Math.min(spazio, x - m)
    }
    if (spazio >= POSA.spazio) break
  }
  return gradi
}

// ── il conto intero ─────────────────────────────────────────────────────────

/** Il corpo in posa, pronto da disegnare: posizioni per vertice, in decimetri, piedi a terra. */
export interface Vestito {
  corpo: Float64Array
  accessori: Record<string, Float64Array>
  /** Quanto si alza tutto perché i piedi tocchino terra, in decimetri. */
  dy: number
  altezzaCm: number
  gradiBraccia: number
}

/** Forma, accessori, posa: tutto quello che serve a disegnare uno stato. */
export function calcola(u: Umano, pel: Pelle, stato: StatoMH): Vestito {
  const P = u.forma(stato)
  const forme: Record<string, Float64Array> = {}
  for (const nome of Object.keys(u.accessori)) forme[nome] = u.adatta(nome, P)
  const gradi = angoloBraccia(u, P, pel)
  const M = { l: matriciBraccio(u, P, 'l', gradi), r: matriciBraccio(u, P, 'r', gradi) }
  const corpo = Float64Array.from(P)
  for (const l of ['l', 'r'] as const) pelleggia(P, corpo, pel.mossi[l], pel.lati[l].su, pel.lati[l].giu, M[l])
  const accessori: Record<string, Float64Array> = {}
  for (const [nome, forma] of Object.entries(forme)) {
    const posa = Float64Array.from(forma)
    for (const l of ['l', 'r'] as const) {
      const w = pel.acc[nome][l]
      pelleggia(forma, posa, w.mossi, w.su, w.giu, M[l])
    }
    accessori[nome] = posa
  }
  let minY = Infinity
  for (const v of u.corpo.nel) minY = Math.min(minY, corpo[v * 3 + 1])
  return { corpo, accessori, dy: -minY, altezzaCm: u.altezzaCm(corpo), gradiBraccia: gradi }
}

/**
 * Lo stato di MakeHuman di un avatar salvato: i cursori che valgono per il suo corpo, e la
 * macro dell'altezza cercata da `Misure.altezza_cm` (o quella media, se non c'è).
 */
export function statoDi(
  u: Umano,
  cursori: Record<string, number>,
  altezzaCm: number | null | undefined,
): { stato: StatoMH; altezza: ReturnType<typeof macroAltezza> | null } {
  const stato: StatoMH = { macro: {}, cursori: {} }
  for (const c of cursoriPer(u.corpoBase)) {
    const salvato = cursori[c.nome]
    if (salvato === undefined || !Number.isFinite(salvato)) continue
    // Il database accetta da −1 a +1 per tutti i cursori, ma una macro va da 0 a 1: un
    // `weight` negativo, scritto a mano su PostgREST, esce dalle parti di MakeHuman e fa
    // sparire tutta la pila delle macro. Si ferma all'estremo dei suoi livelli.
    const v = Math.min(Math.max(salvato, Math.min(...c.livelli)), Math.max(...c.livelli))
    if (c.tipo === 'macro') stato.macro[c.nome] = v
    else stato.cursori[c.nome] = v
  }
  if (altezzaCm == null) return { stato: { ...stato, macro: { ...stato.macro, height: 0.5 } }, altezza: null }
  const altezza = macroAltezza(u, stato, altezzaCm)
  return { stato: { ...stato, macro: { ...stato.macro, height: altezza.valore } }, altezza }
}

/** Le normali per vertice di una mesh disegnata: la media delle facce attorno, come fa `computeVertexNormals`. */
export function normali(pos: ArrayLike<number>, origine: Uint32Array, tri: Uint32Array, out: Float32Array) {
  let massimo = 0
  for (let r = 0; r < origine.length; r++) if (origine[r] > massimo) massimo = origine[r]
  const accum = new Float64Array((massimo + 1) * 3)
  for (let t = 0; t < tri.length; t += 3) {
    const i0 = origine[tri[t]]
    const i1 = origine[tri[t + 1]]
    const i2 = origine[tri[t + 2]]
    const ax = pos[i1 * 3] - pos[i0 * 3]
    const ay = pos[i1 * 3 + 1] - pos[i0 * 3 + 1]
    const az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2]
    const bx = pos[i2 * 3] - pos[i0 * 3]
    const by = pos[i2 * 3 + 1] - pos[i0 * 3 + 1]
    const bz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2]
    const cx = ay * bz - az * by
    const cy = az * bx - ax * bz
    const cz = ax * by - ay * bx
    for (const i of [i0, i1, i2]) {
      accum[i * 3] += cx
      accum[i * 3 + 1] += cy
      accum[i * 3 + 2] += cz
    }
  }
  for (let r = 0; r < origine.length; r++) {
    const i = origine[r]
    const x = accum[i * 3]
    const y = accum[i * 3 + 1]
    const z = accum[i * 3 + 2]
    const l = Math.hypot(x, y, z) || 1
    out[r * 3] = x / l
    out[r * 3 + 1] = y / l
    out[r * 3 + 2] = z / l
  }
}
