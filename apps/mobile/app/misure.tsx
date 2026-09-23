/**
 * Le misure del corpo: la schermata `misure` del deck, spostata.
 *
 * Nel deck è il **passo 2 di 3** dell'iscrizione. Qui è una destinazione di
 * Impostazioni, e non per comodità: l'onboarding dell'app ha due passi, e
 * aggiungerne un terzo è una decisione sua — `intro` è ancora una domanda
 * aperta. Intanto le misure servono a chi le vuole dare, non a chi sta ancora
 * decidendo se restare. Niente qui è obbligatorio, e si può svuotare tutto.
 *
 * **Le quattro misure del deck sono quattro righe con un chevron**, cioè
 * quattro schermate di scelta. Qui stanno in linea: gli stessi quattro valori,
 * senza quattro navigazioni per dire che si è alti 168. È la sola divergenza
 * dal deck in questa schermata, ed è di forma, non di contenuto.
 */

import { VALORI_CORPORATURA, VALORI_SISTEMA_TAGLIE, VALORI_TAGLIA } from '@wardrobe/contracts'
import type {
  Corporatura,
  Misure,
  SistemaTaglie,
  Taglia,
  UnitaLunghezza,
} from '@wardrobe/contracts'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { api } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { aCentimetri, daCentimetri, limitiIn, simboloUnita } from '../src/dati/dominio'
import { useAzione } from '../src/dati/risorsa'
import { ETICHETTE, colori, spazi } from '../src/tema/tokens'
import { BottonePrimario, Campo, Icona, LinkTesto, Pillola, Scheda } from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { Corpo, Etichetta, TestoErrore } from '../src/ui/testo'

/** Le tre misure numeriche. Il limite che le governa non è scritto qui: arriva
 *  dal dominio (`LIMITI_MISURE_CM`), ed è lo stesso numero che il `Field` di
 *  Pydantic fa rispettare. */
const NUMERICHE = [
  { chiave: 'altezza', etichetta: 'Altezza', facoltativa: false },
  { chiave: 'spalle', etichetta: 'Larghezza spalle', facoltativa: true },
  { chiave: 'lunghezza_gamba', etichetta: 'Lunghezza gamba', facoltativa: true },
] as const

type ChiaveNumerica = (typeof NUMERICHE)[number]['chiave']

/**
 * Dal campo di testo ai centimetri da salvare, dicendo **perché** no invece di
 * rifiutare e basta.
 *
 * Si digita nell'unità scelta e si salva sempre in centimetri: `limitiIn()`
 * porta gli estremi nell'unità che si sta digitando, arrotondandoli dalla
 * parte giusta — altrimenti il campo accetterebbe un valore che il server poi
 * rifiuta, con un errore che l'utente non può correggere.
 */
function leggiMisura(
  chiave: ChiaveNumerica,
  testo: string,
  unita: UnitaLunghezza,
): { cm: number | null; errore?: string } {
  const pulito = testo.trim()
  if (pulito === '') return { cm: null }
  const n = Number(pulito)
  const simbolo = simboloUnita(unita)
  if (!Number.isInteger(n)) return { cm: null, errore: `Scrivi un numero intero di ${simbolo}.` }
  const { min, max } = limitiIn(chiave, unita)
  if (n < min || n > max) return { cm: null, errore: `Un valore fra ${min} e ${max} ${simbolo}.` }
  return { cm: aCentimetri(n, unita) }
}

