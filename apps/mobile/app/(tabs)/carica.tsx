/**
 * Aggiungere un capo: scatta o scegli, guarda la coda, analizza.
 *
 * «Scatta» e «Dalla galleria» accumulano in una coda — non partono subito:
 * chi ha appena scaricato l'app ha un armadio pieno, non un capo, e prima
 * c'erano due percorsi separati per dirlo (un bottone «Dalla galleria» che
 * prendeva una foto sola, un secondo bottone che ne prendeva fino a venti)
 * più un terzo che non copriva affatto la fotocamera. Una foto sola in coda
 * si comporta come sempre: analisi con la checklist, poi il dettaglio per
 * confermare cosa il modello ha letto. Più foto insieme vanno a un capo per
 * volta, e finiscono in armadio via via che il modello finisce — senza
 * fermarsi alla prima che fallisce.
 */

import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { api, messaggioDiErrore } from '../../src/dati/api'
import { useArmadio } from '../../src/dati/archivio'
import { PALETTE_COLORI, TIPI_CAPO } from '../../src/dati/dominio'
import { conta } from '../../src/dati/formato'
import { ETICHETTE, colori, linee, ombre, raggi, spazi, velo } from '../../src/tema/tokens'
import { BottonePrimario, BottoneSecondario, Campo, Icona, Pillola, Toccabile } from '../../src/ui/base'
import { MiniaturaFoto } from '../../src/ui/capi'
import { Corpo, Etichetta, Forte, Titolo } from '../../src/ui/testo'
import { Schermata } from '../../src/ui/guscio'
import type { TipoCapo } from '@wardrobe/contracts'

const PASSI = [
  { testo: 'Isolo il capo dallo sfondo' },
  { testo: 'Categoria e sottocategoria' },
  { testo: 'Colore dominante' },
  { testo: 'Tessuto e composizione' },
  { testo: 'Etichetta di lavaggio' },
]

