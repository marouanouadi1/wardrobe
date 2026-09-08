/**
 * I capi, nelle forme in cui il design li mostra: griglia, e le miniature
 * più piccole (suggerimenti, selettore dell'avatar).
 *
 * Il colore del capo fa da sfondo sotto la foto. Non è un dettaglio estetico:
 * mentre la foto arriva dalla rete, l'utente vede già il colore giusto, e
 * l'armadio non lampeggia di rettangoli grigi.
 */

import type { Capo } from '@wardrobe/contracts'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { View } from 'react-native'
import { fotoDaMostrare } from '../dati/dominio'
import { ETICHETTE, colori, ombre, raggi } from '../tema/tokens'
import { Badge, Toccabile } from './base'
import { Corpo, Etichetta, Forte, Titolo } from './testo'

export function CapoInGriglia({ capo, onPress }: { capo: Capo; onPress: () => void }) {
  return (
    <Toccabile
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: raggi.medio + 2,
        overflow: 'hidden',
        backgroundColor: capo.colore.hex,
        ...ombre.bassa,
      }}
    >
      <Image
        source={{ uri: fotoDaMostrare(capo) }}
        style={{ width: '100%', height: 182 }}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={['rgba(21,21,26,0)', 'rgba(21,21,26,0.82)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 24, padding: 12 }}
      >
        <Titolo taglia={14} colore={colori.scheda}>
          {capo.nome}
        </Titolo>
        <Corpo taglia={11} colore="rgba(255,253,249,0.72)">
          {capo.colore.nome} · {capo.materiale?.split(',')[0] ?? ETICHETTE.tipo[capo.tipo]}
        </Corpo>
      </LinearGradient>
      {capo.stato !== 'pulito' ? (
        <View style={{ position: 'absolute', top: 9, right: 9 }}>
          <Badge testo="da lavare" sfondo={colori.corallo} colore={colori.crema} />
        </View>
      ) : null}
    </Toccabile>
  )
}

/** Miniatura quadrata: la mostrano il dettaglio di un capo («ci sta bene con») e le liste corte. */
export function Miniatura({
  capo,
  larghezza = 96,
  altezza = 118,
  selezionato,
  onPress,
}: {
  capo: Capo
  larghezza?: number
  altezza?: number
  selezionato?: boolean
  onPress?: () => void
}) {
  return (
    <Toccabile onPress={onPress} scala={0.96} style={{ width: larghezza }}>
      <Image
        source={{ uri: fotoDaMostrare(capo) }}
        style={{
          width: larghezza,
          height: altezza,
          borderRadius: raggi.medio,
          backgroundColor: capo.colore.hex,
          borderWidth: selezionato ? 2 : 0,
          borderColor: colori.inchiostro,
        }}
        contentFit="cover"
        transition={200}
      />
      <Forte taglia={11.5} style={{ marginTop: 7 }} numberOfLines={2}>
        {capo.nome}
      </Forte>
    </Toccabile>
  )
}

/** L'attributo letto dalla foto: in corallo se il modello non ne è sicuro. */
export function Attributo({
  chiave,
  valore,
  incerto,
  onPress,
}: {
  chiave: string
  valore: string
  incerto?: boolean
  onPress?: () => void
}) {
  return (
    <Toccabile
      onPress={onPress}
      scala={0.96}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: raggi.medio - 2,
        borderWidth: 1,
        borderColor: incerto ? 'rgba(255,106,69,0.45)' : 'transparent',
        backgroundColor: incerto ? '#FFF1EC' : 'rgba(21,21,26,0.04)',
      }}
    >
      <Etichetta taglia={10} tono="debole" style={{ letterSpacing: 0.9 }}>
        {chiave}
      </Etichetta>
      <Forte taglia={13.5} style={{ marginTop: 2 }}>
        {valore}
      </Forte>
    </Toccabile>
  )
}
