/**
 * Le impostazioni: il contenitore che il deck chiede, con dentro tutto quello
 * che il prodotto prevede — anche ciò che ancora non c'è.
 *
 * **Le voci che non funzionano si vedono, spente, col motivo.** È la stessa
 * scelta del menu «···» del dettaglio di un capo (`ui/avviso.tsx`, `Foglio`) e
 * la stessa ragione: un'impostazione nascosta insegna che quella cosa non
 * esiste, una spenta che dice cosa manca insegna che non esiste *ancora*. Qui
 * però il peso è diverso e va detto — una schermata di impostazioni è una
 * destinazione a cui si torna, non un menu che si apre e si chiude. Finché
 * restano più righe spente che accese, questa schermata **dichiara una
 * direzione**, e il suo valore dipende dal fatto che quella direzione si
 * percorra davvero: le voci aperte stanno in `docs/DA_FARE.md`.
 *
 * `implingua` del deck **non ha una sua schermata**, e non per dimenticanza:
 * non esiste nessuna i18n — l'app è scritta in italiano nel codice, per scelta
 * dichiarata in `CLAUDE.md`, e una schermata che offre di cambiare lingua senza
 * un catalogo dietro promette quello che non può dare.
 */

import type { Misure, UnitaLunghezza } from '@wardrobe/contracts'
import { router } from 'expo-router'
import { Linking, View } from 'react-native'
import { api } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { formattaLunghezza } from '../src/dati/dominio'
import { useAzione } from '../src/dati/risorsa'
import { ETICHETTE, spazi } from '../src/tema/tokens'
import { Scheda } from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { RigaImpostazione } from '../src/ui/righe'
import { Corpo, Etichetta } from '../src/ui/testo'

/**
 * Cosa mostra la riga «Misure e taglia» a destra, senza aprirla.
 *
 * Taglia e altezza e non le sei: sono le due che si ricordano, e una riga di
 * impostazioni deve stare su una riga. Se non c'è né l'una né l'altra la riga
 * dice «da impostare» come fa già «Stile e abitudini» — non «—», che si legge
 * come un errore invece che come un invito.
 */
function riassuntoMisure(misure: Misure | null | undefined, unita: UnitaLunghezza): string {
  const pezzi = [
    misure?.taglia ? ETICHETTE.taglia[misure.taglia] : null,
    misure?.altezza_cm != null ? formattaLunghezza(misure.altezza_cm, unita) : null,
  ].filter(Boolean)
  return pezzi.length > 0 ? pezzi.join(' · ') : 'da impostare'
}

