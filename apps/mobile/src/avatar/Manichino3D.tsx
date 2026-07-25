/**
 * Il manichino 3D, portato da `mannequin.js` del design a react-three-fiber.
 *
 * Le proporzioni, le posizioni e le luci sono quelle del file originale: il
 * design è stato disegnato su quella figura, e cambiarla cambierebbe il
 * prodotto. Ciò che cambia è la forma del codice — da imperativa a dichiarativa
 * — e il fatto che gira anche su iOS e Android, dove il canvas WebGL arriva da
 * expo-gl.
 *
 * Il capo non è una fotografia: è un colore. Ogni pezzo di stoffa è una
 * primitiva tinta con l'esadecimale che il modello di visione ha letto dalla
 * foto. È il motivo per cui l'analisi delle foto pretende `colore.hex` e lo
 * rifiuta se incerto.
 */

import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import type { Group } from 'three'
import type { PropsRenderer } from './renderer'

const PELLE = '#D6D2CE'

/** Quanto ruota da sola quando nessuno la tocca, in radianti al secondo. */
const ROTAZIONE_A_RIPOSO = 0.22
/** Secondi di immobilità prima che riprenda a girare. */
const ATTESA_PRIMA_DI_GIRARE = 2

interface Trascinamento {
  rotazione: number
  velocita: number
  fermoDa: number
  attivo: boolean
}

function Figura({ colori, trascinamento }: { colori: PropsRenderer['colori']; trascinamento: React.RefObject<Trascinamento> }) {
  const gruppo = useRef<Group>(null)

  useFrame((_stato, delta) => {
    const t = trascinamento.current
    if (!gruppo.current || !t) return

    if (!t.attivo) {
      t.fermoDa += delta
      // L'inerzia si spegne, e dopo un po' riparte la rotazione lenta: è quello
      // che invita a girare il manichino senza scrivere «trascina per girare».
      t.velocita *= 0.9
      t.rotazione += t.velocita + (t.fermoDa > ATTESA_PRIMA_DI_GIRARE ? ROTAZIONE_A_RIPOSO * delta : 0)
    }
    gruppo.current.rotation.y = t.rotazione
  })

  const stoffa = (tinta: string) => (
    <meshStandardMaterial color={tinta} roughness={0.78} metalness={0} side={2} />
  )
  const pelle = <meshStandardMaterial color={PELLE} roughness={0.92} metalness={0} />

  const abito = colori.dress
  const sopra = abito ? null : colori.top
  const sotto = abito ? null : colori.bottom

  return (
    <group ref={gruppo}>
      {/* ── corpo ─────────────────────────────────────────────────────── */}
      <mesh position={[0, 1.76, 0]} scale={[1, 1.12, 1.02]}>
        <sphereGeometry args={[0.115, 32, 24]} />
        {pelle}
      </mesh>
      <mesh position={[0, 1.635, 0]}>
        <cylinderGeometry args={[0.05, 0.058, 0.11, 20]} />
        {pelle}
      </mesh>
      <mesh position={[0, 1.36, 0]} scale={[1, 1, 0.62]}>
        <cylinderGeometry args={[0.152, 0.2, 0.46, 28]} />
        {pelle}
      </mesh>
      {[-0.185, 0.185].map((x) => (
        <mesh key={`spalla${x}`} position={[x, 1.555, 0]}>
          <sphereGeometry args={[0.088, 20, 16]} />
          {pelle}
        </mesh>
      ))}
      <mesh position={[0, 1.0, 0]} scale={[1, 1, 0.7]}>
        <cylinderGeometry args={[0.17, 0.15, 0.24, 28]} />
        {pelle}
      </mesh>
      {[-1, 1].map((lato) => (
        <mesh key={`braccio${lato}`} position={[0.242 * lato, 1.28, 0]} rotation={[0, 0, -0.07 * lato]}>
          <capsuleGeometry args={[0.052, 0.5, 8, 16]} />
          {pelle}
        </mesh>
      ))}
      {[-0.105, 0.105].map((x) => (
        <mesh key={`gamba${x}`} position={[x, 0.5, 0]}>
          <capsuleGeometry args={[0.09, 0.66, 8, 20]} />
          {pelle}
        </mesh>
      ))}
      {[-0.105, 0.105].map((x) => (
        <mesh key={`piede${x}`} position={[x, 0.035, 0.045]}>
          <boxGeometry args={[0.1, 0.07, 0.24]} />
          {pelle}
        </mesh>
      ))}

      {/* ── sopra ─────────────────────────────────────────────────────── */}
      {sopra ? (
        <>
          <mesh position={[0, 1.35, 0]} scale={[1, 1, 0.65]}>
            <cylinderGeometry args={[0.168, 0.216, 0.5, 28]} />
            {stoffa(sopra)}
          </mesh>
          {[-1, 1].map((lato) => (
            <mesh key={`manica${lato}`} position={[0.243 * lato, 1.45, 0]} rotation={[0, 0, -0.07 * lato]}>
              <capsuleGeometry args={[0.066, 0.16, 6, 16]} />
              {stoffa(sopra)}
            </mesh>
          ))}
        </>
      ) : null}

      {/* ── sotto ─────────────────────────────────────────────────────── */}
      {sotto ? (
        <>
          <mesh position={[0, 0.99, 0]} scale={[1, 1, 0.74]}>
            <cylinderGeometry args={[0.185, 0.168, 0.28, 28]} />
            {stoffa(sotto)}
          </mesh>
          {[-0.105, 0.105].map((x) => (
            <mesh key={`pantalone${x}`} position={[x, 0.53, 0]}>
              <capsuleGeometry args={[0.104, 0.6, 8, 20]} />
              {stoffa(sotto)}
            </mesh>
          ))}
        </>
      ) : null}

      {/* ── abito: sostituisce sopra e sotto ──────────────────────────── */}
      {abito ? (
        <>
          <mesh position={[0, 1.17, 0]} scale={[1, 1, 0.72]}>
            <cylinderGeometry args={[0.19, 0.33, 0.86, 32, 1, true]} />
            {stoffa(abito)}
          </mesh>
          <mesh position={[0, 1.35, 0]} scale={[1, 1, 0.65]}>
            <cylinderGeometry args={[0.168, 0.216, 0.5, 28]} />
            {stoffa(abito)}
          </mesh>
        </>
      ) : null}

      {/* ── fuori: cilindro aperto davanti, come una giacca sbottonata ── */}
      {colori.outer ? (
        <>
          <mesh position={[0, 1.3, 0]} scale={[1, 1, 0.72]}>
            <cylinderGeometry args={[0.2, 0.252, 0.62, 32, 1, true, 0.55, Math.PI * 2 - 1.1]} />
            {stoffa(colori.outer)}
          </mesh>
          {[-1, 1].map((lato) => (
            <mesh key={`manicaFuori${lato}`} position={[0.252 * lato, 1.31, 0]} rotation={[0, 0, -0.07 * lato]}>
              <capsuleGeometry args={[0.075, 0.42, 6, 16]} />
              {stoffa(colori.outer!)}
            </mesh>
          ))}
        </>
      ) : null}

      {/* ── scarpe ────────────────────────────────────────────────────── */}
      {colori.shoes
        ? [-0.105, 0.105].map((x) => (
            <mesh key={`scarpa${x}`} position={[x, 0.05, 0.05]}>
              <boxGeometry args={[0.118, 0.1, 0.29]} />
              {stoffa(colori.shoes!)}
            </mesh>
          ))
        : null}
    </group>
  )
}

