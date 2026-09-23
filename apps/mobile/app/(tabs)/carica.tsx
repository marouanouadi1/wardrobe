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
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { View } from 'react-native'
import { messaggioDiErrore } from '../../src/dati/api'
import { useArmadio } from '../../src/dati/archivio'
import { analizzaCaricata, analizzaFoto } from '../../src/dati/foto'
import { attributiIncerti } from '../../src/dati/dominio'
import { conta } from '../../src/dati/formato'
import { colori, raggi, spazi, velature, velo } from '../../src/tema/tokens'
import { Bolla, BottonePrimario, BottoneSecondario, LinkTesto, Scheda } from '../../src/ui/base'
import { MiniaturaFoto, PiedeFoto, RigaFotoInCoda, SchedaFoto } from '../../src/ui/capi'
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

type Fase = 'scatta' | 'permessi' | 'analisi' | 'errore'

/** Quante foto si possono scegliere in un colpo solo dalla galleria — il
 * limite di `selectionLimit`, non più scritto anche nell'etichetta di un
 * bottone: il numero non dice a nessuno cosa succederà dopo. */
const LIMITE_BLOCCO = 20

/** Dove si trova una foto nel suo viaggio: la coda le mostra una per una. */
type StatoFoto = 'attesa' | 'incorso' | 'fatto' | 'fallito'

interface FotoInCoda {
  /** Un id proprio, non l'uri: scegliere la stessa foto due volte dalla
   * galleria (due giri separati) darebbe due uri identici, e con l'uri come
   * chiave togliere una delle due toglierebbe entrambe. */
  id: string
  uri: string
  stato: StatoFoto
  /** La chiave sul server, appena la foto è salita. Serve a **riprovare senza
   * ricaricare**: quando la lettura fallisce la foto è già là, e rimandarla
   * farebbe pagare all'utente, in tempo e in dati, un errore che non è suo. */
  chiave?: string
  /** Il nome che il modello ha letto. Prima non esiste: non si indovina. */
  nome?: string
  /** Perché questa non è andata. Prima il motivo si perdeva: i falliti erano
   * un numero in un coriandolo alla fine, senza dire **quale**. */
  nota?: string
}

let contatoreFoto = 0

