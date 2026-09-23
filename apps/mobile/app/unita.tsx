/**
 * «Unità»: la schermata `impunita` del deck, con **un gruppo invece di tre**.
 *
 * Il deck ne governa tre — lunghezze, peso, temperatura — e due qui non
 * comandano niente. **Peso**: non esiste nessun campo peso nel dominio, e il
 * deck stesso lo scrive nella sua nota («compare solo se lo inserisci: non te
 * lo chiedo»), cioè descrive un dato che non chiede mai. **Temperatura**: vale
 * solo col meteo, che il backend riceve come `Meteo` ma non è mai andato a
 * prendere. Disegnarli comunque darebbe due selettori che cambiano uno stato
 * che nessuno legge — precisamente il difetto che `impostazioni.tsx` ha appena
 * smesso di avere.
 *
 * Quando il peso o il meteo arriveranno, il gruppo si aggiunge qui: la forma è
 * già quella del deck, ed è per questo che è una schermata e non un
 * interruttore infilato nella riga di Impostazioni.
 */

import { VALORI_UNITA_LUNGHEZZA, type UnitaLunghezza } from '@wardrobe/contracts'
import { View } from 'react-native'
import { api } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { formattaLunghezza } from '../src/dati/dominio'
import { useAzione } from '../src/dati/risorsa'
import { ETICHETTE, colori, spazi } from '../src/tema/tokens'
import { Icona, Pillola, Scheda } from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { Corpo, Etichetta } from '../src/ui/testo'

export default function Unita() {
  const { profilo, ricarica, avvisa } = useArmadio()
  const { caricamento: salvando, esegui } = useAzione<typeof profilo>()
  const scelta: UnitaLunghezza = profilo?.unita_lunghezza ?? 'cm'

  // Nessuno stato locale: la scelta è quella del profilo, e il tocco la
  // salva subito. Una schermata con un solo interruttore non ha niente da
  // confermare — un bottone «Salva» qui sarebbe un passo in più per dire una
  // cosa che si è già detta toccando.
  async function scegli(unita: UnitaLunghezza) {
    if (!profilo || unita === scelta) return
    const salvato = await esegui(() => api.salvaProfilo({ ...profilo, unita_lunghezza: unita }))
    if (salvato) await ricarica()
    else avvisa('Non sono riuscito a cambiare unità.')
  }

  return (
    <Schermata
      occhiello=""
      titolo="Unità"
      tavolozza="neutro"
      indietro
      contentStyle={{ gap: spazi.m }}
    >
      <View style={{ gap: spazi.s }}>
        <Etichetta taglia={11} tono="debole">
          LUNGHEZZE
        </Etichetta>
        <View style={{ flexDirection: 'row', gap: spazi.s }}>
          {VALORI_UNITA_LUNGHEZZA.map((unita) => (
            <Pillola
              key={unita}
              testo={ETICHETTE.unitaLunghezza[unita]}
              attiva={scelta === unita}
              onPress={salvando ? undefined : () => void scegli(unita)}
            />
          ))}
        </View>
        <Corpo taglia="micro" tono="tenue">
          Altezza, larghezza spalle, lunghezza gamba.
        </Corpo>
      </View>

      <Scheda vetro style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spazi.m }}>
        <Icona nome="info" misura={17} colore={colori.primario} />
        <Corpo taglia="micro" tono="tenue" style={{ flex: 1 }}>
          {`Cambia solo come le leggi: le misure restano quelle che hai dato, e ${
            profilo?.misure?.altezza_cm != null
              ? `la tua altezza si scrive ${formattaLunghezza(profilo.misure.altezza_cm, scelta)}`
              : 'i tuoi capi non si toccano'
          }.`}
        </Corpo>
      </Scheda>

      <Corpo taglia="micro" tono="debole">
        {
          'Peso e temperatura per ora non ci sono: non c’è un peso da nessuna parte, e il meteo non arriva ancora.'
        }
      </Corpo>
    </Schermata>
  )
}
