/**
 * Banco di prova: un corpo vero che indossa capi veri, non primitive tinte.
 *
 * È temporanea e sta sotto «Sviluppo» apposta. Serve a rispondere a una sola
 * domanda, che nessuna ricerca può chiudere: **expo-gl regge una SkinnedMesh da
 * 10.000 vertici su New Architecture, su un telefono vero?** Se la risposta è
 * sì, la strada di three in-process dentro Expo Go (zero manutenzione nativa)
 * resta aperta e non serve valutare altri motori.
 *
 * Gli asset in `assets/3d/` vengono da un avatar Avaturn generato da una foto.
 * I due capi non sono modellati: sono **ritagliati dal corpo stesso** e spinti
 * in fuori lungo la normale (vedi `tools/avatar-3d/genera_capi.py`). Questo
 * rende il weight transfer esatto invece che approssimato — i vertici del capo
 * *sono* vertici del corpo, quindi JOINTS_0 e WEIGHTS_0 si copiano invariati —
 * ed è il motivo per cui la maglietta aderisce senza compenetrare.
 *
 * I due capi sono la t-shirt verde e il bermuda beige che stanno davvero
 * nell'armadio, e portano la **loro stoffa**: la texture è la foto scontornata
 * dell'armadio, stesa sulla geometria da `tools/avatar-3d/vesti_da_foto.py`. È
 * il primo pezzo di `docs/adr/0004` che funziona — il capo non è più un colore.
 *
 * Il limite da conoscere: la proiezione è planare frontale, quindi fronte e
 * retro condividono la stessa regione di texture e il retro esce specchiato. Su
 * questi due capi (`"fantasia": "tinta unita"`) non si nota; su una stampa
 * asimmetrica servirebbe una mappatura che distingua i due lati.
 *
 * `vesti_da_foto.py` parte dalle versioni a tinta unita dei due capi (output di
 * `genera_capi.py`): sono intermedi rigenerabili, non stanno in `assets/3d/` —
 * solo le `-foto` finiscono nel bundle, ed è quelle che la schermata carica.
 */

