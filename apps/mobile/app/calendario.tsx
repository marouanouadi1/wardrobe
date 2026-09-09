/**
 * Cosa ho messo: il mese come griglia di foto, e i capi che dormono.
 *
 * La griglia serve a una cosa sola: far vedere le ripetizioni. Quando gli
 * stessi due colori tornano ogni tre giorni si nota subito, e nasce da sé la
 * domanda che il prodotto vuole sentire — «ho un armadio pieno, perché metto
 * sempre le stesse cose?».
 */

import { Image } from 'expo-image'
import { router } from 'expo-router'
import { View } from 'react-native'
import { useArmadio } from '../src/dati/archivio'
import { capiDormienti, fotoDaMostrare } from '../src/dati/dominio'
import { formattaMeseAnno, parola } from '../src/dati/formato'
import { colori, durate, griglie, linee, spazi } from '../src/tema/tokens'
import { BadgeIa, BottonePrimario, BottoneSecondario, Scheda } from '../src/ui/base'
import { RigaStatistiche } from '../src/ui/righe'
import { ScheletroCalendario } from '../src/ui/scheletri'
import { Schermata } from '../src/ui/guscio'
import { Corpo, Etichetta, Titolo } from '../src/ui/testo'

const GIORNI_SETTIMANA = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

export default function Calendario() {
  const { capi, indice, pronto } = useArmadio()
  const adesso = new Date()
  const giorniNelMese = new Date(adesso.getFullYear(), adesso.getMonth() + 1, 0).getDate()
  const oggi = adesso.getDate()

  // Il backend registra ogni uso (`registra_uso`), ma non c'è ancora una rotta
  // che lo rilegga: ricostruiamo il mese da `ultimo_uso`, un capo per giorno.
  // Non è il diario vero — se più capi sono stati usati lo stesso giorno se ne
  // vede solo uno — ma è l'informazione che abbiamo senza inventare nulla.
  const usiPerGiorno = new Map<number, string[]>()
  for (const capo of capi) {
    if (!capo.ultimo_uso) continue
    const data = new Date(capo.ultimo_uso)
    if (data.getMonth() !== adesso.getMonth() || data.getFullYear() !== adesso.getFullYear()) continue
    const giorno = data.getDate()
    usiPerGiorno.set(giorno, [...(usiPerGiorno.get(giorno) ?? []), capo.id])
  }

  const dormienti = capiDormienti(capi)
  const ripetuti = capi.filter((capo) => (capo.volte_indossato ?? 0) >= 4).length

  return (
    <Schermata occhiello={formattaMeseAnno(adesso)} titolo="Cosa ho messo" indietro>
      {!pronto ? (
        // Prima, a caricamento in corso, questa griglia era semplicemente
        // vuota — nessun giorno, nessuna cella — indistinguibile da un mese
        // senza usi registrati.
        <ScheletroCalendario giorni={giorniNelMese} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: griglie.mese.distanza }}>
          {GIORNI_SETTIMANA.map((lettera, indiceGiorno) => (
            <View key={`${lettera}-${indiceGiorno}`} style={{ width: griglie.mese.colonna, alignItems: 'center' }}>
              <Etichetta taglia={9.5} tono="debole">
                {lettera}
              </Etichetta>
            </View>
          ))}

          {Array.from({ length: giorniNelMese }, (_, indiceGiorno) => {
            const giorno = indiceGiorno + 1
            const usati = usiPerGiorno.get(giorno) ?? []
            const primo = usati[0] ? indice.get(usati[0]) : undefined
            const fotoPrimo = primo ? fotoDaMostrare(primo) : undefined
            return (
              <View
                key={giorno}
                style={{
                  width: griglie.mese.colonna,
                  aspectRatio: griglie.mese.proporzione,
                  borderRadius: griglie.mese.raggio,
                  overflow: 'hidden',
                  backgroundColor: primo ? colori.fondoFoto : linee.tenue,
                  borderWidth: giorno === oggi ? 2 : 0,
                  borderColor: colori.inchiostro,
                }}
              >
                {fotoPrimo ? (
                  <Image
                    source={{ uri: fotoPrimo }}
                    style={{ position: 'absolute', inset: 0 }}
                    contentFit="cover"
                    transition={durate.breve}
                  />
                ) : null}
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: primo ? 'rgba(21,21,26,0.28)' : 'transparent',
                  }}
                />
                <Etichetta
                  taglia={10}
                  colore={primo ? colori.scheda : 'rgba(21,21,26,0.4)'}
                  style={{ position: 'absolute', left: 5, top: 3, letterSpacing: 0 }}
                >
                  {String(giorno)}
                </Etichetta>
              </View>
            )
          })}
        </View>
      )}

      {/* La scheda che chiude il cerchio: dai capi fermi nasce la ragione per
          cui l'app suggerisce anche cose che non sceglieresti. */}
      <Scheda imbottitura={20} style={{ backgroundColor: colori.ambraTenue, gap: spazi.s }}>
        <BadgeIa testo="dormono in fondo" />
        <Titolo taglia={25}>
          {parola(dormienti.length, '1 capo fermo da più di sei mesi', `${dormienti.length} capi fermi da più di sei mesi`)}
        </Titolo>
        <Corpo taglia={13.5} tono="medio">
          {'Se vuoi te ne infilo qualcuno negli outfit della settimana, senza che tu debba pensarci.'}
        </Corpo>
        <View style={{ flexDirection: 'row', gap: spazi.s, marginTop: spazi.s }}>
          <BottonePrimario
            testo="Rimettili in gioco"
            style={{ flex: 1 }}
            onPress={() => router.push('/suggeritore')}
          />
          <BottoneSecondario testo="Non ora" onPress={() => router.back()} />
        </View>
      </Scheda>

      <RigaStatistiche
        voci={[
          { numero: String(usiPerGiorno.size), etichetta: 'giorni tracciati' },
          { numero: String(ripetuti), etichetta: 'capi ripetuti' },
          { numero: String(dormienti.length), etichetta: 'mai usati' },
        ]}
      />
    </Schermata>
  )
}
