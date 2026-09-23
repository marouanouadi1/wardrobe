/**
 * L'armadio: i capi in griglia, e gli outfit salvati.
 *
 * **Capi e outfit sono due viste della stessa cosa**, come nel deck: un
 * segmento in cima, non due schermate lontane. La rotta `/outfit` resta viva
 * accanto a questa — il Profilo ci rimanda, e un link diretto deve continuare
 * ad arrivare da qualche parte — e le due mostrano lo **stesso** `ElencoOutfit`
 * (`ui/capi.tsx`), non due liste copiate.
 *
 * C'erano tre viste dei capi (appeso, griglia, elenco): la griglia di foto è
 * quella più luminosa e ariosa delle tre, ed è l'unica rimasta — niente
 * selettore da mostrare quando c'è una sola opzione.
 *
 * **Due righe di filtri, e una regola sola: un filtro per dimensione.** La
 * prima riga è la categoria (a scelta singola, `Tutti` = nessuna). La seconda
 * sono le qualità, e sono tre dimensioni indipendenti che si combinano in AND:
 * lo **stato** (`Pronti da mettere` e `Da lavare` si escludono a vicenda — sono
 * due risposte alla stessa domanda, e insieme darebbero sempre zero), i
 * **preferiti** e i capi **usati di rado**. Senza questa regola un utente può
 * comporre a mano una selezione vuota per costruzione e leggerla come un bug.
 */

import type { StatoCapo, TipoCapo } from '@wardrobe/contracts'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useArmadio, useVestiEVai } from '../../src/dati/archivio'
import { TIPI_CAPO, attributiIncerti, dormiente } from '../../src/dati/dominio'
import { conta } from '../../src/dati/formato'
import { ETICHETTE, griglie, spazi } from '../../src/tema/tokens'
import { BarraChiedi, BottonePrimario, Pillola, Segmenti } from '../../src/ui/base'
import { CapoInGriglia, CasellaAggiungi, ElencoOutfit } from '../../src/ui/capi'
import { Schermata } from '../../src/ui/guscio'
import { RigaNavigabile } from '../../src/ui/righe'
import { ScheletroGrigliaCapi, ScheletroSchedaOutfit } from '../../src/ui/scheletri'
import { Vuoto } from '../../src/ui/stati'
import { Corpo, Forte } from '../../src/ui/testo'

/** Le due viste dell'armadio. Il deck le chiama «Capi» e «Outfit». */
type Vista = 'capi' | 'outfit'
const VISTE = [
  { valore: 'capi', etichetta: 'Capi' },
  { valore: 'outfit', etichetta: 'Outfit' },
] as const

type Categoria = 'tutti' | TipoCapo
/** Le due risposte alla stessa domanda: si escludono, non si sommano. */
type FiltroStato = 'nessuno' | 'pronti' | 'da_lavare'

// L'elenco non si ridigita: `TIPI_CAPO` viene da `ETICHETTE.tipo`, che a sua
// volta copre l'enum del backend. Una categoria nuova compare qui da sola.
const CATEGORIE: { valore: Categoria; etichetta: string }[] = [
  { valore: 'tutti', etichetta: 'Tutti' },
  ...TIPI_CAPO.map((tipo) => ({ valore: tipo as Categoria, etichetta: ETICHETTE.tipo[tipo] })),
]

