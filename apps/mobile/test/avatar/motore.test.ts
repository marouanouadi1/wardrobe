/**
 * Il motore dell'avatar fa lo stesso conto di MakeHuman?
 *
 * `riferimento.json` l'ha scritto MPFB vero, dentro Blender (`tools/avatar/riferimento.py`):
 * sei corpi, donna e uomo, con i soli cursori dell'app ai loro livelli. Qui il motore rifà gli
 * stessi corpi dai pacchetti che l'app spedisce, e i vertici devono coincidere. Lo scarto atteso
 * è la quantizzazione dei target (passi di 0,02 mm): un target sbagliato, una soglia diversa o
 * un'esclusione dimenticata spostano vertici di millimetri o centimetri.
 *
 * Se un pacchetto si rigenera con un elenco di cursori diverso, il riferimento si rigenera con
 * lui: i due script leggono lo stesso `cursori.ts`.
 */

import { VALORI_CORPO_BASE, type CorpoBase } from '@wardrobe/contracts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cursoriPer } from '../../src/avatar/cursori'
import { calcola, leggiPacco, macroAltezza, POSA, preparaPelle, statoDi, Umano, type StatoMH } from '../../src/avatar/motore'

interface Riferimento {
  corpo: CorpoBase
  altezza: number
  cursori: Record<string, number>
  corpo_campione: { indici: number[]; posizioni: number[] }
  strato_campione: { indici: number[]; posizioni: number[] }
}

