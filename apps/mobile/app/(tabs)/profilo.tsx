/**
 * Profilo: chi sei, come ti vesti, e la porta per gli strumenti interni.
 *
 * Il playground vive qui sotto «Sviluppo», visibile solo dove esiste. In
 * produzione il backend rifiuta comunque le rotte /dev/* con un 403
 * (`PLAYGROUND_ABILITATO`, vedi handlers/playground.py), quindi nascondere
 * il pulsante non è sicurezza per oscurità: è coerenza.
 */

import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { URL_API } from '../../src/dati/api'
import { useArmadio } from '../../src/dati/archivio'
import { dormiente } from '../../src/dati/dominio'
import { colori, linee, raggi, spazi } from '../../src/tema/tokens'
import { Bolla, BottoneSecondario, Icona, Scheda, Toccabile } from '../../src/ui/base'
import { Corpo, Etichetta, Forte, Numero, Titolo } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

/** In sviluppo il playground c'è sempre; in un'app pubblicata mai. */
const PLAYGROUND_VISIBILE = __DEV__

export default function Profilo() {
  const { capi, outfit, profilo, avvisa } = useArmadio()
  const dormienti = capi.filter((capo) => dormiente(capo))

  /**
   * Le righe hanno un chevron, quindi devono portare da qualche parte. Quelle
   * che non hanno ancora una schermata di modifica lo dicono invece di non fare
   * nulla sotto il dito.
   */
  const daFare = (cosa: string) => () =>
    avvisa(`La modifica di «${cosa}» arriva col prossimo passo: serve la schermata delle preferenze.`)

  const preferenze = [
    {
      chiave: 'Stile',
      valore: profilo?.preferenze?.stili?.join(', ') || 'da impostare',
      vai: daFare('Stile'),
    },
    {
      chiave: 'Palette',
      valore: profilo?.preferenze?.palette?.join(', ') || 'da impostare',
      vai: daFare('Palette'),
    },
    { chiave: 'Evita', valore: profilo?.preferenze?.evita?.join(', ') || '—', vai: daFare('Evita') },
    { chiave: 'Città', valore: profilo?.citta ?? 'da impostare', vai: daFare('Città') },
    {
      chiave: 'Outfit salvati',
      valore: String(outfit.length),
      vai: () => router.push('/outfit'),
    },
  ]

  return (
    <View style={{ flex: 1 }}>
      <Testata occhiello="Il tuo profilo" titolo={profilo?.nome?.split(' ')[0] ?? 'Tu'} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 130, gap: spazi.m }}
        showsVerticalScrollIndicator={false}
      >
        <Scheda imbottitura={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          {profilo?.foto_url ? (
            <Image
              source={{ uri: profilo.foto_url }}
              style={{ width: 66, height: 66, borderRadius: raggi.pillola }}
              contentFit="cover"
            />
          ) : (
            <Bolla nome="utente" sfondo="rgba(21,21,26,0.06)" tinta={colori.inchiostro} misura={66} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Titolo taglia={22}>{profilo?.nome ?? 'Il tuo profilo'}</Titolo>
            <Corpo taglia={12.5} tono="tenue">
              {profilo?.citta ? `${profilo.citta} · ` : ''}
              {`collegato a ${URL_API}`}
            </Corpo>
          </View>
        </Scheda>

        <View style={{ flexDirection: 'row', gap: 9 }}>
          {[
            { numero: String(capi.length), etichetta: 'capi', sfondo: colori.scheda, tinta: colori.inchiostro },
            { numero: String(outfit.length), etichetta: 'outfit', sfondo: colori.citron, tinta: colori.inchiostro },
            { numero: String(dormienti.length), etichetta: 'fermi', sfondo: colori.inchiostro, tinta: colori.crema },
          ].map((voce) => (
            <View
              key={voce.etichetta}
              style={{
                flex: 1,
                padding: 15,
                borderRadius: raggi.medio + 2,
                backgroundColor: voce.sfondo,
              }}
            >
              <Numero taglia={24} colore={voce.tinta}>
                {voce.numero}
              </Numero>
              <Forte taglia={10.5} colore={voce.tinta} style={{ marginTop: 5, opacity: 0.6 }}>
                {voce.etichetta}
              </Forte>
            </View>
          ))}
        </View>

        <Etichetta taglia={11} tono="debole" style={{ marginTop: spazi.s }}>
          Il tuo stile
        </Etichetta>
        <View style={{ borderRadius: raggi.medio + 4, backgroundColor: colori.scheda, overflow: 'hidden' }}>
          {preferenze.map((riga, indice) => (
            <Toccabile
              key={riga.chiave}
              onPress={riga.vai}
              scala={0}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spazi.m,
                paddingHorizontal: 17,
                paddingVertical: 15,
                borderBottomWidth: indice === preferenze.length - 1 ? 0 : 1,
                borderBottomColor: linee.tenue,
              }}
            >
              <Corpo taglia={14.5} style={{ flex: 1 }}>
                {riga.chiave}
              </Corpo>
              <Corpo taglia={13} tono="tenue">
                {riga.valore}
              </Corpo>
              <Icona nome="chevron" misura={15} colore="rgba(21,21,26,0.3)" spessore={2.4} />
            </Toccabile>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 9, marginTop: spazi.s }}>
          <BottoneSecondario
            testo="Cosa ho indossato"
            onPress={() => router.push('/calendario')}
            style={{ flex: 1 }}
          />
          <BottoneSecondario
            testo="Rivedi l'intro"
            onPress={() => router.push('/onboarding')}
            style={{ flex: 1 }}
          />
        </View>

        {PLAYGROUND_VISIBILE ? (
          <>
            <Etichetta taglia={11} colore={colori.oliva} style={{ marginTop: spazi.m }}>
              Sviluppo · solo interno
            </Etichetta>
            <Toccabile
              onPress={() => router.push('/dev/modelli')}
              scala={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                borderRadius: raggi.medio + 4,
                backgroundColor: colori.inchiostro,
              }}
            >
              <Bolla nome="scintilla" misura={40} />
              <View style={{ flex: 1 }}>
                <Titolo taglia={17} colore={colori.scheda}>
                  Modelli in uso
                </Titolo>
                <Corpo taglia={12} colore="rgba(255,253,249,0.6)">
                  Quale provider legge le foto e propone gli outfit
                </Corpo>
              </View>
              <Icona nome="chevron" misura={17} colore={colori.citron} spessore={2.4} />
            </Toccabile>
            <Toccabile
              onPress={() => router.push('/dev/playground')}
              scala={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                borderRadius: raggi.medio + 4,
                backgroundColor: colori.scheda,
                borderWidth: 1,
                borderColor: linee.tenue,
              }}
            >
              <Bolla nome="scintilla" misura={40} sfondo="rgba(21,21,26,0.06)" tinta={colori.inchiostro} />
              <View style={{ flex: 1 }}>
                <Titolo taglia={17}>Playground modelli</Titolo>
                <Corpo taglia={12} tono="tenue">
                  Provider, prompt, costi, storico
                </Corpo>
              </View>
              <Icona nome="chevron" misura={17} colore="rgba(21,21,26,0.3)" spessore={2.4} />
            </Toccabile>
            <Toccabile
              onPress={() => router.push('/dev/valutazioni')}
              scala={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                borderRadius: raggi.medio + 4,
                backgroundColor: colori.scheda,
                borderWidth: 1,
                borderColor: linee.tenue,
              }}
            >
              <Bolla nome="griglia" misura={40} sfondo="rgba(21,21,26,0.06)" tinta={colori.inchiostro} />
              <View style={{ flex: 1 }}>
                <Titolo taglia={17}>Valutazione modelli</Titolo>
                <Corpo taglia={12} tono="tenue">
                  Accuratezza e costo del banco a dieci campioni
                </Corpo>
              </View>
              <Icona nome="chevron" misura={17} colore="rgba(21,21,26,0.3)" spessore={2.4} />
            </Toccabile>
            <Toccabile
              onPress={() => router.push('/dev/prova-3d')}
              scala={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                borderRadius: raggi.medio + 4,
                backgroundColor: colori.scheda,
                borderWidth: 1,
                borderColor: linee.tenue,
              }}
            >
              <Bolla nome="griglia" misura={40} sfondo="rgba(21,21,26,0.06)" tinta={colori.inchiostro} />
              <View style={{ flex: 1 }}>
                <Titolo taglia={17}>Prova 3D</Titolo>
                <Corpo taglia={12} tono="tenue">
                  Un corpo vero che indossa capi veri, su questo telefono
                </Corpo>
              </View>
              <Icona nome="chevron" misura={17} colore="rgba(21,21,26,0.3)" spessore={2.4} />
            </Toccabile>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}
