/**
 * La scena dell'avatar: il corpo calcolato da `motore.ts` messo in geometrie `three`, con le
 * sue luci e la sua inquadratura.
 *
 * **Niente React Native qui dentro**: il contesto WebGL lo passa chi monta la vista
 * (`VistaAvatar.tsx` con `expo-gl`), e la pagina di revisione dei cursori usa questo stesso
 * file in un browser. I colori arrivano da fuori (`Tinte`), così questo file non ne compone.
 *
 * Solo `three` e nient'altro della sua famiglia: niente `@react-three/fiber`, che sul nativo
 * caricava una seconda istanza di `three` (`T-35`, chiusa con il banco che la usava).
 */

import * as THREE from 'three'
import { normali, type Umano, type Vestito } from './motore'

export interface Tinte {
  pelle: string
  capelli: string
  tela: string
  cielo: string
  terra: string
  chiave: string
  taglio: string
  riempimento: string
  ombra: string
}

interface Parte {
  geo: THREE.BufferGeometry
  mesh: THREE.Mesh
  origine: Uint32Array
  triangoli: Uint32Array
}

/** Sopracciglia e ciglia prendono il colore dei capelli, più scuro. */
const SCURITA_PELI = 0.55

export class ScenaAvatar {
  readonly scena = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(24, 1, 0.05, 30)
  private readonly perno = new THREE.Group()
  private readonly corpo: Parte
  private readonly parti: Record<string, Parte> = {}
  private readonly materiali: {
    pelle: THREE.MeshStandardMaterial
    tela: THREE.MeshStandardMaterial
    capelli: THREE.MeshStandardMaterial
    peli: THREE.MeshStandardMaterial[]
  }
  private readonly luci: { cielo: THREE.HemisphereLight; chiave: THREE.DirectionalLight; taglio: THREE.DirectionalLight; riempimento: THREE.DirectionalLight }
  private readonly ombra: THREE.Mesh
  private altezza = 1.7
  private larghezza = 1
  private alto = 1

