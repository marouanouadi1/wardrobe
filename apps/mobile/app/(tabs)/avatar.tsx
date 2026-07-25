/**
 * «Come mi sta»: il palco dell'avatar, i quattro slot, il salvataggio.
 *
 * Gli slot sono quattro e sempre gli stessi — fuori, sopra, sotto, scarpe —
 * perché così l'utente impara la mappa una volta e poi non la rilegge più. Sono
 * anche esattamente gli slot che il manichino sa vestire: se un giorno l'avatar
 * imparasse i cappelli, la lista cambierebbe qui e nel dominio insieme.
 */

import type { SlotAvatar } from '@wardrobe/contracts'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { Image } from 'expo-image'
import { ScrollView, View } from 'react-native'
import { Avatar } from '../../src/avatar/Avatar'
import { MODI_AVATAR, type ModoAvatar } from '../../src/avatar/renderer'
import { useArmadio } from '../../src/dati/archivio'
import { SLOT_ORDINATI, capiDiVestizione, coloriDiVestizione, vestizioneIndossabile } from '../../src/dati/dominio'
import { ETICHETTE, colori, linee, ombre, raggi, spazi } from '../../src/tema/tokens'
import { BottonePrimario, Icona, Segmenti, Toccabile } from '../../src/ui/base'
import { Miniatura } from '../../src/ui/capi'
import { Corpo, Etichetta, Forte, Titolo } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

export default function SchermataAvatar() {
  const { capi, indice, vestizione, vestiSlot, svestiSlot, mescola, salvaOutfit, outfit, profilo } =
    useArmadio()
  const [modo, setModo] = useState<ModoAvatar>('manichino')
  const [slotAperto, setSlotAperto] = useState<SlotAvatar | null>(null)
  const [salvato, setSalvato] = useState(false)

  const coloriAddosso = coloriDiVestizione(vestizione, indice)
  const capiAddosso = capiDiVestizione(vestizione, indice)
  const indossabile = vestizioneIndossabile(vestizione)

  return (
    <View style={{ flex: 1 }}>
      <Testata occhiello="Prova virtuale" titolo="Come mi sta" fotoProfilo={profilo?.foto_url} />

      <View style={{ flex: 1, paddingHorizontal: spazi.xl, paddingBottom: 120, gap: spazi.m }}>
        <Segmenti voci={MODI_AVATAR} scelta={modo} onScegli={setModo} />

        <View
          style={{
            flex: 1,
            minHeight: 320,
            borderRadius: raggi.grande,
            overflow: 'hidden',
            ...ombre.bassa,
          }}
        >
          {/* Il fondo sfuma verso il citron: l'unico punto in cui il colore
              dell'IA fa da ambiente, perché qui è l'IA che ti sta vestendo. */}
          <LinearGradient
            colors={['#F2EEE6', '#E4DFD4', '#D9E6A8']}
            locations={[0, 0.6, 1]}
            style={{ position: 'absolute', inset: 0 }}
          />
          <Avatar
            modo={modo}
            colori={coloriAddosso}
            capi={capiAddosso}
            fotoUtente={profilo?.avatar_foto_chiave ? profilo.foto_url : null}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: spazi.s }}>
          {SLOT_ORDINATI.map((slot) => {
            const capoId = vestizione[slot]
            const capo = capoId ? indice.get(capoId) : undefined
            return (
              <Toccabile
                key={slot}
                onPress={() => setSlotAperto(slotAperto === slot ? null : slot)}
                scala={0.96}
                style={{
                  flex: 1,
                  borderRadius: raggi.medio,
                  overflow: 'hidden',
                  backgroundColor: colori.scheda,
                  borderWidth: 2,
                  borderColor: slotAperto === slot ? colori.inchiostro : 'transparent',
                  ...ombre.bassa,
                }}
              >
                <View style={{ height: 56, backgroundColor: capo?.colore.hex ?? 'rgba(21,21,26,0.06)' }}>
                  {capo?.foto.url ? (
                    <Image
                      source={{ uri: capo.foto.url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : null}
                </View>
                <View style={{ paddingHorizontal: 8, paddingTop: 7, paddingBottom: 9 }}>
                  <Etichetta taglia={9} tono="debole">
                    {ETICHETTE.slot[slot]}
                  </Etichetta>
                  <Forte taglia={11} numberOfLines={1} style={{ marginTop: 2 }}>
                    {capo?.nome ?? 'niente'}
                  </Forte>
                </View>
              </Toccabile>
            )
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: spazi.s }}>
          <BottonePrimario
            testo={salvato ? 'Salvato' : 'Salva questo outfit'}
            disabilitato={!indossabile}
            style={{ flex: 1 }}
            onPress={() => {
              void salvaOutfit(`Outfit ${outfit.length + 1}`)
              setSalvato(true)
              setTimeout(() => setSalvato(false), 2000)
            }}
          />
          <Toccabile
            onPress={mescola}
            scala={0.92}
            style={{
              width: 54,
              height: 54,
              borderRadius: raggi.pillola,
              borderWidth: 1,
              borderColor: linee.chiara,
              backgroundColor: colori.scheda,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icona nome="mescola" misura={20} />
          </Toccabile>
        </View>

        {!indossabile ? (
          <Corpo taglia={12} tono="tenue" style={{ textAlign: 'center' }}>
            Serve almeno un capo sopra e uno sotto — oppure un abito.
          </Corpo>
        ) : null}
      </View>

      {/* Il selettore: entra dal basso e mostra solo i capi di quello slot. */}
      {slotAperto ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spazi.xl,
            paddingTop: spazi.l,
            paddingBottom: 34,
            borderTopLeftRadius: raggi.grande,
            borderTopRightRadius: raggi.grande,
            backgroundColor: colori.scheda,
            ...ombre.alta,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 99,
              alignSelf: 'center',
              marginBottom: 14,
              backgroundColor: 'rgba(21,21,26,0.14)',
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.s, marginBottom: spazi.m }}>
            <Titolo taglia={19} style={{ flex: 1 }}>
              {ETICHETTE.slot[slotAperto]} — scegli
            </Titolo>
            {vestizione[slotAperto] ? (
              <Toccabile onPress={() => svestiSlot(slotAperto)} scala={0.95}>
                <Forte taglia={13} colore={colori.oliva}>
                  Togli
                </Forte>
              </Toccabile>
            ) : null}
            <Toccabile
              onPress={() => setSlotAperto(null)}
              scala={0.92}
              style={{
                width: 34,
                height: 34,
                borderRadius: raggi.pillola,
                backgroundColor: 'rgba(21,21,26,0.07)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icona nome="chiudi" misura={15} spessore={2.4} />
            </Toccabile>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spazi.m }}>
            {capi
              .filter((capo) => capo.slot === slotAperto)
              .map((capo) => (
                <Miniatura
                  key={capo.id}
                  capo={capo}
                  selezionato={vestizione[slotAperto] === capo.id}
                  onPress={() => {
                    vestiSlot(capo.id)
                    setSlotAperto(null)
                  }}
                />
              ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
}