export function Manichino3D({ colori, onNonDisponibile }: PropsRenderer) {
  const [caduto, setCaduto] = useState(false)
  const trascinamento = useRef<Trascinamento>({
    rotazione: 0,
    velocita: 0,
    fermoDa: 0,
    attivo: false,
  })

  const gesti = useMemo(
    () =>
      PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        trascinamento.current.attivo = true
        trascinamento.current.fermoDa = 0
      },
      onPanResponderMove: (_evento, stato) => {
        // 0.012 radianti per pixel: lo stesso rapporto del design, tarato per
        // far compiere un giro completo con una spazzata di pollice.
        const passo = stato.dx * 0.012
        trascinamento.current.rotazione += passo - trascinamento.current.velocita
        trascinamento.current.velocita = passo
      },
      onPanResponderRelease: () => {
        trascinamento.current.attivo = false
        trascinamento.current.fermoDa = 0
      },
      onPanResponderTerminate: () => {
        trascinamento.current.attivo = false
      },
      }),
    [],
  )

  if (caduto) return null

  return (
    <View style={{ flex: 1 }} {...gesti.panHandlers}>
      <Canvas
        camera={{ fov: 30, position: [0, 1.05, 4.6], near: 0.1, far: 100 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}
        // Se WebGL non parte — vecchio dispositivo, emulatore senza
        // accelerazione — non lasciamo un rettangolo nero: lo diciamo e la
        // schermata passa al manichino piatto.
        fallback={null}
        gl={{ antialias: true, alpha: true }}
        onError={() => {
          setCaduto(true)
          onNonDisponibile?.('WebGL non disponibile su questo dispositivo')
        }}
      >
        <hemisphereLight args={['#ffffff', '#d8d4d0', 0.85]} />
        <directionalLight position={[1.6, 3.2, 2.4]} intensity={0.9} />
        <directionalLight position={[-2.2, 1.6, -1.8]} intensity={0.35} />
        <Figura colori={colori} trascinamento={trascinamento} />
      </Canvas>
    </View>
  )
}
