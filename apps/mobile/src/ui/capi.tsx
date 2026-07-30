/**
 * I capi, nelle tre forme in cui il design li mostra: appeso, griglia, elenco.
 *
 * Il colore del capo fa da sfondo sotto la foto. Non è un dettaglio estetico:
 * mentre la foto arriva dalla rete, l'utente vede già il colore giusto, e
 * l'armadio non lampeggia di rettangoli grigi.
 */

import type { Capo } from '@wardrobe/contracts'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { View } from 'react-native'
import { fotoDaMostrare, quandoUsato } from '../dati/dominio'
import { ETICHETTE, colori, linee, ombre, raggi, spazi } from '../tema/tokens'
import { Toccabile } from './base'
import { Corpo, Etichetta, Forte, Titolo } from './testo'

function BadgeDaLavare() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 9,
        right: 9,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: raggi.pillola,
        backgroundColor: colori.corallo,
      }}
    >
      <Etichetta taglia={9.5} colore="#fff">
        da lavare
      </Etichetta>
    </View>
  )
}

/** La gruccia: due tratti sopra il capo, come nella vista «appeso». */
function Gruccia() {
  return (
    <View
      style={{
        width: 26,
        height: 22,
        alignSelf: 'center',
        marginBottom: -5,
        borderWidth: 2.5,
        borderBottomWidth: 0,
        borderColor: 'rgba(238,232,219,0.85)',
        borderTopLeftRadius: 99,
        borderTopRightRadius: 99,
        zIndex: 2,
      }}
    />
  )
}

export function CapoAppeso({
  capo,
  inclinazione,
  onPress,
}: {
  capo: Capo
  inclinazione: string
  onPress: () => void
}) {
  return (
    <Toccabile onPress={onPress} scala={0.97} style={{ width: 132 }}>
      <Gruccia />
      <View
        style={{
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          overflow: 'hidden',
          backgroundColor: capo.colore.hex,
          transform: [{ rotate: inclinazione }],
          ...ombre.alta,
        }}
      >
        <Image
          source={{ uri: fotoDaMostrare(capo) }}
          style={{ width: 132, height: 178 }}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.3)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', inset: 0 }}
        />
        {capo.stato !== 'pulito' ? <BadgeDaLavare /> : null}
      </View>
      <View style={{ paddingTop: 9, paddingHorizontal: 2 }}>
        <Forte taglia={12} colore="#F1E9DC">
          {capo.nome}
        </Forte>
        <Corpo taglia={10.5} colore="rgba(241,233,220,0.45)">
          {capo.colore.nome}
        </Corpo>
      </View>
    </Toccabile>
  )
}

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
      {capo.stato !== 'pulito' ? <BadgeDaLavare /> : null}
    </Toccabile>
  )
}

export function CapoInElenco({ capo, onPress }: { capo: Capo; onPress: () => void }) {
  return (
    <Toccabile
      onPress={onPress}
      scala={0.99}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        padding: 10,
        borderRadius: raggi.medio,
        backgroundColor: colori.scheda,
        ...ombre.bassa,
      }}
    >
      <Image
        source={{ uri: fotoDaMostrare(capo) }}
        style={{ width: 50, height: 62, borderRadius: raggi.piccolo, backgroundColor: capo.colore.hex }}
        contentFit="cover"
        transition={200}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Titolo taglia={15.5}>{capo.nome}</Titolo>
        <Corpo taglia={12} tono="tenue">
          {ETICHETTE.tipo[capo.tipo]} · {capo.colore.nome}
          {capo.brand ? ` · ${capo.brand}` : ''}
        </Corpo>
      </View>
      <Corpo taglia={11} tono="debole">
        {quandoUsato(capo.ultimo_uso)}
      </Corpo>
    </Toccabile>
  )
}

/** Miniatura quadrata: la usano i suggerimenti e il selettore dell'avatar. */
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
    <Toccabile onPress={onPress} scala={onPress ? 0.96 : 0} style={{ width: larghezza }}>
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
      scala={onPress ? 0.96 : 0}
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

export const INCLINAZIONI = ['-1.4deg', '1.1deg', '-0.6deg', '1.7deg'] as const

export function separatore() {
  return <View style={{ height: 1, backgroundColor: linee.tenue, marginVertical: spazi.s }} />
}
