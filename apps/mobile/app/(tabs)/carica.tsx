/**
 * Aggiungere un capo: scatta o scegli, guarda la coda, analizza.
 *
 * «Scatta» e «Dalla galleria» accumulano in una coda — non partono subito:
 * chi ha appena scaricato l'app ha un armadio pieno, non un capo, e prima
 * c'erano due percorsi separati per dirlo (un bottone «Dalla galleria» che
 * prendeva una foto sola, un secondo bottone che ne prendeva fino a venti)
 * più un terzo che non copriva affatto la fotocamera. Una foto sola in coda
 * si comporta come sempre: un'attesa onesta (`AttesaLunga`), poi il dettaglio
 * per confermare cosa il modello ha letto. Più foto insieme vanno a un capo per
 * volta, e finiscono in armadio via via che il modello finisce — senza
 * fermarsi alla prima che fallisce.
 */

import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { View } from 'react-native'
import { api, messaggioDiErrore } from '../../src/dati/api'
import { useArmadio } from '../../src/dati/archivio'
import { conta } from '../../src/dati/formato'
import { colori, raggi, spazi } from '../../src/tema/tokens'
import { BottonePrimario, BottoneSecondario, Icona, Scheda } from '../../src/ui/base'
import { MiniaturaFoto, SchedaFoto } from '../../src/ui/capi'
import { AttesaLunga } from '../../src/ui/stati'
import { Corpo, Etichetta, Titolo } from '../../src/ui/testo'
import { Schermata } from '../../src/ui/guscio'

/**
 * L'analisi è una sola chiamata al modello di visione (`handlers/analisi.py`
 * la esegue in linea, senza checkpoint intermedi): niente fasi vere da
 * mostrare, solo un'attesa che si allunga col tempo. Le soglie sono tarate
 * sulla latenza reale (scontorno + visione, 20-40 s): l'ultimo messaggio non
 * deve comparire durante un'analisi normale, o mentirebbe come la percentuale
 * che sostituisce.
 */
const MESSAGGI_ATTESA = [
  { dopoMs: 0, testo: 'Ci vogliono una ventina di secondi.' },
  { dopoMs: 10_000, testo: 'Sto leggendo colore, tessuto e lavaggio.' },
  { dopoMs: 35_000, testo: 'Ci sta mettendo più del solito. Resto qui finché non finisce.' },
]

/** Oltre questo tempo l'analisi di una singola foto viene abortita: un
 * `avviaAnalisi` che si impianta non deve lasciare l'utente bloccato per
 * sempre sulla schermata di attesa. */
const TIMEOUT_ANALISI_MS = 120_000

type Fase = 'scatta' | 'analisi'

/** Quante foto si possono scegliere in un colpo solo dalla galleria — il
 * limite di `selectionLimit`, non più scritto anche nell'etichetta di un
 * bottone: il numero non dice a nessuno cosa succederà dopo. */
const LIMITE_BLOCCO = 20

interface FotoInCoda {
  /** Un id proprio, non l'uri: scegliere la stessa foto due volte dalla
   * galleria (due giri separati) darebbe due uri identici, e con l'uri come
   * chiave togliere una delle due toglierebbe entrambe. */
  id: string
  uri: string
}

let contatoreFoto = 0

