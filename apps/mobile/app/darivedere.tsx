/**
 * I capi su cui il modello non era sicuro, tutti in una lista.
 *
 * Il patto è quello che il dettaglio di un capo dichiara già: *il modello prova
 * a indovinare, ma non fa finta di sapere*. Finora però l'incertezza si vedeva
 * **solo** aprendo un capo alla volta — `attributiIncerti()` esisteva da
 * sempre in `src/dati/dominio.ts`, e nessuna schermata la usava per fare un
 * elenco. Chi carica venti foto in un colpo non apre venti dettagli per
 * scoprire quali due hanno un dubbio.
 *
 * Niente chiamate nuove: la soglia (`SOGLIA_INCERTEZZA`) arriva dal dominio
 * Python via `@wardrobe/contracts`, e i capi sono già in memoria.
 */

import { router } from 'expo-router'
import { View } from 'react-native'
import { useArmadio } from '../src/dati/archivio'
import { attributiIncerti } from '../src/dati/dominio'
import { conta } from '../src/dati/formato'
import { ETICHETTE, spazi } from '../src/tema/tokens'
import { Badge, Scheda } from '../src/ui/base'
import { Miniatura } from '../src/ui/capi'
import { Schermata } from '../src/ui/guscio'
import { ScheletroGrigliaCapi } from '../src/ui/scheletri'
import { Vuoto } from '../src/ui/stati'
import { Corpo, Forte } from '../src/ui/testo'

export default function DaRivedere() {
  const { capi, pronto } = useArmadio()
  const daRivedere = capi
    .map((capo) => ({ capo, dubbi: attributiIncerti(capo) }))
    .filter((voce) => voce.dubbi.length > 0)

  return (
    <Schermata
      occhiello={pronto ? conta(daRivedere.length, 'da controllare', 'da controllare') : ''}
      titolo="Da rivedere"
      tavolozza="freddo"
      indietro
      contentStyle={{ gap: spazi.m }}
    >
      {!pronto ? (
        <ScheletroGrigliaCapi quanti={3} />
      ) : daRivedere.length === 0 ? (
        <Vuoto
          titolo="Non c'è niente da correggere"
          spiegazione="Su tutti i capi che hai caricato il modello era sicuro di quello che leggeva."
        />
      ) : (
        <>
          <Corpo taglia="corpo" tono="medio">
            Sono già nell’armadio e li puoi usare. Su questi dettagli non sono sicuro: correggili quando hai un minuto.
          </Corpo>

          {daRivedere.map(({ capo, dubbi }) => (
            <Scheda key={capo.id} vetro imbottitura={spazi.s}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.m }}>
                <Miniatura capo={capo} larghezza={56} altezza={56} onPress={() => router.push(`/capo/${capo.id}`)} />
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <Forte taglia="minuto" numberOfLines={1}>
                    {capo.nome}
                  </Forte>
                  {/* Quali dettagli, non quanti: «2 dubbi» non dice se aprire.
                      Le etichette vengono da `ETICHETTE.attributo`, la stessa
                      resa italiana che usa il dettaglio del capo. */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {dubbi.map((attributo) => (
                      <Badge key={attributo} testo={ETICHETTE.attributo[attributo].toLowerCase()} />
                    ))}
                  </View>
                </View>
              </View>
            </Scheda>
          ))}

          {/* Il permesso di non farlo. Senza, una lista di cose da sistemare
              diventa un compito; e questa lista non scade mai. */}
          <Corpo taglia="minuto" tono="tenue">
            Puoi anche lasciarli così: i consigli funzionano lo stesso, un po’ peggio. Questa lista non sparisce.
          </Corpo>
        </>
      )}
    </Schermata>
  )
}