import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'
import { Component, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { Loader, Skeleton, SRGBColorSpace, TextureLoader } from 'three'
import type { Bone, Group, Mesh, SkinnedMesh, Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { colori, raggi, spazi } from '../tema/tokens'
import { Toccabile } from '../ui/base'
import { Corpo, Etichetta } from '../ui/testo'
import { Testata } from '../ui/testata'

// Su native `require` di un asset restituisce un numero, non un percorso: è il
// modulo che @react-three/fiber/native passa a `Asset.fromModule`. I tipi di
// useLoader parlano solo di stringhe, da qui il cast. E `require` è l'unica
// forma che Metro riconosce per gli asset, quindi la regola va spenta qui.
/* eslint-disable @typescript-eslint/no-require-imports */
const asset = (modulo: number) => modulo as unknown as string

const AVATAR = asset(require('../../assets/3d/avatar.glb'))
const PELLE = asset(require('../../assets/3d/avatar-pelle.jpg'))
const MAGLIETTA = asset(require('../../assets/3d/maglietta-foto.glb'))
const MAGLIETTA_STOFFA = asset(require('../../assets/3d/maglietta-foto-texture.jpg'))
const PANTALONCINO = asset(require('../../assets/3d/pantaloncino-foto.glb'))
const PANTALONCINO_STOFFA = asset(require('../../assets/3d/pantaloncino-foto-texture.jpg'))
/* eslint-enable @typescript-eslint/no-require-imports */

const ROTAZIONE_A_RIPOSO = 0.22
const ATTESA_PRIMA_DI_GIRARE = 2

interface Trascinamento {
  rotazione: number
  velocita: number
  fermoDa: number
  attivo: boolean
}

/**
 * Legge un GLB da un asset del bundle e lo passa a `GLTFLoader.parse`.
 *
 * Serve perché il `GLTFLoader` normale, su native, finisce nel `FileLoader` che
 * @react-three/fiber sostituisce con una versione basata su
 * `FileSystem.readAsStringAsync`. Quell'API è la vecchia di expo-file-system, e
 * dall'SDK 54 non sta più nell'entry principale del pacchetto (è rimasta sotto
 * `expo-file-system/legacy`, cioè in via di uscita): la chiamata trova
 * `undefined` e la schermata muore con «undefined is not a function».
 *
 * Qui il file lo leggiamo noi, con l'API attuale, e a three arriva un
 * ArrayBuffer già pronto. `parse` non fa I/O — e non ne farebbe comunque, visto
 * che questi GLB non contengono immagini: le texture stanno in file a parte.
 *
 * `useLoader` vuole solo un oggetto con `load(input, onLoad, _, onError)`, che è
 * esattamente quanto basta per tenerci Suspense, cache e il riquadro d'errore.
 */
class CaricatoreGlb extends Loader<GLTF, string> {
  override load(
    modulo: string,
    onLoad: (gltf: GLTF) => void,
    _onProgress?: (evento: ProgressEvent) => void,
    onError?: (errore: unknown) => void,
  ): void {
    const leggi = async () => {
      const asset = await Asset.fromModule(modulo).downloadAsync()
      const percorso = asset.localUri ?? asset.uri
      const dati = await new File(percorso).arrayBuffer()
      new GLTFLoader().parse(dati, '', onLoad, (errore) => onError?.(errore))
    }
    leggi().catch((errore) => onError?.(errore))
  }
}

/**
 * Una texture pronta per una mesh glTF.
 *
 * Le immagini stanno fuori dai GLB, come file a parte: le texture embedded in
 * React Native falliscono con «Creating blobs from ArrayBuffer are not
 * supported» (react-three-fiber#3558).
 *
 * Torna una copia, non l'originale: il valore arriva da un hook e la cache del
 * loader lo condivide con chiunque altro lo chieda.
 */
function useTexturaGltf(modulo: string): Texture {
  const caricata = useLoader(TextureLoader, modulo) as Texture

  return useMemo(() => {
    const t = caricata.clone()
    t.colorSpace = SRGBColorSpace
    // Il verso verticale è da provare in entrambi i modi sul telefono, e non è
    // deducibile leggendo il codice: le UV di glTF vogliono flipY = false, ma il
    // TextureLoader di native imposta true di proposito («since expo-gl@12.4.0»)
    // insieme a isDataTexture, che cambia il percorso di upload di EXGL. Se le
    // texture escono capovolte, questa riga è la prima da invertire.
    t.flipY = false
    t.needsUpdate = true
    return t
  }, [caricata])
}

function applicaTextura(radice: Group, mappa: Texture): void {
  radice.traverse((nodo) => {
    const mesh = nodo as Mesh
    if (!mesh.isMesh) return
    const materiale = mesh.material as { map?: Texture | null; needsUpdate?: boolean }
    materiale.map = mappa
    materiale.needsUpdate = true
  })
}

/** Le ossa dell'avatar, indicizzate per nome: è così che un capo le ritrova. */
function ossaPerNome(radice: Group): Map<string, Bone> {
  const mappa = new Map<string, Bone>()
  radice.traverse((nodo) => {
    if ((nodo as Bone).isBone) mappa.set(nodo.name, nodo as Bone)
  })
  return mappa
}

/**
 * Lega il capo allo scheletro del corpo.
 *
 * La rimappatura è **per nome**, non una sostituzione in blocco dello skeleton:
 * gli `skinIndex` indicizzano l'array `bones` di quella mesh, e l'esportatore
 * glTF ci mette solo le ossa effettivamente pesate — una maglietta ne pesa meno
 * di un corpo intero. Sostituire lo skeleton senza rimappare lega i vertici alle
 * ossa sbagliate.
 *
 * Per *questi* file gli indici già combaciano (i capi nascono dal corpo e
 * riusano il suo array `joints`), quindi la rimappatura è ridondante oggi. Resta
 * perché il giorno in cui il capo arriva da un'altra fonte è l'unica versione
 * che regge, e costa un passaggio su poche centinaia di ossa.
 */
function vestiSuScheletro(capo: Group, ossa: Map<string, Bone>) {
  capo.traverse((nodo) => {
    const mesh = nodo as SkinnedMesh
    if (!mesh.isSkinnedMesh) return

    const rimappate = mesh.skeleton.bones.map((osso) => ossa.get(osso.name) ?? osso)
    mesh.bind(new Skeleton(rimappate, mesh.skeleton.boneInverses), mesh.bindMatrix)
    // Il bounding box è calcolato in rest pose: senza questo la mesh sparisce
    // appena la deformazione la porta fuori da quel volume.
    mesh.frustumCulled = false
  })
}

function Figura({
  trascinamento,
  indossaMaglietta,
  indossaPantaloncino,
}: {
  trascinamento: React.RefObject<Trascinamento>
  indossaMaglietta: boolean
  indossaPantaloncino: boolean
}) {
  const gruppo = useRef<Group>(null)

  const corpo = useLoader(CaricatoreGlb, AVATAR)
  const maglietta = useLoader(CaricatoreGlb, MAGLIETTA)
  const pantaloncino = useLoader(CaricatoreGlb, PANTALONCINO)

  const pelle = useTexturaGltf(PELLE)
  const stoffaMaglietta = useTexturaGltf(MAGLIETTA_STOFFA)
  const stoffaPantaloncino = useTexturaGltf(PANTALONCINO_STOFFA)

  useEffect(() => {
    applicaTextura(corpo.scene, pelle)
    applicaTextura(maglietta.scene, stoffaMaglietta)
    applicaTextura(pantaloncino.scene, stoffaPantaloncino)
  }, [corpo, maglietta, pantaloncino, pelle, stoffaMaglietta, stoffaPantaloncino])

  useEffect(() => {
    const ossa = ossaPerNome(corpo.scene)
    vestiSuScheletro(maglietta.scene, ossa)
    vestiSuScheletro(pantaloncino.scene, ossa)
  }, [corpo, maglietta, pantaloncino])

  useFrame((_stato, delta) => {
    const t = trascinamento.current
    if (!gruppo.current || !t) return

    if (!t.attivo) {
      t.fermoDa += delta
      t.velocita *= 0.9
      t.rotazione += t.velocita + (t.fermoDa > ATTESA_PRIMA_DI_GIRARE ? ROTAZIONE_A_RIPOSO * delta : 0)
    }
    gruppo.current.rotation.y = t.rotazione
  })

  return (
    <group ref={gruppo}>
      <primitive object={corpo.scene} />
      {indossaMaglietta ? <primitive object={maglietta.scene} /> : null}
      {indossaPantaloncino ? <primitive object={pantaloncino.scene} /> : null}
    </group>
  )
}

/**
 * `<Suspense>` cattura l'attesa, non gli errori: se una GLB non si carica,
 * senza questo l'app muore invece di dirlo.
 */
class SeCade extends Component<{ children: ReactNode; onCaduta: (motivo: string) => void }> {
  state = { caduto: false }

  static getDerivedStateFromError() {
    return { caduto: true }
  }

  componentDidCatch(errore: Error) {
    this.props.onCaduta(errore.message)
  }

  render() {
    return this.state.caduto ? null : this.props.children
  }
}

function Interruttore({
  etichetta,
  acceso,
  onPress,
}: {
  etichetta: string
  acceso: boolean
  onPress: () => void
}) {
  return (
    <Toccabile
      onPress={onPress}
      scala={0.97}
      style={{
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: raggi.piccolo,
        borderWidth: 1,
        borderColor: acceso ? colori.ambra : 'rgba(247,244,239,0.14)',
        backgroundColor: acceso ? 'rgba(215,244,92,0.14)' : 'rgba(247,244,239,0.04)',
      }}
    >
      <Etichetta taglia={12} colore={acceso ? colori.ambra : 'rgba(247,244,239,0.6)'}>
        {etichetta}
      </Etichetta>
    </Toccabile>
  )
}

export default function Prova3D() {
  const [maglietta, setMaglietta] = useState(true)
  const [pantaloncino, setPantaloncino] = useState(true)
  const [motivoCaduta, setMotivoCaduta] = useState<string | null>(null)

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

  return (
    <View style={{ flex: 1, backgroundColor: colori.inchiostro }}>
      <Testata occhiello="Sviluppo" titolo="Prova 3D" indietro scura />

      <View style={{ flex: 1 }} {...gesti.panHandlers}>
        {motivoCaduta ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spazi.l }}>
            <Corpo taglia={13} colore="rgba(247,244,239,0.6)">
              Il 3D non è partito: {motivoCaduta}
            </Corpo>
          </View>
        ) : (
          <Canvas
            camera={{ fov: 30, position: [0, 1.05, 4.6], near: 0.1, far: 100 }}
            onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}
            fallback={null}
            gl={{ antialias: true, alpha: true }}
            onError={() => setMotivoCaduta('WebGL non disponibile su questo dispositivo')}
          >
            <hemisphereLight args={['#ffffff', '#d8d4d0', 0.85]} />
            <directionalLight position={[1.6, 3.2, 2.4]} intensity={0.9} />
            <directionalLight position={[-2.2, 1.6, -1.8]} intensity={0.35} />
            <SeCade onCaduta={setMotivoCaduta}>
              <Suspense fallback={null}>
                <Figura
                  trascinamento={trascinamento}
                  indossaMaglietta={maglietta}
                  indossaPantaloncino={pantaloncino}
                />
              </Suspense>
            </SeCade>
          </Canvas>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: spazi.s,
          paddingHorizontal: spazi.l,
          paddingBottom: spazi.xl,
          paddingTop: spazi.s,
        }}
      >
        <Interruttore
          etichetta="Maglietta"
          acceso={maglietta}
          onPress={() => setMaglietta((v) => !v)}
        />
        <Interruttore
          etichetta="Pantaloncino"
          acceso={pantaloncino}
          onPress={() => setPantaloncino((v) => !v)}
        />
      </View>
    </View>
  )
}
