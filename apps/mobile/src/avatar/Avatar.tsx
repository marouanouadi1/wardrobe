/**
 * Il palco dell'avatar: sceglie il renderer e sopravvive al suo fallimento.
 *
 * Il 3D è la parte del prodotto che può non funzionare su un telefono
 * qualunque. Invece di scoprirlo dall'utente, lo gestiamo: un confine di errore
 * intorno al canvas, e se cade si passa al manichino piatto con una riga che
 * spiega perché. La funzione «vedi come ti sta» non si perde mai.
 */

import type { Capo, VestizioneColori } from '@wardrobe/contracts'
import { Image } from 'expo-image'
import { Component, type ReactNode, useState } from 'react'
import { View } from 'react-native'
import { colori as tinte, linee, raggi, spazi } from '../tema/tokens'
import { Toccabile } from '../ui/base'
import { Corpo, Etichetta } from '../ui/testo'
import { ManichinoPiatto } from './ManichinoPiatto'
import { Manichino3D } from './Manichino3D'
import type { ModoAvatar } from './renderer'

class ConfineErrore extends Component<
  { children: ReactNode; onCaduto: (motivo: string) => void },
  { caduto: boolean }
> {
  state = { caduto: false }

  static getDerivedStateFromError() {
    return { caduto: true }
  }

  componentDidCatch(errore: Error) {
    this.props.onCaduto(errore.message)
  }

  render() {
    return this.state.caduto ? null : this.props.children
  }
}

export function Avatar({
  modo,
  colori,
  capi,
  fotoUtente,
  onScegliFoto,
}: {
  modo: ModoAvatar
  colori: VestizioneColori
  capi: Capo[]
  fotoUtente?: string | null
  /** Apre la galleria per scegliere la foto a figura intera. */
  onScegliFoto?: () => void
}) {
  const [motivoRipiego, setMotivoRipiego] = useState<string | null>(null)

  if (modo === 'foto') {
    return (
      <AvatarFoto colori={colori} capi={capi} fotoUtente={fotoUtente} onScegliFoto={onScegliFoto} />
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {motivoRipiego === null ? (
        <ConfineErrore onCaduto={setMotivoRipiego}>
          <Manichino3D colori={colori} onNonDisponibile={setMotivoRipiego} />
        </ConfineErrore>
      ) : (
        <ManichinoPiatto colori={colori} />
      )}

      <View
        style={{
          position: 'absolute',
          left: spazi.m,
          bottom: spazi.m,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: raggi.pillola,
          backgroundColor: 'rgba(255,253,249,0.78)',
        }}
      >
        <Corpo taglia={11} tono="tenue">
          {motivoRipiego === null ? 'Trascina per girare' : 'Anteprima piatta'}
        </Corpo>
      </View>
    </View>
  )
}

/**
 * L'avatar 2D: la foto dell'utente, con i colori dell'outfit accanto.
 *
 * Non sovrapponiamo i capi alla foto con un ritaglio approssimativo: un collage
 * fatto male è peggio di nessun collage, e senza geometria il capo non segue il
 * corpo. Mostriamo la persona e, di fianco, la combinazione scelta — che è quanto
 * si riesce a dire onestamente oggi, non l'informazione a cui il prodotto mira.
 *
 * La direzione è in `docs/adr/0004`: la foto della persona è l'ingresso di un
 * corpo 3D fedele, non un ripiego di serie B, e i capi si vedono dalla propria
 * foto scontornata applicata come texture. Quando arriverà, si sostituisce questo
 * componente e nient'altro.
 */
function AvatarFoto({
  colori,
  capi,
  fotoUtente,
  onScegliFoto,
}: {
  colori: VestizioneColori
  capi: Capo[]
  fotoUtente?: string | null
  onScegliFoto?: () => void
}) {
  const tinteScelte = [colori.outer, colori.dress ?? colori.top, colori.bottom, colori.shoes].filter(
    (tinta): tinta is string => Boolean(tinta),
  )

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Toccabile
        onPress={onScegliFoto}
        scala={onScegliFoto ? 0.98 : 0}
        style={{ flex: 1, overflow: 'hidden', borderRadius: raggi.grande }}
      >
        {fotoUtente ? (
          <>
            <Image source={{ uri: fotoUtente }} style={{ flex: 1 }} contentFit="cover" transition={200} />
            {onScegliFoto ? (
              <View
                style={{
                  position: 'absolute',
                  left: spazi.s,
                  bottom: spazi.s,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: raggi.pillola,
                  backgroundColor: 'rgba(255,253,249,0.78)',
                }}
              >
                <Corpo taglia={11} tono="tenue">
                  Cambia foto
                </Corpo>
              </View>
            ) : null}
          </>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: spazi.l,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: linee.chiara,
              borderRadius: raggi.grande,
              gap: spazi.s,
            }}
          >
            <Etichetta taglia={10} tono="debole">
              la tua foto
            </Etichetta>
            <Corpo taglia={12.5} tono="tenue" style={{ textAlign: 'center' }}>
              Tocca per scegliere una tua foto a figura intera: la useremo per
              farti vedere i capi addosso.
            </Corpo>
          </View>
        )}
      </Toccabile>

      <View style={{ width: 74, paddingLeft: spazi.s, justifyContent: 'center', gap: spazi.s }}>
        {tinteScelte.map((tinta, indice) => (
          <View
            key={`${tinta}-${indice}`}
            style={{
              height: 48,
              borderRadius: raggi.piccolo,
              backgroundColor: tinta,
              borderWidth: 1,
              borderColor: linee.tenue,
            }}
          />
        ))}
        {capi.length === 0 ? (
          <Corpo taglia={11} tono="debole" style={{ textAlign: 'center' }}>
            niente addosso
          </Corpo>
        ) : null}
      </View>
    </View>
  )
}

export const SFONDO_PALCO = {
  backgroundColor: tinte.sfondo,
} as const