export default function Impostazioni() {
  const { profilo, avvisa } = useArmadio()
  const stili = profilo?.preferenze?.stili ?? []
  const unita: UnitaLunghezza = profilo?.unita_lunghezza ?? 'cm'
  const { caricamento: scaricando, esegui } = useAzione<{ url: string }>()

  /**
   * Il server non manda i dati: manda un indirizzo firmato, a scadenza corta,
   * che si apre nel **browser di sistema**. È il browser a saper scaricare un
   * file, non un'app React Native — e `expo-sharing`, che darebbe il foglio di
   * condivisione nativo, è una dipendenza in più su un lock che in questo repo
   * ha già fatto male tre volte.
   */
  async function scarica() {
    const pronta = await esegui(() => api.esportazione())
    if (!pronta) {
      avvisa('Non sono riuscito a preparare i tuoi dati. Riprova fra poco.')
      return
    }
    // Niente `canOpenURL` prima: su Android 11+ risponde in base a cosa il
    // manifest dichiara in `<queries>`, quindi può dire «no» per un browser
    // che c'è — e l'APK è l'unica piattaforma che pubblichiamo, cioè l'unica
    // dove ce ne accorgeremmo, e solo su un dispositivo vero. `openURL`
    // rifiuta da sé quando davvero nessuno sa aprire l'indirizzo: si aspetta
    // quel rifiuto, invece di indovinarlo prima.
    try {
      await Linking.openURL(pronta.url)
    } catch {
      avvisa('Non trovo un browser con cui aprire il download.')
    }
  }

  const GRUPPI: {
    titolo: string
    voci: {
      etichetta: string
      valore?: string
      onPress?: () => void
      nota?: string
      pericolo?: boolean
    }[]
  }[] = [
    {
      titolo: 'Account',
      voci: [
        {
          etichetta: 'Accesso',
          nota: 'Email e password non si possono ancora cambiare, e non c’è ancora l’accesso con Google o Apple.',
        },
        {
          etichetta: 'Misure e taglia',
          valore: riassuntoMisure(profilo?.misure, unita),
          onPress: () => router.push('/misure'),
        },
        {
          etichetta: 'Stile e abitudini',
          valore: stili.length > 0 ? stili.join(' · ') : 'da impostare',
          onPress: () => router.push({ pathname: '/preferenze', params: { rivisita: '1' } }),
        },
        {
          etichetta: 'Piano',
          nota: 'Non c’è ancora niente da pagare: tutto quello che vedi è compreso.',
        },
      ],
    },
    {
      titolo: 'App',
      voci: [
        {
          etichetta: 'Notifiche',
          nota: 'Aura non ti manda ancora nessuna notifica.',
        },
        {
          etichetta: 'Unità',
          valore: ETICHETTE.unitaLunghezza[unita],
          onPress: () => router.push('/unita'),
        },
        {
          etichetta: 'Lingua',
          valore: 'Italiano',
          nota: 'Per ora Aura parla solo italiano.',
        },
      ],
    },
    {
      titolo: 'Foto e dati',
      voci: [
        {
          etichetta: 'Accesso alle foto',
          valore: 'Gestito dal sistema',
          // Il permesso non lo decide l'app: si apre dove si decide davvero.
          // Scriverlo qui con un interruttore nostro sarebbe una bugia — il
          // sistema può revocarlo in qualunque momento, senza dircelo.
          onPress: () => void Linking.openSettings(),
        },
        {
          etichetta: 'Scarica i tuoi dati',
          valore: scaricando ? 'preparo…' : undefined,
          nota: 'Capi, outfit, misure e conversazioni in un file zip, con dentro le foto. Si apre il browser per scaricarlo.',
          onPress: scaricando ? undefined : () => void scarica(),
        },
        {
          etichetta: 'Svuota l’armadio',
          pericolo: true,
          nota: 'Capi, outfit, conversazioni e diario. Restano l’account e le tue misure.',
          onPress: () => router.push('/svuota'),
        },
        {
          etichetta: 'Elimina l’account',
          pericolo: true,
          // Spenta di proposito e non nascosta: sapere che si potrà è parte
          // della promessa. Il motivo che mostra non è «manca la rotta» — non
          // manca solo quella: manca la decisione su cosa significa cancellare
          // un account, che si prende con privacy e termini alla mano.
          nota: 'L’account non si può ancora eliminare: prima va deciso cosa comporta davvero.',
        },
      ],
    },
  ]

  return (
    <Schermata occhiello="" titolo="Impostazioni" tavolozza="neutro" indietro contentStyle={{ gap: spazi.m }}>
      {GRUPPI.map((gruppo) => (
        <View key={gruppo.titolo} style={{ gap: spazi.s }}>
          <Etichetta taglia={11} tono="debole">
            {gruppo.titolo.toUpperCase()}
          </Etichetta>
          <Scheda vetro imbottitura={0} style={{ overflow: 'hidden' }}>
            {gruppo.voci.map((voce, indice) => (
              <RigaImpostazione
                key={voce.etichetta}
                etichetta={voce.etichetta}
                valore={voce.valore}
                onPress={voce.onPress}
                nota={voce.nota}
                pericolo={voce.pericolo}
                primo={indice === 0}
              />
            ))}
          </Scheda>
        </View>
      ))}

      <Corpo taglia="micro" tono="debole" style={{ textAlign: 'center' }}>
        {'Le voci spente non sono dimenticanze: dicono cosa manca ancora.'}
      </Corpo>
    </Schermata>
  )
}