export default function MisureSchermata() {
  const { profilo, pronto, ricarica, avvisa } = useArmadio()
  const { caricamento: salvando, esegui } = useAzione<typeof profilo>()
  const unita: UnitaLunghezza = profilo?.unita_lunghezza ?? 'cm'

  const [sistema, setSistema] = useState<SistemaTaglie | null>(null)
  const [taglia, setTaglia] = useState<Taglia | null>(null)
  const [corporatura, setCorporatura] = useState<Corporatura | null>(null)
  const [numeri, setNumeri] = useState<Record<ChiaveNumerica, string>>({
    altezza: '',
    spalle: '',
    lunghezza_gamba: '',
  })

  // Una volta sola, alla prima volta che il profilo arriva: la stessa forma di
  // `preferenze.tsx`, e per la stessa ragione. L'archivio è ancora in
  // caricamento al montaggio, quindi leggere il profilo nell'inizializzatore
  // di `useState` lo vedrebbe `null` e salverebbe un armadio di campi vuoti
  // sopra misure già date. Un `ref` e non `profilo` fra le dipendenze, perché
  // il `ricarica()` del salvataggio non rimetta in campo i valori vecchi.
  const sincronizzato = useRef(false)
  useEffect(() => {
    if (sincronizzato.current || !profilo) return
    const m = profilo.misure
    setSistema(m?.sistema_taglie ?? null)
    setTaglia(m?.taglia ?? null)
    setCorporatura(m?.corporatura ?? null)
    // Dal centimetro salvato all'unità che si legge: la conversione avviene
    // qui e al salvataggio, mai in mezzo. `profilo` è nelle dipendenze ma il
    // `ref` ferma il secondo giro, quindi l'unità letta è quella del primo
    // caricamento — ed è giusto così: cambiarla si fa in un'altra schermata,
    // e tornando qui questo effetto riparte da capo.
    setNumeri({
      altezza: m?.altezza_cm != null ? String(daCentimetri(m.altezza_cm, unita)) : '',
      spalle: m?.spalle_cm != null ? String(daCentimetri(m.spalle_cm, unita)) : '',
      lunghezza_gamba:
        m?.lunghezza_gamba_cm != null ? String(daCentimetri(m.lunghezza_gamba_cm, unita)) : '',
    })
    sincronizzato.current = true
  }, [profilo, unita])

  const letture = {
    altezza: leggiMisura('altezza', numeri.altezza, unita),
    spalle: leggiMisura('spalle', numeri.spalle, unita),
    lunghezza_gamba: leggiMisura('lunghezza_gamba', numeri.lunghezza_gamba, unita),
  }
  const qualcosaNonVa = NUMERICHE.some((m) => letture[m.chiave].errore)

  async function salva(misure: Misure | null) {
    if (!profilo) {
      // `pronto` diventa `true` anche quando l'archivio ha fallito il
      // caricamento, e allora `profilo` è `null`: senza questa guardia si
      // manderebbe al server un profilo costruito dal nulla, cancellando
      // nome, città e preferenze insieme alle misure.
      avvisa('Non riesco a leggere il tuo profilo: riprova tra poco.')
      return
    }
    const salvato = await esegui(() => api.salvaProfilo({ ...profilo, misure }))
    if (!salvato) {
      avvisa('Non sono riuscito a salvare le misure.')
      return
    }
    await ricarica()
    router.back()
  }

  const daSalvare: Misure = {
    sistema_taglie: sistema,
    taglia,
    corporatura,
    altezza_cm: letture.altezza.cm,
    spalle_cm: letture.spalle.cm,
    lunghezza_gamba_cm: letture.lunghezza_gamba.cm,
  }
  const vuoto = Object.values(daSalvare).every((v) => v == null)
  // Il profilo salvato ha già delle misure: allora «Svuota» ha un senso —
  // altrimenti offrirebbe di cancellare qualcosa che non c'è.
  const ceQualcosaDaCancellare = profilo?.misure != null

  return (
    <Schermata
      occhiello="il tuo corpo"
      titolo="Le tue misure"
      tavolozza="neutro"
      indietro
      contentStyle={{ gap: spazi.l }}
    >
      <Corpo taglia="guida" tono="medio">
        Servono per costruire il tuo avatar e per capire come ti cade un capo. Il sistema di taglie
        lo scegli tu: non lo deduco dal nome né dalle foto.
      </Corpo>

      <View style={{ gap: spazi.s }}>
        <Etichetta>Su che taglie ragiono</Etichetta>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
          {VALORI_SISTEMA_TAGLIE.map((valore) => (
            <Pillola
              key={valore}
              testo={ETICHETTE.sistemaTaglie[valore]}
              attiva={sistema === valore}
              onPress={() => setSistema((prima) => (prima === valore ? null : valore))}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spazi.s }}>
        <Etichetta>Taglia abituale</Etichetta>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
          {VALORI_TAGLIA.map((valore) => (
            <Pillola
              key={valore}
              testo={ETICHETTE.taglia[valore]}
              attiva={taglia === valore}
              onPress={() => setTaglia((prima) => (prima === valore ? null : valore))}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spazi.s }}>
        <Etichetta>Corporatura</Etichetta>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
          {VALORI_CORPORATURA.map((valore) => (
            <Pillola
              key={valore}
              testo={ETICHETTE.corporatura[valore]}
              attiva={corporatura === valore}
              onPress={() => setCorporatura((prima) => (prima === valore ? null : valore))}
            />
          ))}
        </View>
      </View>

      {NUMERICHE.map((misura) => (
        <View key={misura.chiave} style={{ gap: spazi.s }}>
          <Campo
            etichetta={misura.facoltativa ? `${misura.etichetta} (facoltativa)` : misura.etichetta}
            value={numeri[misura.chiave]}
            onChangeText={(testo) =>
              setNumeri((prima) => ({ ...prima, [misura.chiave]: testo.replace(/[^0-9]/g, '') }))
            }
            keyboardType="number-pad"
            placeholder={simboloUnita(unita)}
            maxLength={3}
          />
          {letture[misura.chiave].errore ? (
            <TestoErrore>{letture[misura.chiave].errore}</TestoErrore>
          ) : null}
        </View>
      ))}

      <Scheda vetro style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.m }}>
        <Icona nome="scudo" misura={18} colore={colori.primario} />
        <Corpo taglia="micro" tono="tenue" style={{ flex: 1 }}>
          Le misure servono solo a vestire il tuo avatar. Non finiscono in nessun profilo pubblico e
          puoi cancellarle quando vuoi.
        </Corpo>
      </Scheda>

      <View style={{ gap: spazi.s }}>
        <BottonePrimario
          testo="Salva"
          caricando={salvando}
          disabilitato={salvando || !pronto || qualcosaNonVa || vuoto}
          onPress={() => void salva(daSalvare)}
        />
        {ceQualcosaDaCancellare ? (
          <LinkTesto onPress={() => void salva(null)}>Cancella le mie misure</LinkTesto>
        ) : null}
      </View>
    </Schermata>
  )
}