export default function Armadio() {
  const { capi, outfit, indice, profilo, pronto } = useArmadio()
  const vestiEVai = useVestiEVai()
  const parametri = useLocalSearchParams<{ stato?: StatoCapo }>()
  const [vista, setVista] = useState<Vista>('capi')
  const [categoria, setCategoria] = useState<Categoria>('tutti')
  const [stato, setStato] = useState<FiltroStato>(
    parametri.stato === 'da_lavare' ? 'da_lavare' : 'nessuno',
  )
  const [soloPreferiti, setSoloPreferiti] = useState(false)
  const [soloDormienti, setSoloDormienti] = useState(false)
  const [ricerca, setRicerca] = useState('')

  const mostrati = useMemo(() => {
    const testo = ricerca.trim().toLowerCase()
    return capi.filter((capo) => {
      if (categoria !== 'tutti' && capo.tipo !== categoria) return false
      if (stato === 'pronti' && capo.stato !== 'pulito') return false
      if (stato === 'da_lavare' && capo.stato === 'pulito') return false
      if (soloPreferiti && !capo.preferito) return false
      if (soloDormienti && !dormiente(capo)) return false
      if (!testo) return true
      // La ricerca guarda anche materiale e brand: chi cerca «lino» vuole la
      // camicia, e «lino» non è nel suo nome.
      return [capo.nome, capo.colore.nome, capo.materiale, capo.brand, ETICHETTE.tipo[capo.tipo]]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(testo)
    })
  }, [capi, categoria, stato, soloPreferiti, soloDormienti, ricerca])

  const inLavatrice = capi.filter((capo) => capo.stato !== 'pulito').length
  /** Quanti capi hanno un attributo sotto la soglia di incertezza del dominio. */
  const daRivedere = capi.filter((capo) => attributiIncerti(capo).length > 0).length
  const armadioVuoto = pronto && capi.length === 0
  const vaiACaricare = () => router.push('/(tabs)/carica')
  // `|| armadioVuoto` non è una cintura: `armadioVuoto` è falso finché
  // `pronto` è falso, quindi il segmento **si vede** durante il caricamento.
  // Chi tocca «Outfit» in quel momento, e poi scopre di avere l'armadio
  // vuoto, si ritroverebbe nella vista outfit con il segmento sparito: né un
  // modo di tornare ai capi né il bottone «Aggiungi il primo capo». Così il
  // ramo del vuoto è irraggiungibile dalla vista sbagliata per costruzione.
  const suiCapi = vista === 'capi' || armadioVuoto

  return (
    <Schermata
      occhiello={
        !pronto
          ? ''
          : suiCapi
            ? `${capi.length} capi${inLavatrice ? ` · ${inLavatrice} in lavatrice` : ''}`
            : conta(outfit.length, 'salvato', 'salvati')
      }
      titolo={
        suiCapi
          ? armadioVuoto
            ? 'Ancora vuoto'
            : 'Il tuo armadio'
          : pronto && outfit.length === 0
            ? 'Ancora niente'
            : 'I tuoi outfit'
      }
      fotoProfilo={profilo?.foto_url}
      tavolozza="freddo"
      contentStyle={{ gap: spazi.m }}
    >
      {/* Il segmento sparisce a armadio vuoto: senza capi non ci sono outfit,
          e «Outfit» sarebbe un bersaglio che porta a un secondo vuoto. */}
      {armadioVuoto ? null : <Segmenti voci={VISTE} scelta={vista} onScegli={setVista} />}

      {/* A armadio vuoto non c'è niente da cercare né da filtrare: le due
          righe di pillole sarebbero sei bersagli che non fanno nulla. */}
      {!suiCapi || armadioVuoto ? null : (
        <>
          <BarraChiedi
            valore={ricerca}
            onCambia={setRicerca}
            placeholder="felpa, grigio, ciabatte…"
            icona="cerca"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            {CATEGORIE.map((voce) => (
              <Pillola
                key={voce.valore}
                testo={voce.etichetta}
                attiva={categoria === voce.valore}
                onPress={() => setCategoria(voce.valore)}
              />
            ))}
          </ScrollView>

          {/* La seconda riga: i filtri che nell'armadio vero si usano più della
              categoria — «cosa posso mettere adesso» e «cosa amo». */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            <Pillola
              compatta
              testo="♥ Preferiti"
              attiva={soloPreferiti}
              onPress={() => setSoloPreferiti((prima) => !prima)}
            />
            <Pillola
              compatta
              testo="Pronti da mettere"
              attiva={stato === 'pronti'}
              onPress={() => setStato((prima) => (prima === 'pronti' ? 'nessuno' : 'pronti'))}
            />
            <Pillola
              compatta
              testo="Da lavare"
              attiva={stato === 'da_lavare'}
              onPress={() => setStato((prima) => (prima === 'da_lavare' ? 'nessuno' : 'da_lavare'))}
            />
            <Pillola
              compatta
              testo="Usati di rado"
              attiva={soloDormienti}
              onPress={() => setSoloDormienti((prima) => !prima)}
            />
          </ScrollView>
        </>
      )}

      {!suiCapi ? (
        <>
          {/* La riga che il deck mette sotto il segmento: dice dove finiscono
              le proposte che non si salvano, che è la domanda vera di chi
              apre questa vista e la trova vuota. */}
          <Corpo taglia="minuto" tono="tenue">
            Quelli che hai salvato tu. Le proposte restano in «Oggi» finché non ne salvi una.
          </Corpo>
          <ElencoOutfit
            outfit={outfit}
            indice={indice}
            pronto={pronto}
            scheletro={
              <>
                <ScheletroSchedaOutfit />
                <ScheletroSchedaOutfit />
              </>
            }
            onVesti={vestiEVai}
            onVediOggi={() => router.push('/(tabs)/oggi')}
          />
        </>
      ) : !pronto ? (
        // Prima, a caricamento in corso, `mostrati.length === 0` faceva
        // scattare il ramo qui sotto: «niente con questi filtri» a un
        // armadio pieno che stava solo ancora arrivando.
        <ScheletroGrigliaCapi />
      ) : armadioVuoto ? (
        // Il vuoto del deck ha **tre** parti, e la terza è un bersaglio: senza
        // il bottone questa schermata è un fondo cieco — non c'è né la griglia
        // (e quindi nemmeno la `CasellaAggiungi`) né la barra dei filtri.
        <>
          <Vuoto
            titolo="Qui finiscono i tuoi capi"
            spiegazione="Una foto per capo, anche stesa sul letto. Categoria, colore e tessuto li riconosco io."
          />
          <View style={{ alignItems: 'center', gap: spazi.s }}>
            <BottonePrimario testo="Aggiungi il primo capo" onPress={vaiACaricare} />
            <Corpo taglia="minuto" tono="tenue">
              Da tre in su comincio a proporti qualcosa
            </Corpo>
          </View>
        </>
      ) : mostrati.length === 0 ? (
        <Vuoto
          titolo={categoria === 'tutti' ? 'Niente con questi filtri' : `Niente in ${ETICHETTE.tipo[categoria].toLowerCase()}`}
          spiegazione="Il filtro c'è, i capi no. Toglilo per rivedere tutto, oppure fotografane uno."
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: griglie.armadio.distanza }}>
            {mostrati.map((capo) => (
              <View key={capo.id} style={{ width: griglie.armadio.colonna }}>
                <CapoInGriglia capo={capo} onPress={() => router.push(`/capo/${capo.id}`)} />
              </View>
            ))}
            <View style={{ width: griglie.armadio.colonna }}>
              <CasellaAggiungi onPress={vaiACaricare} />
            </View>
          </View>
          {/* Il conteggio sta **sotto** la griglia, come nel deck: sopra
              sarebbe una riga da leggere prima di vedere i capi. */}
          <Forte taglia="minuto" tono="tenue">
            {conta(mostrati.length, 'capo', 'capi')}
            {categoria === 'tutti' ? '' : ` in ${ETICHETTE.tipo[categoria]}`}
          </Forte>
        </>
      )}

      {/* Il rimando ai capi con un dubbio: solo se ce n'è almeno uno, e solo
          sotto i capi. Senza questa riga `/darivedere` sarebbe raggiungibile
          soltanto nei secondi subito dopo un caricamento — e la lista che dice
          «non sparisce» sarebbe sparita. */}
      {suiCapi && daRivedere > 0 ? (
        <RigaNavigabile
          icona="cartellino"
          titolo="Capi da rivedere"
          sottotitolo={conta(daRivedere, 'capo ha un dettaglio incerto', 'capi hanno un dettaglio incerto')}
          onPress={() => router.push('/darivedere')}
          bordo
        />
      ) : null}

      {/* Solo sotto i capi: nella vista outfit la riga inviterebbe a chiedere
          una proposta nuova proprio dove si guarda ciò che si è già scelto. */}
      {suiCapi ? (
        <RigaNavigabile
          icona="scintilla"
          titolo="Chiedi tu ad Aura"
          sottotitolo="«Ho una cena, voglio stare comodo»"
          su="scuro"
          onPress={() => router.push('/suggeritore')}
        />
      ) : null}
    </Schermata>
  )
}
