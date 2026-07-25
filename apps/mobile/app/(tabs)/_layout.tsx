/**
 * La barra in basso: pillola scura galleggiante, con il «+» in citron al centro.
 *
 * È scritta a mano invece di usare quella di sistema perché la forma — una
 * pillola staccata dal fondo, cinque voci di cui una circolare al centro — è
 * parte dell'identità del design, e perché così il tocco ha lo stesso feedback
 * del resto dell'app.
 */

import { Tabs } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colori, ombre, raggi } from '../../src/tema/tokens'
import { Icona, type NomeIcona, Toccabile } from '../../src/ui/base'
import { Etichetta } from '../../src/ui/testo'

const VOCI: { nome: string; etichetta: string; icona: NomeIcona; centrale?: boolean }[] = [
  { nome: 'oggi', etichetta: 'Oggi', icona: 'scintilla' },
  { nome: 'armadio', etichetta: 'Armadio', icona: 'griglia' },
  { nome: 'carica', etichetta: '', icona: 'piu', centrale: true },
  { nome: 'avatar', etichetta: 'Avatar', icona: 'maglietta' },
  { nome: 'profilo', etichetta: 'Profilo', icona: 'utente' },
]

export default function DisposizioneSchede() {
  const bordi = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colori.sfondo } }}
      tabBar={({ state, navigation }) => (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: Math.max(bordi.bottom, 10) + 6,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              padding: 8,
              borderRadius: raggi.pillola,
              backgroundColor: 'rgba(21,21,26,0.96)',
              ...ombre.alta,
            }}
          >
            {VOCI.map((voce, indice) => {
              const attiva = state.index === indice
              return (
                <Toccabile
                  key={voce.nome}
                  scala={0.92}
                  onPress={() => navigation.navigate(voce.nome)}
                  style={{
                    flex: voce.centrale ? 0 : 1,
                    width: voce.centrale ? 60 : undefined,
                    height: 48,
                    borderRadius: raggi.pillola,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    backgroundColor: voce.centrale
                      ? colori.citron
                      : attiva
                        ? 'rgba(247,244,239,0.14)'
                        : 'transparent',
                  }}
                >
                  <Icona
                    nome={voce.icona}
                    misura={voce.centrale ? 22 : 19}
                    colore={voce.centrale ? colori.inchiostro : attiva ? colori.crema : 'rgba(247,244,239,0.5)'}
                  />
                  {voce.etichetta ? (
                    <Etichetta
                      taglia={8.5}
                      colore={attiva ? colori.crema : 'rgba(247,244,239,0.5)'}
                      style={{ letterSpacing: 0.4 }}
                    >
                      {voce.etichetta}
                    </Etichetta>
                  ) : null}
                </Toccabile>
              )
            })}
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="oggi" />
      <Tabs.Screen name="armadio" />
      <Tabs.Screen name="carica" />
      <Tabs.Screen name="avatar" />
      <Tabs.Screen name="profilo" />
    </Tabs>
  )
}