const ASSET = join(__dirname, '..', '..', 'assets', 'avatar')
const pacco = (nome: string) => {
  const b = readFileSync(join(ASSET, nome))
  return leggiPacco(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
}
const comune = pacco('comune.bin')
const umani = Object.fromEntries(
  VALORI_CORPO_BASE.map((corpo) => [corpo, new Umano(corpo, comune, pacco(`${corpo}.bin`))]),
) as Record<CorpoBase, Umano>
const riferimenti = JSON.parse(readFileSync(join(__dirname, 'riferimento.json'), 'utf8')) as Riferimento[]

function statoMH(u: Umano, cursori: Record<string, number>, altezza: number): StatoMH {
  const stato: StatoMH = { macro: { height: altezza }, cursori: {} }
  for (const c of cursoriPer(u.corpoBase)) {
    if (cursori[c.nome] === undefined) continue
    if (c.tipo === 'macro') stato.macro[c.nome] = cursori[c.nome]
    else stato.cursori[c.nome] = cursori[c.nome]
  }
  return stato
}

const sottrai3 = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norma3 = (a: number[]) => a.map((x) => x / Math.hypot(a[0], a[1], a[2]))
const gradiFra = (a: number[], b: number[]) =>
  (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI

function scartoMassimo(calcolate: ArrayLike<number>, campione: Riferimento['corpo_campione']): number {
  let massimo = 0
  campione.indici.forEach((v, n) => {
    for (let k = 0; k < 3; k++) massimo = Math.max(massimo, Math.abs(calcolate[v * 3 + k] - campione.posizioni[n * 3 + k]))
  })
  return massimo
}

// 0,05 mm, in decimetri: cinque volte lo scarto misurato dall'esploratore (0,011 mm).
const TOLLERANZA_DM = 0.0005

describe('il motore rifà il conto di MPFB', () => {
  test.each(riferimenti.map((r) => [`${r.corpo}, ${Object.keys(r.cursori).length} cursori, altezza ${r.altezza}`, r]))(
    '%s',
    (_, r) => {
      const u = umani[r.corpo]
      const P = u.forma(statoMH(u, r.cursori, r.altezza))

      expect(scartoMassimo(P, r.corpo_campione)).toBeLessThan(TOLLERANZA_DM)
      expect(scartoMassimo(u.adatta('Strato', P), r.strato_campione)).toBeLessThan(TOLLERANZA_DM)
    },
  )

  test('il riferimento non è banale: ogni cursore dell’app è mosso, per ogni corpo che lo usa', () => {
    // Se il riferimento si rigenera con stati troppo poveri, il test sopra diventa verde per
    // niente. Ogni cursore dell'elenco deve comparire, mosso, in almeno uno stato di ciascun
    // corpo per cui vale (`riferimento.py` lo garantisce).
    const mancanti = VALORI_CORPO_BASE.flatMap((corpo) => {
      const mossi = new Set(riferimenti.filter((r) => r.corpo === corpo).flatMap((r) => Object.keys(r.cursori)))
      return cursoriPer(corpo)
        .filter((c) => !mossi.has(c.nome))
        .map((c) => `${corpo}: ${c.nome}`)
    })
    expect(mancanti).toEqual([])
  })
})

describe('i pacchetti bastano a ogni stato che l’app può chiedere', () => {
  test.each([...VALORI_CORPO_BASE])('%s: ogni cursore a ogni estremo, con l’altezza agli estremi', (corpo) => {
    const u = umani[corpo]
    const pel = preparaPelle(u)
    for (const altezza of [0, 1]) {
      for (const estremo of [0, -1] as const) {
        const cursori = Object.fromEntries(cursoriPer(corpo).map((c) => [c.nome, c.livelli.at(estremo)!]))
        // Un target che il pacchetto non ha fa sollevare `aggiungiTarget`: non diventa uno zero.
        expect(() => calcola(u, pel, statoMH(u, cursori, altezza))).not.toThrow()
      }
    }
  })
})

describe('un profilo scritto a mano non svuota il corpo', () => {
  test('una macro fuori dai suoi livelli si ferma all’estremo', () => {
    // Il database accetta −1…+1 per tutti i cursori; una macro va da 0 a 1. Un `weight`
    // negativo, scritto direttamente su PostgREST, faceva sparire tutta la pila delle macro.
    const u = umani.donna
    const fuori = statoDi(u, { weight: -0.5, muscle: 0.5 }, null).stato
    const zero = statoDi(u, { weight: 0, muscle: 0.5 }, null).stato
    expect(fuori).toEqual(zero)
    expect(u.pila(fuori).length).toBeGreaterThan(3)
  })
})

describe('l’altezza viene da Misure', () => {
  test.each([...VALORI_CORPO_BASE])('%s: si raggiunge al millimetro dentro l’intervallo', (corpo) => {
    const u = umani[corpo]
    const stato = statoMH(u, { weight: 0.75, 'upperlegs-height-decr-incr': 0.5 }, 0.5)
    const { minimo, massimo } = macroAltezza(u, stato, 170)
    const voluto = Math.round((minimo + massimo) / 2)
    const trovato = macroAltezza(u, stato, voluto)

    expect(Math.abs(trovato.raggiunta - voluto)).toBeLessThan(0.1)
    // e il corpo calcolato davvero, con quella macro, è alto così
    const P = u.forma({ ...stato, macro: { ...stato.macro, height: trovato.valore } })
    expect(Math.abs(u.altezzaCm(P) - voluto)).toBeLessThan(0.1)
  })

  test('fuori dall’intervallo si ferma all’estremo, e lo dice', () => {
    // Il corpo femminile di MakeHuman va da 123 a 229 cm circa: `Misure` accetta da 120 a 230.
    const u = umani.donna
    const stato = statoMH(u, {}, 0.5)
    const basso = macroAltezza(u, stato, 120)
    const alto = macroAltezza(u, stato, 230)

    expect(basso.valore).toBe(0)
    expect(basso.raggiunta).toBe(basso.minimo)
    expect(alto.valore).toBe(1)
    expect(alto.raggiunta).toBe(alto.massimo)
  })
})

describe('la posa', () => {
  test.each([...VALORI_CORPO_BASE])('%s: braccia giù, ai due lati uguali, piedi a terra', (corpo) => {
    const u = umani[corpo]
    const v = calcola(u, preparaPelle(u), statoMH(u, {}, 0.5))
    const polso = (lato: 'l' | 'r') => u.articolazione(`joint-${lato}-hand`, v.corpo)
    const spalla = (lato: 'l' | 'r') => u.articolazione(`joint-${lato}-shoulder`, v.corpo)

    expect(v.gradiBraccia).toBeGreaterThanOrEqual(POSA.gradi)
    expect(v.gradiBraccia).toBeLessThan(POSA.massimo)
    for (const lato of ['l', 'r'] as const) expect(polso(lato)[1]).toBeLessThan(spalla(lato)[1] - 3)
    // distese, come le ha chieste l'utente: il braccio dritto (l'avambraccio prosegue il braccio
    // invece di restare piegato in avanti come nella posa di riposo di MakeHuman), e lungo il
    // corpo — il polso entro 15° dalla verticale della spalla
    const gomito = u.articolazione('joint-l-elbow', v.corpo)
    const su = norma3(sottrai3(gomito, spalla('l')))
    const giu = norma3(sottrai3(polso('l'), gomito))
    expect(gradiFra(su, giu)).toBeLessThan(POSA.gomito + 3)
    const sp = spalla('l')
    const po = polso('l')
    expect((Math.atan2(Math.hypot(po[0] - sp[0], po[2] - sp[2]), sp[1] - po[1]) * 180) / Math.PI).toBeLessThan(15)
    // la posa è simmetrica: i due polsi alla stessa quota e alla stessa distanza dall'asse
    expect(Math.abs(polso('l')[1] - polso('r')[1])).toBeLessThan(0.01)
    expect(Math.abs(Math.abs(polso('l')[0]) - Math.abs(polso('r')[0]))).toBeLessThan(0.01)
    // anche lo strato neutro: la manica segue il braccio da entrambi i lati
    const manica = (segno: number) => {
      let y = Infinity
      const s = v.accessori.Strato
      for (let i = 0; i < s.length / 3; i++) if (Math.sign(s[i * 3]) === segno && Math.abs(s[i * 3]) > 1.6) y = Math.min(y, s[i * 3 + 1])
      return y
    }
    expect(Math.abs(manica(1) - manica(-1))).toBeLessThan(0.05)
    let minY = Infinity
    for (const i of u.corpo.nel) minY = Math.min(minY, v.corpo[i * 3 + 1] + v.dy)
    expect(minY).toBeCloseTo(0, 6)
  })
})