type Fase = 'scatta' | 'analisi' | 'manuale'

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
  const { avvisa, creaCapoManuale, registraCapo } = useArmadio()
  const [fase, setFase] = useState<Fase>('scatta')
  const [passo, setPasso] = useState(0)
  const [foto, setFoto] = useState<string | null>(null)
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
  // Il percorso «a mano»: prima di fidarsi del modello, o quando lo scontorno
  // e la lettura automatica non bastano, l'utente compila lui i tre campi
  // che servono perché il capo esista (nome, tipo, colore).
  const [nomeManuale, setNomeManuale] = useState('')
  const [tipoManuale, setTipoManuale] = useState<TipoCapo>('top')
  const [coloreManuale, setColoreManuale] = useState(0)
  const [salvandoManuale, setSalvandoManuale] = useState(false)

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

  /** Una sola foto in coda: il percorso di sempre, invariato — analisi con
   * la checklist, poi il dettaglio per confermare gli attributi letti. */
  async function analizzaUnaFoto(uri: string) {
    setCoda([])
    setFoto(uri)
    setFase('analisi')
    try {
      const firma = await api.firmaUpload('image/jpeg')
      await api.caricaFoto(firma, uri)
      const avviata = await api.avviaAnalisi(firma.chiave)

      for (let tentativo = 0; tentativo < 40; tentativo += 1) {
        const stato = await api.statoAnalisi(avviata.esecuzione_id)
        if (stato.stato === 'completata' && stato.capo) {
          registraCapo(stato.capo)
          setFase('scatta')
          setFoto(null)
          setPasso(0)
          router.push(`/capo/${stato.capo.id}`)
          return
        }
        if (stato.stato === 'fallita') {
          avvisa(stato.errore ?? "L'analisi non è riuscita: riprova con più luce.")
          setFase('scatta')
          setPasso(0)
          return
        }
        setPasso((precedente) => Math.min(precedente + 1, PASSI.length))
        await new Promise((risolvi) => setTimeout(risolvi, 1200))
      }
      avvisa("L'analisi sta prendendo troppo: la trovi in armadio quando finisce.")
      setFase('scatta')
      setPasso(0)
    } catch (errore) {
      avvisa(messaggioDiErrore(errore, 'Caricamento non riuscito'))
      setFase('scatta')
      setPasso(0)
    }
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
   * messaggio finale, non un'interruzione a metà coda.
   */
  async function analizzaCoda(uris: string[]) {
    setAnalizzandoCoda(true)
    let riuscite = 0
    let fallite = 0
    setProgressoCoda({ totale: uris.length, riuscite, fallite })

    for (const uri of uris) {
      try {
        const firma = await api.firmaUpload('image/jpeg')
        await api.caricaFoto(firma, uri)
        const avviata = await api.avviaAnalisi(firma.chiave)
        const stato = await api.statoAnalisi(avviata.esecuzione_id)
        if (stato.stato === 'completata' && stato.capo) {
          registraCapo(stato.capo)
          riuscite += 1
        } else {
          fallite += 1
        }
      } catch {
        fallite += 1
      }
      setProgressoCoda({ totale: uris.length, riuscite, fallite })
    }

    avvisa(
      `${conta(riuscite, 'capo aggiunto', 'capi aggiunti')}` +
        (fallite > 0 ? `, ${conta(fallite, 'non riuscito', 'non riusciti')}` : ''),
    )
    setCoda([])
    setProgressoCoda(null)
    setAnalizzandoCoda(false)
    if (riuscite > 0) router.push('/(tabs)/armadio')
  }

  function analizza() {
    if (coda.length === 0 || analizzandoCoda) return
    if (coda.length === 1) void analizzaUnaFoto(coda[0]!.uri)
    else void analizzaCoda(coda.map((f) => f.uri))
  }

  /** Prima di fidarsi del modello: una foto sola, dritta al modulo a mano —
   * non passa dalla coda, non ha senso metterla in fila con le altre. */
  async function avviaManuale() {
    const permesso = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permesso.granted) {
      avvisa('Senza accesso alle foto non posso leggere il capo.')
      return
    }
    const esito = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] })
    if (esito.canceled || !esito.assets[0]) return
    avvisa(null)
    setFoto(esito.assets[0].uri)
    setFase('manuale')
  }

  /** Inserisce il capo a mano: nessuna pipeline, nessuna confidenza da correggere dopo. */
  async function salvaManuale() {
    if (!foto || salvandoManuale) return
    setSalvandoManuale(true)
    try {
      const paletta = PALETTE_COLORI[coloreManuale]!
      const firma = await api.firmaUpload('image/jpeg')
      await api.caricaFoto(firma, foto)

      await creaCapoManuale({
        nome: nomeManuale.trim() || `${ETICHETTE.tipo[tipoManuale]} ${paletta.nome.toLowerCase()}`,
        tipo: tipoManuale,
        colore: { nome: paletta.nome, hex: paletta.hex },
        chiave_foto: firma.chiave,
      })
      avvisa(null)
      setFase('scatta')
      setFoto(null)
      setNomeManuale('')
      router.push('/(tabs)/armadio')
    } catch (errore) {
      avvisa(messaggioDiErrore(errore, 'Capo non salvato'))
    } finally {
      setSalvandoManuale(false)
    }
  }

  return (
    <Schermata occhiello="Nuovo capo" titolo="Aggiungi" tab>
      {fase === 'scatta' ? (
        <>
          <View
            style={{
              height: 430,
              borderRadius: raggi.grande,
              overflow: 'hidden',
              backgroundColor: colori.inchiostro,
            }}
          >
            <Image
              source={{ uri: 'https://images.pexels.com/photos/18257675/pexels-photo-18257675.jpeg?auto=compress&cs=tinysrgb&w=700&h=900&fit=crop' }}
              style={{ position: 'absolute', inset: 0, opacity: 0.5 }}
              contentFit="cover"
            />
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
          </View>

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
              <BottonePrimario
                testo={`Analizza ${conta(coda.length, 'capo', 'capi')}`}
                caricando={analizzandoCoda}
                onPress={analizza}
              />
              {progressoCoda ? (
                <Corpo taglia={12.5} tono="tenue" style={{ textAlign: 'center' }}>
                  {`Sto analizzando · ${progressoCoda.riuscite + progressoCoda.fallite} di ${progressoCoda.totale}`}
                </Corpo>
              ) : null}
            </View>
          ) : null}

          {!analizzandoCoda ? (
            <Toccabile onPress={() => void avviaManuale()} scala={0} style={{ alignItems: 'center' }}>
              <Forte taglia={12.5} colore={colori.inchiostro} style={{ textDecorationLine: 'underline' }}>
                Preferisco inserirlo a mano
              </Forte>
            </Toccabile>
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
          <View
            style={{
              height: 390,
              borderRadius: raggi.grande,
              overflow: 'hidden',
              backgroundColor: colori.inchiostro,
            }}
          >
            {foto ? (
              <Image source={{ uri: foto }} style={{ flex: 1 }} contentFit="cover" />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spazi.s }}>
            <Titolo taglia={24} style={{ flex: 1 }}>
              Sto guardando il capo
            </Titolo>
            <Forte taglia={13} colore={colori.ambraMedio}>
              {Math.round((passo / PASSI.length) * 100)}%
            </Forte>
          </View>

          <View style={{ height: 6, borderRadius: raggi.pillola, backgroundColor: linee.media }}>
            <View
              style={{
                height: 6,
                borderRadius: raggi.pillola,
                width: `${(passo / PASSI.length) * 100}%`,
                backgroundColor: colori.ambra,
              }}
            />
          </View>

          <View style={{ gap: 9 }}>
            {PASSI.map((voce, indice) => {
              const fatto = indice < passo
              const inCorso = indice === passo
              return (
                <View
                  key={voce.testo}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingHorizontal: 15,
                    paddingVertical: 13,
                    borderRadius: 18,
                    backgroundColor: fatto
                      ? velo(colori.ambra, 0.22)
                      : inCorso
                        ? colori.scheda
                        : 'rgba(21,21,26,0.04)',
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: raggi.pillola,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: fatto
                        ? colori.ambra
                        : inCorso
                          ? velo(colori.ambra, 0.55)
                          : 'rgba(21,21,26,0.12)',
                    }}
                  >
                    {fatto ? <Icona nome="spunta" misura={11} spessore={3.4} /> : null}
                  </View>
                  <Forte taglia={13.5} tono={fatto || inCorso ? 'forte' : 'debole'} style={{ flex: 1 }}>
                    {voce.testo}
                  </Forte>
                </View>
              )
            })}
          </View>
        </>
      ) : null}

      {fase === 'manuale' ? (
        <>
          <View
            style={{
              height: 260,
              borderRadius: raggi.grande,
              overflow: 'hidden',
              backgroundColor: colori.inchiostro,
            }}
          >
            {foto ? (
              <Image source={{ uri: foto }} style={{ flex: 1 }} contentFit="cover" />
            ) : null}
          </View>

          <Titolo taglia={22}>Di cosa si tratta?</Titolo>
          <Corpo taglia={12.5} tono="tenue">
            Tre cose bastano per farlo esistere in armadio: le altre le aggiungi quando vuoi,
            dal dettaglio del capo.
          </Corpo>

          <View style={{ gap: spazi.s }}>
            <Etichetta taglia={11} tono="debole">
              Categoria
            </Etichetta>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {TIPI_CAPO.map((tipo) => (
                <Pillola
                  key={tipo}
                  testo={ETICHETTE.tipo[tipo]}
                  attiva={tipo === tipoManuale}
                  onPress={() => setTipoManuale(tipo)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spazi.s }}>
            <Etichetta taglia={11} tono="debole">
              Colore
            </Etichetta>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {PALETTE_COLORI.map((voce, indice) => (
                <Toccabile
                  key={voce.nome}
                  onPress={() => setColoreManuale(indice)}
                  scala={0.94}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: raggi.pillola,
                    backgroundColor: voce.hex,
                    borderWidth: indice === coloreManuale ? 3 : 1,
                    borderColor: indice === coloreManuale ? colori.ambra : linee.chiara,
                  }}
                >
                  <View />
                </Toccabile>
              ))}
            </View>
            <Corpo taglia={12} tono="tenue">
              {PALETTE_COLORI[coloreManuale]!.nome}
            </Corpo>
          </View>

          <Campo
            etichetta="Nome (facoltativo)"
            value={nomeManuale}
            onChangeText={setNomeManuale}
            placeholder={`${ETICHETTE.tipo[tipoManuale]} ${PALETTE_COLORI[coloreManuale]!.nome.toLowerCase()}`}
          />

          <BottonePrimario
            testo="Salva nell'armadio"
            caricando={salvandoManuale}
            disabilitato={salvandoManuale}
            onPress={() => void salvaManuale()}
          />
          <BottoneSecondario
            testo="Annulla"
            onPress={() => {
              setFase('scatta')
              setFoto(null)
            }}
            style={{ borderColor: linee.chiara, ...ombre.bassa }}
          />
        </>
      ) : null}
    </Schermata>
  )
}
