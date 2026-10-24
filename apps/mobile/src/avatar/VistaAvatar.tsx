/**
 * La vista dell'avatar: il contesto WebGL di `expo-gl`, la scena di `scena.ts`, e il dito che
 * la gira.
 *
 * Disegna **solo quando qualcosa cambia** — un corpo nuovo, una tinta, un giro di dito — e non
 * in un ciclo continuo: un avatar fermo non deve scaldare il telefono.
 *
 * Si carica con `import()` dalla schermata, non con un import in testa: `three` è grande, e i
 * test che arrivano alla barra delle schede non devono tirarselo dietro.
 */

import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl'
import { useEffect, useRef, useState } from 'react'
import { PixelRatio, View } from 'react-native'
import type * as THREE from 'three'
import { Errore } from '../ui/stati'
import type { Umano, Vestito } from './motore'
import { rendererPer, ScenaAvatar, type Tinte } from './scena'

interface Props {
  umano: Umano
  vestito: Vestito
  tinte: Tinte
  altezza: number
}

/** Tre quarti, verso destra: un corpo visto di fronte appiattisce le spalle e i fianchi. */
const ANGOLO_INIZIALE = 0.45
/** Radianti per punto di trascinamento: mezzo giro con una passata lungo lo schermo. */
const GIRO_PER_PUNTO = 0.009

export default function VistaAvatar({ umano, vestito, tinte, altezza }: Props) {
  const stato = useRef<{ gl: ExpoWebGLRenderingContext; renderer: THREE.WebGLRenderer; scena: ScenaAvatar } | null>(
    null,
  )
  const angolo = useRef(ANGOLO_INIZIALE)
  const inCoda = useRef(false)
  // Gli ultimi valori, letti da `onContextCreate`: il contesto può nascere dopo che le props
  // sono già cambiate, e allora la scena deve partire da quelle, non dalle prime.
  const ultime = useRef({ vestito, tinte })
  useEffect(() => {
    ultime.current = { vestito, tinte }
  })

  const disegna = () => {
    if (inCoda.current) return
    inCoda.current = true
    requestAnimationFrame(() => {
      inCoda.current = false
      const s = stato.current
      if (!s) return
      s.renderer.render(s.scena.scena, s.scena.camera)
      s.gl.endFrameEXP()
    })
  }

  const [rotto, setRotto] = useState(false)
  const alContesto = (gl: ExpoWebGLRenderingContext) => {
    // `three` su `expo-gl` non è mai stato provato su un telefono: se qui qualcosa solleva,
    // dentro una callback nativa sarebbe un errore fatale. Meglio una scheda che lo dice.
    try {
      const densita = PixelRatio.get()
      const renderer = rendererPer(gl, gl.drawingBufferWidth, gl.drawingBufferHeight, densita)
      const scena = new ScenaAvatar(umano, ultime.current.tinte)
      scena.misura(gl.drawingBufferWidth, gl.drawingBufferHeight)
      scena.aggiorna(ultime.current.vestito)
      scena.ruota(angolo.current)
      stato.current = { gl, renderer, scena }
      disegna()
    } catch (e) {
      console.error('La vista dell’avatar non parte:', e)
      setRotto(true)
    }
  }

  useEffect(() => {
    stato.current?.scena.aggiorna(vestito)
    disegna()
  }, [vestito])

  useEffect(() => {
    stato.current?.scena.tingi(tinte)
    disegna()
  }, [tinte])

  useEffect(
    () => () => {
      stato.current?.scena.dispose()
      stato.current?.renderer.dispose()
      stato.current = null
    },
    [],
  )

  // Il dito: dove si è posato, e a che angolo era il corpo in quel momento.
  const inizio = useRef({ x: 0, y: 0, angolo: ANGOLO_INIZIALE })

  return (
    <View
      // I gestori di risposta della `View`, non un `PanResponder`: leggono i ref solo dentro
      // gli eventi. Il corpo si prende il dito solo in orizzontale — in verticale il dito sta
      // scorrendo la pagina, e la pagina vince.
      // Il punto di partenza si prende qui e non con `onTouchStart`: sul web il mouse non
      // genera eventi touch, mentre il sistema dei responder li vede tutti e due. `false`:
      // il gesto non si prende ancora, lo decide `onMoveShouldSetResponder`.
      onStartShouldSetResponder={(e) => {
        inizio.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, angolo: angolo.current }
        return false
      }}
      onMoveShouldSetResponder={(e) => {
        const dx = e.nativeEvent.pageX - inizio.current.x
        const dy = e.nativeEvent.pageY - inizio.current.y
        return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5
      }}
      onResponderMove={(e) => {
        angolo.current = inizio.current.angolo + (e.nativeEvent.pageX - inizio.current.x) * GIRO_PER_PUNTO
        stato.current?.scena.ruota(angolo.current)
        disegna()
      }}
      onResponderTerminationRequest={() => false}
      style={{ height: altezza, alignSelf: 'stretch' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Il tuo avatar. Trascina in orizzontale per girarlo."
    >
      {rotto ? (
        <Errore
          titolo="Non riesco a disegnare l’avatar"
          spiegazione="Il corpo è pronto, ma questo telefono non lo sa ancora mostrare."
        />
      ) : (
        <GLView style={{ flex: 1 }} onContextCreate={alContesto} />
      )}
    </View>
  )
}