  constructor(
    private readonly u: Umano,
    tinte: Tinte,
  ) {
    this.scena.add(this.perno)
    const pelle = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 })
    const tela = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide })
    const capelli = new THREE.MeshStandardMaterial({
      map: this.texture('Capelli'),
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.68,
    })
    const peli = ['Sopracciglia', 'Ciglia'].map(
      (nome) =>
        new THREE.MeshStandardMaterial({
          map: this.texture(nome),
          transparent: true,
          alphaTest: 0.25,
          depthWrite: false,
          side: THREE.DoubleSide,
          roughness: 0.8,
        }),
    )
    const occhi = new THREE.MeshStandardMaterial({ map: this.texture('Occhi'), roughness: 0.2, metalness: 0 })
    this.materiali = { pelle, tela, capelli, peli }

    // Il corpo senza la pelle che lo strato neutro copre per intero: sotto una stoffa aderente
    // la pelle buca, e una faccia nascosta non si deve disegnare comunque.
    const coperti = new Uint8Array(u.nv)
    for (const v of u.accessori.Strato?.nasconde ?? []) coperti[v] = 1
    const { origine, triangoli, uv } = u.corpo
    const visibili: number[] = []
    for (let t = 0; t < triangoli.length; t += 3) {
      const tutti = coperti[origine[triangoli[t]]] && coperti[origine[triangoli[t + 1]]] && coperti[origine[triangoli[t + 2]]]
      if (!tutti) visibili.push(triangoli[t], triangoli[t + 1], triangoli[t + 2])
    }
    this.corpo = this.parte(origine, uv, triangoli, Uint32Array.from(visibili), pelle)

    const materialePer: Record<string, THREE.Material> = {
      Occhi: occhi,
      Sopracciglia: peli[0],
      Ciglia: peli[1],
      Capelli: capelli,
      Strato: tela,
    }
    for (const [nome, a] of Object.entries(u.accessori)) {
      const p = this.parte(a.origine, a.uv, a.triangoli, a.triangoli, materialePer[nome] ?? tela)
      if (nome === 'Sopracciglia' || nome === 'Ciglia') p.mesh.renderOrder = 2
      this.parti[nome] = p
    }

    // I colori li dà `tingi()`, qui sotto: qui solo le intensità.
    this.luci = {
      cielo: new THREE.HemisphereLight(undefined, undefined, 1.25),
      chiave: new THREE.DirectionalLight(undefined, 1.9),
      taglio: new THREE.DirectionalLight(undefined, 1.1),
      riempimento: new THREE.DirectionalLight(undefined, 0.45),
    }
    this.luci.chiave.position.set(2.2, 3.2, 3.4)
    this.luci.taglio.position.set(-2.6, 2.2, -2.8)
    this.luci.riempimento.position.set(-3, 1, 2)
    for (const l of Object.values(this.luci)) this.scena.add(l)

    this.ombra = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.8),
      new THREE.MeshBasicMaterial({ map: alone(), transparent: true, depthWrite: false }),
    )
    this.ombra.rotation.x = -Math.PI / 2
    this.ombra.position.y = 0.002
    this.scena.add(this.ombra)
    this.tingi(tinte)
  }

  private texture(nome: string): THREE.DataTexture | null {
    const t = this.u.tex[nome]
    if (!t) return null
    const tex = new THREE.DataTexture(t.rgba, t.w, t.h, THREE.RGBAFormat)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.needsUpdate = true
    return tex
  }

  private parte(origine: Uint32Array, uv: Float32Array, tutti: Uint32Array, indice: Uint32Array, mat: THREE.Material): Parte {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(origine.length * 3), 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(origine.length * 3), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2))
    geo.setIndex(new THREE.BufferAttribute(indice, 1))
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    this.perno.add(mesh)
    return { geo, mesh, origine, triangoli: tutti }
  }

  private scrivi(p: Parte, pos: Float64Array, dy: number) {
    const arr = p.geo.attributes.position.array as Float32Array
    const o = p.origine
    for (let r = 0; r < o.length; r++) {
      const i = o[r]
      arr[r * 3] = pos[i * 3] * 0.1
      arr[r * 3 + 1] = (pos[i * 3 + 1] + dy) * 0.1
      arr[r * 3 + 2] = pos[i * 3 + 2] * 0.1
    }
    normali(pos, o, p.triangoli, p.geo.attributes.normal.array as Float32Array)
    p.geo.attributes.position.needsUpdate = true
    p.geo.attributes.normal.needsUpdate = true
  }

  /** Mette nelle geometrie un corpo calcolato. */
  aggiorna(v: Vestito) {
    this.scrivi(this.corpo, v.corpo, v.dy)
    for (const [nome, pos] of Object.entries(v.accessori)) if (this.parti[nome]) this.scrivi(this.parti[nome], pos, v.dy)
    this.altezza = v.altezzaCm / 100
    this.inquadra()
  }

  tingi(t: Tinte) {
    this.materiali.pelle.color.set(t.pelle)
    this.materiali.tela.color.set(t.tela)
    this.materiali.capelli.color.set(t.capelli)
    const scuri = new THREE.Color(t.capelli).multiplyScalar(SCURITA_PELI)
    for (const m of this.materiali.peli) m.color.copy(scuri)
    this.luci.cielo.color.set(t.cielo)
    this.luci.cielo.groundColor.set(t.terra)
    this.luci.chiave.color.set(t.chiave)
    this.luci.taglio.color.set(t.taglio)
    this.luci.riempimento.color.set(t.riempimento)
    ;(this.ombra.material as THREE.MeshBasicMaterial).color.set(t.ombra)
  }

  /** Gira il corpo attorno al suo asse, in radianti. */
  ruota(angolo: number) {
    this.perno.rotation.y = angolo
  }

  /** La vista ha cambiato misura: l'inquadratura segue, il corpo resta intero. */
  misura(larghezza: number, alto: number) {
    this.larghezza = Math.max(1, larghezza)
    this.alto = Math.max(1, alto)
    this.inquadra()
  }

  // Il corpo intero in verticale, con un margine: la distanza è quella a cui metà altezza (più
  // il margine) riempie metà del campo verticale. Su una vista larga e bassa comanda l'altezza,
  // su una stretta e alta la larghezza delle braccia.
  private inquadra() {
    const aspetto = this.larghezza / this.alto
    this.camera.aspect = aspetto
    const meta = (this.altezza / 2) * 1.1
    const verticale = meta / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const orizzontale = 0.42 / (Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspetto)
    const distanza = Math.max(verticale, orizzontale)
    this.camera.position.set(0, this.altezza * 0.52, distanza)
    this.camera.lookAt(0, this.altezza * 0.5, 0)
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.scena.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const mat = o.material as THREE.MeshStandardMaterial
        mat.map?.dispose()
        mat.dispose()
      }
    })
  }
}

/** L'ombra a terra: un alone radiale, fatto di pixel e non con un canvas, che sul nativo non c'è. */
function alone(): THREE.DataTexture {
  const lato = 64
  const dati = new Uint8Array(lato * lato * 4)
  for (let y = 0; y < lato; y++)
    for (let x = 0; x < lato; x++) {
      const d = Math.hypot(x - lato / 2 + 0.5, y - lato / 2 + 0.5) / (lato / 2)
      const i = (y * lato + x) * 4
      dati[i] = dati[i + 1] = dati[i + 2] = 255
      dati[i + 3] = Math.round(255 * 0.3 * Math.max(0, 1 - d) ** 1.6)
    }
  const t = new THREE.DataTexture(dati, lato, lato, THREE.RGBAFormat)
  t.needsUpdate = true
  return t
}

/** Il renderer di `three` su un contesto che arriva da fuori, come quelli di `expo-gl`. */
export function rendererPer(gl: WebGL2RenderingContext, larghezza: number, alto: number, densita: number): THREE.WebGLRenderer {
  // Sul web il contesto ha la sua tela; su `expo-gl` nativo no, e `three` ne vuole una a cui
  // chiedere misure e su cui (non) registrare eventi.
  const tela =
    typeof HTMLCanvasElement !== 'undefined' && gl.canvas instanceof HTMLCanvasElement
      ? gl.canvas
      : ({
          width: larghezza,
          height: alto,
          clientWidth: larghezza,
          clientHeight: alto,
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
          getContext: () => gl,
        } as unknown as HTMLCanvasElement)
  const renderer = new THREE.WebGLRenderer({ canvas: tela, context: gl, antialias: true, alpha: true })
  renderer.setPixelRatio(densita)
  renderer.setSize(larghezza / densita, alto / densita, false)
  renderer.setClearAlpha(0) // il fondo è quello della schermata
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  return renderer
}