export default function Carica() {
  const { avvisa, capi, registraCapo } = useArmadio()
  const [fase, setFase] = useState<Fase>('scatta')
  const [foto, setFoto] = useState<string | null>(null)
  /** Cosa è andato storto sull'unica foto, e se la sua copia è già sul server.
   * Prima era un coriandolo che spariva da solo: il motivo si perdeva mentre
   * lo si leggeva, e l'unica via d'uscita era rifare tutto da capo. */
  const [guasto, setGuasto] = useState<{ uri: string; chiave?: string; motivo: string } | null>(null)
  /** Quale delle due sorgenti aspetta il permesso: si riprende da lì appena
   * l'utente ha detto sì al sistema. */
  const [permessoPer, setPermessoPer] = useState<'fotocamera' | 'galleria' | null>(null)
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
  /** Le foto scattate o scelte, in attesa di «Analizza»: si può togliere
   * quella sbagliata prima di partire, cosa che il vecchio bottone «20 in
   * blocco» — diretto in analisi appena scelte le foto — non permetteva. */
  const [coda, setCoda] = useState<FotoInCoda[]>([])
  const [analizzandoCoda, setAnalizzandoCoda] = useState(false)
  /** Vero quando la coda ha finito e le sue righe raccontano com'è andata:
   * la schermata **resta lì**, invece di scaricare l'utente sull'armadio con
   * un coriandolo che dice solo quante ne sono fallite. */
  const [codaFinita, setCodaFinita] = useState(false)

  /** Cambia lo stato di **una** foto, lasciando le altre dove sono. */
  function aggiorna(id: string, campi: Partial<FotoInCoda>) {
    setCoda((precedente) => precedente.map((f) => (f.id === id ? { ...f, ...campi } : f)))
  }

  /**
   * La schermata `permessi` del deck, e **il momento in cui ha senso**: non
   * una tappa dell'onboarding, dove il sistema non mostrerebbe comunque
   * niente, ma il primo tocco su «Scatta» o «Dalla galleria».
   *
   * Lo stato «mai chiesto» lo dice il sistema operativo (`undetermined`), non
   * un flag che dobbiamo salvare e tenere sincronizzato: se il prompt è già
   * comparso una volta, spiegare di nuovo sarebbe una schermata in mezzo fra
   * l'utente e il suo scatto.
   */
  async function conPermesso(chi: 'fotocamera' | 'galleria', poi: () => Promise<void>) {
    const attuale =
      chi === 'fotocamera'
        ? await ImagePicker.getCameraPermissionsAsync()
        : await ImagePicker.getMediaLibraryPermissionsAsync()
    if (attuale.status === 'undetermined') {
      setPermessoPer(chi)
      setFase('permessi')
      return
    }
    await poi()
  }

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
      { id: `foto-${(contatoreFoto += 1)}`, uri: esito.assets[0]!.uri, stato: 'attesa' as const },
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
      ...esito.assets.map((scatto) => ({
        id: `foto-${(contatoreFoto += 1)}`,
        uri: scatto.uri,
        stato: 'attesa' as const,
      })),
    ])
  }

  function rimuoviDallaCoda(id: string) {
    setCoda((precedente) => precedente.filter((f) => f.id !== id))
  }

  /** Una sola foto in coda: il percorso di sempre, invariato — attesa
   * indeterminata (`AttesaLunga`), poi il dettaglio per confermare gli
   * attributi letti. La sequenza sta in `src/dati/foto.ts`, che dice anche
   * perché non c'è polling e cosa il segnale di abort **non** copre. */
  async function analizzaUnaFoto(uri: string, chiaveGiaCaricata?: string) {
    setGuasto(null)
    setCoda([])
    setFoto(uri)
    setFase('analisi')
    annullataRef.current = false
    const controller = new AbortController()
    controllerAnalisiRef.current = controller
    const scadenza = setTimeout(() => controller.abort(), TIMEOUT_ANALISI_MS)
    try {
      // Un secondo tentativo riparte dall'analisi: la foto è già sul server.
      const { chiave, esito } = chiaveGiaCaricata
        ? { chiave: chiaveGiaCaricata, esito: await analizzaCaricata(chiaveGiaCaricata, controller.signal) }
        : await analizzaFoto(uri, controller.signal)

      if (esito.stato === 'completata' && esito.capo) {
        registraCapo(esito.capo)
        setFase('scatta')
        setFoto(null)
        router.push(`/capo/${esito.capo.id}`)
        return
      }
      // Il motivo arriva come **testo**, non come codice (`EsitoAnalisi.errore`):
      // si mostra, non si interpreta. Il deck ha due schermate d'errore
      // distinte — sfondo non staccato, lettura fallita — ma l'app non può
      // distinguerle: discriminare sul messaggio è ciò che
      // `.claude/rules/python.md` vieta. Una sola, col motivo che è arrivato.
      setGuasto({ uri, chiave, motivo: esito.errore ?? "Non sono riuscito a leggerla." })
      setFase('errore')
    } catch (errore) {
      if (annullataRef.current) return
      setGuasto({
        uri,
        chiave: chiaveGiaCaricata,
        motivo: controller.signal.aborted
          ? "Ci ha messo troppo e mi sono fermato."
          : messaggioDiErrore(errore, 'Caricamento non riuscito'),
      })
      setFase('errore')
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
   * Più foto in coda: una analisi per volta (`analizzaFoto`, `src/dati/foto.ts`),
   * e ogni capo entra in armadio (`registraCapo`) appena la sua foto finisce —
   * uno alla volta, senza aspettare le altre e senza riavviare l'app.
   *
   * **Ogni foto porta il proprio esito**, invece di due contatori. Prima una
   * che falliva diventava `fallite += 1`, e il motivo si perdeva: alla fine un
   * coriandolo diceva «2 non riusciti» senza dire *quali* — con venti foto in
   * coda, non c'era modo di sapere cosa rifare.
   *
   * Una foto che fallisce non ferma le successive; un timeout scaduto
   * (`TIMEOUT_ANALISI_MS`, un controller per foto) è solo un altro modo di
   * fallire. Senza quel timeout una foto impantanata bloccherebbe l'utente lì
   * per sempre, perché mentre la coda gira i bottoni di scatto non ci sono.
   *
   * `annullataCodaRef` è il modo in cui `annullaCoda()` ferma tutto questo
   * dall'esterno: controlla il flag a ogni giro (per non partire con la foto
   * successiva) e aborta il controller della foto in corso (per fermare
   * anche quella, non solo le prossime). Le foto mai iniziate restano «in
   * coda», che è la verità: non sono fallite, nessuno le ha guardate.
   */
  async function analizzaCoda(daFare: FotoInCoda[]) {
    setAnalizzandoCoda(true)
    setCodaFinita(false)
    annullataCodaRef.current = false

    for (const foto of daFare) {
      if (annullataCodaRef.current) break
      aggiorna(foto.id, { stato: 'incorso' })
      const controller = new AbortController()
      controllerCodaRef.current = controller
      const scadenza = setTimeout(() => controller.abort(), TIMEOUT_ANALISI_MS)
      try {
        // Se questa foto ha già una chiave, è un **secondo** tentativo: si
        // riparte dall'analisi, non dall'upload.
        const { chiave, esito: stato } = foto.chiave
          ? { chiave: foto.chiave, esito: await analizzaCaricata(foto.chiave, controller.signal) }
          : await analizzaFoto(foto.uri, controller.signal)
        aggiorna(foto.id, { chiave })
        if (stato.stato === 'completata' && stato.capo) {
          registraCapo(stato.capo)
          aggiorna(foto.id, { stato: 'fatto', nome: stato.capo.nome })
        } else if (!annullataCodaRef.current) {
          // Il motivo arriva dal backend come **testo**, non come codice
          // (`EsitoAnalisi.errore`): si mostra, non si interpreta. Discriminare
          // sul messaggio è esattamente ciò che `.claude/rules/python.md`
          // vieta, e cambierebbe comportamento alla prima riformulazione.
          aggiorna(foto.id, { stato: 'fallito', nota: stato.errore ?? 'Non sono riuscito a leggerla.' })
        }
      } catch (errore) {
        if (!annullataCodaRef.current) {
          aggiorna(foto.id, {
            stato: 'fallito',
            nota: controller.signal.aborted
              ? 'Ci ha messo troppo.'
              : messaggioDiErrore(errore, 'Caricamento non riuscito'),
          })
        }
      } finally {
        clearTimeout(scadenza)
      }
    }
    controllerCodaRef.current = null
    // Le foto mai iniziate, se si è interrotto a metà: restano «in coda», che
    // è vero — non sono fallite, non sono state guardate.
    setAnalizzandoCoda(false)
    setCodaFinita(true)
  }

  /** «Annulla la coda»: stessa idea di `annullaAnalisi`, sulla foto in corso
   * nel `for` di `analizzaCoda` invece che sull'unica foto di `analizzaUnaFoto`. */
  function annullaCoda() {
    annullataCodaRef.current = true
    controllerCodaRef.current?.abort()
  }

  function analizza() {
    if (coda.length === 0 || analizzandoCoda) return
    // Una foto sola tiene il percorso di sempre — attesa a tutto schermo, poi
    // il dettaglio per confermare cosa il modello ha letto. È la «conferma»
    // del deck, e nell'app è già una schermata: `app/capo/[id].tsx` mostra le
    // confidenze e lascia correggere in linea. Rifarla qui sarebbe una copia.
    if (coda.length === 1) void analizzaUnaFoto(coda[0]!.uri)
    else void analizzaCoda(coda)
  }

  /** Quelle che non sono andate: il bersaglio del «Riprova». */
  const nonRiuscite = coda.filter((f) => f.stato === 'fallito')
  /** Quanti dei capi appena entrati hanno un attributo di cui il modello non
   * era sicuro: il rimando a `/darivedere` compare solo se ce n'è almeno uno. */
  const daRivedere = capi.filter((capo) => attributiIncerti(capo).length > 0).length

  /** Ripulisce le righe finite e riporta la schermata allo scatto. */
  function svuotaCoda() {
    setCoda([])
    setCodaFinita(false)
  }

  return (
    <Schermata occhiello="Nuovo capo" titolo="Aggiungi">
      {fase === 'scatta' ? (
        <>
          <SchedaFoto raggio={raggi.grande} ombra="nessuna" su="scuro" style={{ height: 430 }}>
            {/* Prima una foto Pexels caricata dalla rete a ogni apertura di
                questa schermata — con relativo fallback per quando non
                arrivava. Ora è nel bundle (foto Pexels 18257675, licenza
                Pexels: nessuna attribuzione richiesta), e il fallback non
                serve più: non può più fallire un caricamento che non parte. */}
            <Image
              source={require('../../assets/carica-copertina.jpg')}
              style={{ position: 'absolute', inset: 0, opacity: 0.5 }}
              contentFit="cover"
            />
            <View
              style={{
                position: 'absolute',
                inset: 22,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: velo(colori.scheda, 0.45),
                borderRadius: 22,
              }}
            />
            <PiedeFoto opacita={0.85} style={{ padding: 20, gap: 5 }}>
              <Titolo taglia="sezione">Un capo per foto</Titolo>
              <Corpo taglia="minuto" tono="medio">
                {'Steso sul letto o appeso, con la luce che hai. Non serve altro: al resto pensa il modello.'}
              </Corpo>
            </PiedeFoto>
          </SchedaFoto>

          {!analizzandoCoda ? (
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <BottonePrimario
                testo="Scatta"
                icona="fotocamera"
                style={{ flex: 1 }}
                onPress={() => void conPermesso('fotocamera', scattaUnaFoto)}
              />
              <BottoneSecondario testo="Dalla galleria" style={{ flex: 1 }} onPress={() => void conPermesso('galleria', scegliDallaGalleria)} />
            </View>
          ) : null}

          {coda.length > 0 ? (
            <View style={{ gap: spazi.s }}>
              {!analizzandoCoda && !codaFinita ? (
                // Prima di partire: le miniature con la ✕, per togliere quella
                // sbagliata. Qui una foto non ha ancora niente da raccontare.
                <>
                  <Etichetta taglia="micro" tono="debole">
                    {conta(coda.length, 'capo in coda', 'capi in coda')}
                  </Etichetta>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
                    {coda.map((voce) => (
                      <MiniaturaFoto key={voce.id} uri={voce.uri} onRimuovi={() => rimuoviDallaCoda(voce.id)} />
                    ))}
                  </View>
                  <BottonePrimario testo={`Analizza ${conta(coda.length, 'capo', 'capi')}`} onPress={analizza} />
                </>
              ) : (
                // Da qui in poi ogni foto ha la sua riga e il suo stato — è la
                // schermata `upload` del deck. Prima c'era **un** segnale per
                // tutte, «Sto guardando il capo 3 di 7», e i falliti erano un
                // numero che arrivava tutto insieme alla fine: non si sapeva
                // *quale* foto rifare.
                <>
                  <Etichetta taglia="micro" tono="debole">
                    {codaFinita ? 'Com\'è andata' : conta(coda.length, 'foto in arrivo', 'foto in arrivo')}
                  </Etichetta>
                  {coda.map((voce) => (
                    <RigaFotoInCoda
                      key={voce.id}
                      uri={voce.uri}
                      nome={voce.nome}
                      stato={voce.stato}
                      nota={voce.stato === 'fallito' ? voce.nota : undefined}
                    />
                  ))}
                  {analizzandoCoda ? (
                    <BottoneSecondario testo="Annulla la coda" onPress={annullaCoda} />
                  ) : (
                    // A coda finita la schermata **resta**: le righe dicono
                    // com'è andata, e da qui si sceglie. Prima portava
                    // all'armadio da sola, con un coriandolo che diceva solo
                    // quante ne erano fallite.
                    <View style={{ gap: spazi.s }}>
                      {/* Le non riuscite hanno già la loro chiave sul server:
                          riprovarle non rimanda i byte, riavvia solo la
                          lettura. Sta prima dell'armadio perché è l'azione che
                          chiude la cosa che non ha funzionato. */}
                      {nonRiuscite.length > 0 ? (
                        <BottonePrimario
                          testo={`Riprova ${conta(nonRiuscite.length, 'foto', 'foto')}`}
                          onPress={() => void analizzaCoda(nonRiuscite)}
                        />
                      ) : null}
                      <BottonePrimario
                        testo="Vai all'armadio"
                        chiaro={nonRiuscite.length > 0}
                        onPress={() => {
                          svuotaCoda()
                          router.push('/(tabs)/armadio')
                        }}
                      />
                      <BottoneSecondario testo="Aggiungi altre foto" onPress={svuotaCoda} />
                      {/* «Uno dei capi non è stato riconosciuto bene?» del
                          deck. Compare solo se c'è davvero qualcosa di
                          incerto: `attributiIncerti()` legge la soglia dal
                          dominio, non da un numero scritto qui. */}
                      {daRivedere > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spazi.s }}>
                          <Corpo taglia="micro" tono="debole">
                            {conta(daRivedere, 'capo ha un dettaglio incerto', 'capi hanno un dettaglio incerto')}
                          </Corpo>
                          <LinkTesto
                            centrato={false}
                            sottolineato
                            taglia={12}
                            tono="medio"
                            onPress={() => router.push('/darivedere')}
                          >
                            Correggi
                          </LinkTesto>
                        </View>
                      ) : null}
                    </View>
                  )}
                </>
              )}
            </View>
          ) : null}

          {/* Erano due righe di testo minuto qui in fondo, sotto il bottone
              che si tocca per andarsene: la cosa più tecnica di tutte, detta
              dove nessuno la legge. Ora è una schermata (`/guidafoto`), e
              questa riga è l'unica cosa che resta — la domanda, non la
              risposta. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spazi.s }}>
            <Corpo taglia="micro" tono="debole">
              Lo sfondo non viene via bene?
            </Corpo>
            <LinkTesto centrato={false} sottolineato taglia={12} tono="medio" onPress={() => router.push('/guidafoto')}>
              Come fare
            </LinkTesto>
          </View>
        </>
      ) : null}

      {/* `permessi` del deck: la spiegazione **prima** del prompt di sistema,
          non al posto suo. La richiesta vera resta dove era, al punto d'uso —
          toglierla significherebbe che dopo un «Consenti» non succede niente. */}
      {fase === 'permessi' && permessoPer ? (
        <View style={{ alignItems: 'center', gap: spazi.m, paddingVertical: spazi.xxl }}>
          <Bolla
            nome="fotocamera"
            sfondo={velature.primario}
            colore={colori.primario}
            misura={62}
            misuraIcona={26}
          />
          <Titolo taglia="testata" style={{ textAlign: 'center' }}>
            Fammi vedere i capi
          </Titolo>
          <Corpo taglia="corpo" tono="medio" style={{ textAlign: 'center' }}>
            {permessoPer === 'galleria'
              ? 'Solo le foto che scegli tu, una per capo. Il resto della galleria non lo vedo.'
              : 'Scatti una foto per capo. La fotocamera si apre solo quando la tocchi tu.'}
          </Corpo>
          <BottonePrimario
            testo="Consenti"
            style={{ alignSelf: 'stretch' }}
            onPress={() => {
              const chi = permessoPer
              setPermessoPer(null)
              setFase('scatta')
              void (chi === 'galleria' ? scegliDallaGalleria() : scattaUnaFoto())
            }}
          />
          <BottoneSecondario
            testo="Più tardi"
            style={{ alignSelf: 'stretch' }}
            onPress={() => {
              setPermessoPer(null)
              setFase('scatta')
            }}
          />
        </View>
      ) : null}

      {/* La schermata che il deck chiama `analisiko`, con la copia che il
          backend regge davvero. Il deck ne ha **due** — «non riesco a
          staccare lo sfondo» e «la foto è arrivata, la lettura no» — e l'app
          non può distinguerle: `EsitoAnalisi.errore` è testo libero, senza
          codice, e lo scontorno che fallisce non produce nemmeno un errore
          (`handlers/analisi.py` lo ingoia con un warning e prosegue, ADR 0004).
          Due cose del deck restano fuori di proposito: «compila a mano», che
          non ha un endpoint e non lo avrà, e «è già al sicuro nell'armadio»,
          che è falso — un'analisi fallita non salva niente. */}
      {fase === 'errore' && guasto ? (
        <>
          <SchedaFoto raggio={raggi.grande} ombra="alta" su="chiaro" sfondo={colori.fondoFoto}>
            <Image source={{ uri: guasto.uri }} style={{ width: '100%', height: 300 }} contentFit="contain" />
          </SchedaFoto>

          <View style={{ gap: spazi.s }}>
            <Titolo taglia="testata">Non sono riuscito a leggerla</Titolo>
            <Corpo taglia="corpo" tono="medio">
              {guasto.motivo}
            </Corpo>
          </View>

          {guasto.chiave ? (
            // Vero, e verificabile: la foto sale per URL firmato **prima** che
            // il modello la guardi, quindi a questo punto è già sul server.
            // Riprovare chiama solo `avviaAnalisi` — non rimanda i byte.
            <Scheda su="chiaro" sfondo={velature.primario} imbottitura={spazi.m}>
              <Corpo taglia="minuto" tono="medio">
                {"La foto ce l'ho già: riprovare non la ricarica."}
              </Corpo>
            </Scheda>
          ) : null}

          <BottonePrimario
            testo="Riprova"
            onPress={() => void analizzaUnaFoto(guasto.uri, guasto.chiave)}
          />
          <BottoneSecondario
            testo="Scegline un'altra"
            onPress={() => {
              setGuasto(null)
              setFoto(null)
              setFase('scatta')
            }}
          />
        </>
      ) : null}

      {fase === 'analisi' ? (
        <>
          <SchedaFoto raggio={raggi.grande} ombra="nessuna" su="scuro" style={{ height: 390 }}>
            {foto ? (
              <Image source={{ uri: foto }} style={{ flex: 1 }} contentFit="cover" />
            ) : null}
          </SchedaFoto>

          <Titolo taglia="testata">Sto guardando il capo</Titolo>

          <AttesaLunga messaggi={MESSAGGI_ATTESA} />

          <BottoneSecondario testo="Annulla" onPress={annullaAnalisi} />
        </>
      ) : null}
    </Schermata>
  )
}