export default function Carica() {
  const { avvisa, registraCapo } = useArmadio()
  const [fase, setFase] = useState<Fase>('scatta')
  const [foto, setFoto] = useState<string | null>(null)
  /** Il controller della foto singola in analisi, per il tocco su «Annulla».
   * Un ref, non uno stato: serve solo a un gestore di eventi, mai al render. */
  const controllerAnalisiRef = useRef<AbortController | null>(null)
  /** Distingue un abort voluto («Annulla») da un timeout scaduto: il primo
   * non deve mostrare l'avviso «sta prendendo troppo». */
  const annullataRef = useRef(false)
  /** Lo stesso, per la coda: il controller della foto che sta analizzando in
   * questo momento (uno per volta, sostituito a ogni giro del `for`), e il
   * flag che dice se è stata l'utente a fermarla — prima non esisteva un modo
   * di interrompere una coda di venti foto una volta partita. */
  const controllerCodaRef = useRef<AbortController | null>(null)
  const annullataCodaRef = useRef(false)
  const [immagineCopertinaFallita, setImmagineCopertinaFallita] = useState(false)
  /** Le foto scattate o scelte, in attesa di «Analizza»: si può togliere
   * quella sbagliata prima di partire, cosa che il vecchio bottone «20 in
   * blocco» — diretto in analisi appena scelte le foto — non permetteva. */
  const [coda, setCoda] = useState<FotoInCoda[]>([])
  const [analizzandoCoda, setAnalizzandoCoda] = useState(false)
  const [progressoCoda, setProgressoCoda] = useState<{
    totale: number
    riuscite: number
    fallite: number
  } | null>(null)

  async function scattaUnaFoto() {
    const permesso = await ImagePicker.requestCameraPermissionsAsync()
    if (!permesso.granted) {
      avvisa('Senza accesso alla fotocamera non posso leggere il capo.')
      return
    }
    const esito = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (esito.canceled || !esito.assets[0]) return
    avvisa(null)
    // Si può toccare «Scatta» di nuovo per il capo successivo: è
    // l'acquisizione multipla dalla fotocamera che prima non esisteva.
    setCoda((precedente) => [
      ...precedente,
      { id: `foto-${(contatoreFoto += 1)}`, uri: esito.assets[0]!.uri },
    ])
  }

  async function scegliDallaGalleria() {
    const permesso = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permesso.granted) {
      avvisa('Senza accesso alle foto non posso leggere i capi.')
      return
    }
    const esito = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: LIMITE_BLOCCO,
    })
    if (esito.canceled || esito.assets.length === 0) return
    avvisa(null)
    setCoda((precedente) => [
      ...precedente,
      ...esito.assets.map((scatto) => ({ id: `foto-${(contatoreFoto += 1)}`, uri: scatto.uri })),
    ])
  }

  function rimuoviDallaCoda(id: string) {
    setCoda((precedente) => precedente.filter((f) => f.id !== id))
  }

  /** Una sola foto in coda: il percorso di sempre, invariato — attesa
   * indeterminata (`AttesaLunga`), poi il dettaglio per confermare gli
   * attributi letti. Una sola `statoAnalisi`, non un polling: il backend
   * esegue la pipeline in linea (`handlers/analisi.py`) e risponde già
   * terminale alla prima chiamata — la stessa ragione per cui `analizzaCoda`,
   * sotto, non ha mai fatto polling. */
  async function analizzaUnaFoto(uri: string) {
    setCoda([])
    setFoto(uri)
    setFase('analisi')
    annullataRef.current = false
    const controller = new AbortController()
    controllerAnalisiRef.current = controller
    const scadenza = setTimeout(() => controller.abort(), TIMEOUT_ANALISI_MS)
    try {
      const firma = await api.firmaUpload('image/jpeg')
      await api.caricaFoto(firma, uri)
      const avviata = await api.avviaAnalisi(firma.chiave, controller.signal)
      const stato = await api.statoAnalisi(avviata.esecuzione_id, controller.signal)

      if (stato.stato === 'completata' && stato.capo) {
        registraCapo(stato.capo)
        setFase('scatta')
        setFoto(null)
        router.push(`/capo/${stato.capo.id}`)
        return
      }
      avvisa(stato.errore ?? "L'analisi non è riuscita: riprova con più luce.")
      setFase('scatta')
    } catch (errore) {
      if (annullataRef.current) return
      avvisa(
        controller.signal.aborted
          ? "L'analisi sta prendendo troppo: riprova."
          : messaggioDiErrore(errore, 'Caricamento non riuscito'),
      )
      setFase('scatta')
    } finally {
      clearTimeout(scadenza)
      controllerAnalisiRef.current = null
    }
  }

  /** «Annulla» durante l'attesa: aborta la richiesta in corso e torna subito
   * alla schermata di scatto, senza l'avviso di timeout — è un abort voluto,
   * non un'analisi impantanata. L'upload della foto (`api.caricaFoto`, via
   * `expo-file-system`) non prende un segnale di abort: se si annulla mentre
   * carica, l'upload prosegue in background finché non finisce da solo (o
   * scade il suo stesso timeout), ma l'utente è già tornato alla schermata
   * di scatto — non se ne accorge. */
  function annullaAnalisi() {
    annullataRef.current = true
    controllerAnalisiRef.current?.abort()
    setFase('scatta')
    setFoto(null)
  }

  /**
   * Più foto in coda: una analisi per volta, ognuna con le sue tre chiamate
   * (upload, avvio, stato). Il backend le esegue in linea
   * (`handlers/analisi.py`), quindi `statoAnalisi` risponde già «completata»
   * alla prima chiamata — niente polling qui, e ogni capo entra in armadio
   * (`registraCapo`) appena la sua foto finisce, uno alla volta, senza
   * aspettare le altre e senza riavviare l'app per vederlo.
   *
   * Una foto che fallisce non ferma le successive: diventa un conteggio nel
   * messaggio finale, non un'interruzione a metà coda — un timeout scaduto
   * (`TIMEOUT_ANALISI_MS`, un controller per foto) è solo un altro modo di
   * fallire, non un'interruzione dell'intera coda: con `analizzandoCoda`
   * a `true` ogni bottone della schermata resta nascosto, e una foto
   * impantanata senza questo timeout bloccherebbe l'utente lì per sempre.
   *
   * `annullataCodaRef` è il modo in cui `annullaCoda()` ferma tutto questo
   * dall'esterno: controlla il flag a ogni giro (per non partire con la foto
   * successiva) e aborta il controller della foto in corso (per fermare
   * anche quella, non solo le prossime).
   */
  async function analizzaCoda(uris: string[]) {
    setAnalizzandoCoda(true)
    annullataCodaRef.current = false
    let riuscite = 0
    let fallite = 0
    setProgressoCoda({ totale: uris.length, riuscite, fallite })

    for (const uri of uris) {
      if (annullataCodaRef.current) break
      const controller = new AbortController()
      controllerCodaRef.current = controller
      const scadenza = setTimeout(() => controller.abort(), TIMEOUT_ANALISI_MS)
      try {
        const firma = await api.firmaUpload('image/jpeg')
        await api.caricaFoto(firma, uri)
        const avviata = await api.avviaAnalisi(firma.chiave, controller.signal)
        const stato = await api.statoAnalisi(avviata.esecuzione_id, controller.signal)
        if (stato.stato === 'completata' && stato.capo) {
          registraCapo(stato.capo)
          riuscite += 1
        } else if (!annullataCodaRef.current) {
          fallite += 1
        }
      } catch {
        if (!annullataCodaRef.current) fallite += 1
      } finally {
        clearTimeout(scadenza)
      }
      if (!annullataCodaRef.current) setProgressoCoda({ totale: uris.length, riuscite, fallite })
    }
    controllerCodaRef.current = null

    avvisa(
      annullataCodaRef.current
        ? `Fermato: ${conta(riuscite, 'capo aggiunto', 'capi aggiunti')} prima di interrompere.`
        : `${conta(riuscite, 'capo aggiunto', 'capi aggiunti')}` +
            (fallite > 0 ? `, ${conta(fallite, 'non riuscito', 'non riusciti')}` : ''),
    )
    setCoda([])
    setProgressoCoda(null)
    setAnalizzandoCoda(false)
    if (riuscite > 0) router.push('/(tabs)/armadio')
  }

  /** «Annulla la coda»: stessa idea di `annullaAnalisi`, sulla foto in corso
   * nel `for` di `analizzaCoda` invece che sull'unica foto di `analizzaUnaFoto`. */
  function annullaCoda() {
    annullataCodaRef.current = true
    controllerCodaRef.current?.abort()
  }

  function analizza() {
    if (coda.length === 0 || analizzandoCoda) return
    if (coda.length === 1) void analizzaUnaFoto(coda[0]!.uri)
    else void analizzaCoda(coda.map((f) => f.uri))
  }

  return (
    <Schermata occhiello="Nuovo capo" titolo="Aggiungi" tab>
      {fase === 'scatta' ? (
        <>
          <SchedaFoto raggio={raggi.grande} ombra="nessuna" sfondo={colori.inchiostro} style={{ height: 430 }}>
            {!immagineCopertinaFallita ? (
              <Image
                source={{ uri: 'https://images.pexels.com/photos/18257675/pexels-photo-18257675.jpeg?auto=compress&cs=tinysrgb&w=700&h=900&fit=crop' }}
                style={{ position: 'absolute', inset: 0, opacity: 0.5 }}
                contentFit="cover"
                onError={() => setImmagineCopertinaFallita(true)}
              />
            ) : (
              // Senza rete l'immagine non arriva mai: prima restava un
              // rettangolo nero e basta. Un'icona non è la foto vera, ma
              // dice che il vuoto è voluto, non un difetto.
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Icona nome="fotocamera" misura={64} colore="rgba(255,253,249,0.28)" spessore={1.4} />
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                inset: 22,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: 'rgba(255,253,249,0.45)',
                borderRadius: 22,
              }}
            />
            <LinearGradient
              colors={['rgba(21,21,26,0)', 'rgba(21,21,26,0.85)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, gap: 5 }}
            >
              <Titolo taglia={21} colore={colori.scheda}>
                Un capo per foto
              </Titolo>
              <Corpo taglia={13} colore="rgba(255,253,249,0.78)">
                {'Steso sul letto o appeso, con la luce che hai. Non serve altro: al resto pensa il modello.'}
              </Corpo>
            </LinearGradient>
          </SchedaFoto>

          {!analizzandoCoda ? (
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <BottonePrimario
                testo="Scatta"
                icona="fotocamera"
                style={{ flex: 1 }}
                onPress={() => void scattaUnaFoto()}
              />
              <BottoneSecondario testo="Dalla galleria" style={{ flex: 1 }} onPress={() => void scegliDallaGalleria()} />
            </View>
          ) : null}

          {coda.length > 0 ? (
            <View style={{ gap: spazi.s }}>
              <Etichetta taglia={11} tono="debole">
                {conta(coda.length, 'capo in coda', 'capi in coda')}
              </Etichetta>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
                {coda.map((voce) => (
                  <MiniaturaFoto
                    key={voce.id}
                    uri={voce.uri}
                    onRimuovi={analizzandoCoda ? undefined : () => rimuoviDallaCoda(voce.id)}
                  />
                ))}
              </View>

              {!analizzandoCoda ? (
                <BottonePrimario testo={`Analizza ${conta(coda.length, 'capo', 'capi')}`} onPress={analizza} />
              ) : (
                // Prima l'unico segnale, per una coda che può durare minuti,
                // era una riga di testo sotto un bottone che girava. Stessa
                // attesa onesta di una foto sola (`AttesaLunga`), rimontata a
                // ogni capo (la `key`) così i suoi messaggi ripartono da
                // capo — e un modo vero di fermarsi a metà, che prima non
                // esisteva.
                <Scheda imbottitura={18} style={{ gap: spazi.m }}>
                  {progressoCoda ? (
                    <Corpo taglia={13} tono="medio" style={{ textAlign: 'center' }}>
                      {`Sto guardando il capo ${progressoCoda.riuscite + progressoCoda.fallite + 1} di ${progressoCoda.totale}`}
                    </Corpo>
                  ) : null}
                  <AttesaLunga
                    key={progressoCoda ? progressoCoda.riuscite + progressoCoda.fallite : 0}
                    messaggi={MESSAGGI_ATTESA}
                  />
                  <BottoneSecondario testo="Annulla la coda" onPress={annullaCoda} />
                </Scheda>
              )}
            </View>
          ) : null}

          <Corpo taglia={11} tono="debole" style={{ textAlign: 'center', paddingHorizontal: spazi.m }}>
            {
              "Se lo sfondo non viene via bene: su iPhone, tieni premuto sul capo in Foto e scegli «Copia soggetto», oppure in File tocca a lungo la foto e scegli «Rimuovi sfondo». In alternativa un sito come remove.bg."
            }
          </Corpo>
        </>
      ) : null}

      {fase === 'analisi' ? (
        <>
          <SchedaFoto raggio={raggi.grande} ombra="nessuna" sfondo={colori.inchiostro} style={{ height: 390 }}>
            {foto ? (
              <Image source={{ uri: foto }} style={{ flex: 1 }} contentFit="cover" />
            ) : null}
          </SchedaFoto>

          <Titolo taglia={24}>Sto guardando il capo</Titolo>

          <AttesaLunga messaggi={MESSAGGI_ATTESA} />

          <BottoneSecondario testo="Annulla" onPress={annullaAnalisi} />
        </>
      ) : null}
    </Schermata>
  )
}
