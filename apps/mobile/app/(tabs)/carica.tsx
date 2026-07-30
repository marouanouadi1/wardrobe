/**
 * Aggiungere un capo: scatta, guarda cosa ha capito, salva.
 *
 * La schermata mostra i passi dell'analisi uno per uno mentre avvengono. Non è
 * decorazione: l'attesa di un modello di visione è di secondi, e vedere «sto
 * leggendo l'etichetta di lavaggio» rende quei secondi comprensibili invece che
 * sospetti. Ed è anche il momento in cui l'utente capisce cosa sa fare l'app.
 */

import type { LetturaCapo, TipoCapo } from '@wardrobe/contracts'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { MODALITA_DEMO, api } from '../../src/dati/api'
import { useArmadio } from '../../src/dati/archivio'
import { PALETTE_COLORI } from '../../src/dati/dominio'
import { ETICHETTE, colori, linee, ombre, raggi, spazi } from '../../src/tema/tokens'
import { BadgeIa, BottonePrimario, BottoneSecondario, Icona, Pillola, Toccabile } from '../../src/ui/base'
import { Attributo } from '../../src/ui/capi'
import { Corpo, Etichetta, Forte, Titolo } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

const TIPI: TipoCapo[] = ['top', 'pantaloni', 'scarpe', 'capospalla', 'abito', 'accessorio']

const PASSI = [
  { testo: 'Isolo il capo dallo sfondo', esito: 'fatto' },
  { testo: 'Categoria e sottocategoria', esito: 'Top · camicia' },
  { testo: 'Colore dominante', esito: 'Panna' },
  { testo: 'Tessuto e composizione', esito: 'Lino 100%' },
  { testo: 'Etichetta di lavaggio', esito: '40°' },
]

type Fase = 'scatta' | 'analisi' | 'esito' | 'manuale'

/** Quante foto si possono mandare in una volta, come nel design. */
const LIMITE_BLOCCO = 20

/** La lettura mostrata in demo: quella vera arriva dal modello. */
const LETTURA_DEMO: LetturaCapo = {
  tipo: 'top',
  sottotipo: 'camicia',
  nome_proposto: 'Camicia in lino',
  colore: { nome: 'Panna', hex: '#E7DFD2' },
  materiale: 'Lino 100%',
  fantasia: 'Tinta unita',
  stagione: 'estate',
  vestibilita: 'Oversize',
  lavaggio: '40° stira umida',
  confidenze: { tipo: 96, colore: 94, materiale: 88, fantasia: 90, stagione: 80, vestibilita: 72, lavaggio: 85 },
}

export default function Carica() {
  const { avvisa, creaCapoManuale } = useArmadio()
  const [fase, setFase] = useState<Fase>('scatta')
  const [passo, setPasso] = useState(0)
  const [foto, setFoto] = useState<string | null>(null)
  const [lettura, setLettura] = useState<LetturaCapo | null>(null)
  /** Quante foto restano da mandare nell'analisi in blocco. */
  const [inBlocco, setInBlocco] = useState<number | null>(null)
  // Il percorso «a mano»: prima di fidarsi del modello, o quando lo scontorno
  // e la lettura automatica non bastano, l'utente compila lui i tre campi
  // che servono perché il capo esista (nome, tipo, colore).
  const [nomeManuale, setNomeManuale] = useState('')
  const [tipoManuale, setTipoManuale] = useState<TipoCapo>('top')
  const [coloreManuale, setColoreManuale] = useState(0)
  const [salvandoManuale, setSalvandoManuale] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timer.current.forEach(clearTimeout), [])

  const simulaPassi = useCallback(() => {
    setFase('analisi')
    setPasso(0)
    timer.current = PASSI.map((_, indice) =>
      setTimeout(() => setPasso(indice + 1), 420 * (indice + 1)),
    )
    timer.current.push(
      setTimeout(() => {
        setLettura(LETTURA_DEMO)
        setFase('esito')
      }, 420 * (PASSI.length + 1)),
    )
  }, [])

  async function scegliFoto(dallaFotocamera: boolean, percorso: 'auto' | 'manuale' = 'auto') {
    const permesso = dallaFotocamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permesso.granted) {
      avvisa('Senza accesso alla fotocamera non posso leggere il capo.')
      return
    }

    const esito = dallaFotocamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] })
    if (esito.canceled || !esito.assets[0]) return

    setFoto(esito.assets[0].uri)

    if (percorso === 'manuale') {
      setFase('manuale')
      return
    }

    if (MODALITA_DEMO) {
      simulaPassi()
      return
    }

    // Con il backend collegato: URL firmato, PUT diretta a S3, poi la pipeline.
    // La foto non passa dal nostro server — vedi docs/adr/0003.
    setFase('analisi')
    try {
      const firma = await api.firmaUpload('image/jpeg')
      const contenuto = await (await fetch(esito.assets[0].uri)).blob()
      await api.caricaFoto(firma, contenuto)
      const avviata = await api.avviaAnalisi(firma.chiave)

      for (let tentativo = 0; tentativo < 40; tentativo += 1) {
        const stato = await api.statoAnalisi(avviata.esecuzione_id)
        if (stato.stato === 'completata' && stato.capo) {
          router.replace(`/capo/${stato.capo.id}`)
          return
        }
        if (stato.stato === 'fallita') {
          avvisa(stato.errore ?? "L'analisi non è riuscita: riprova con più luce.")
          setFase('scatta')
          return
        }
        setPasso((precedente) => Math.min(precedente + 1, PASSI.length))
        await new Promise((risolvi) => setTimeout(risolvi, 1200))
      }
      avvisa("L'analisi sta prendendo troppo: la trovi in armadio quando finisce.")
      setFase('scatta')
    } catch (errore) {
      avvisa(errore instanceof Error ? errore.message : 'Caricamento non riuscito')
      setFase('scatta')
    }
  }

  /**
   * L'analisi in blocco: chi ha appena scaricato l'app ha un armadio pieno, non
   * un capo. Non c'è una coda nell'app — ogni foto parte per conto suo e i capi
   * compaiono in armadio quando il modello ha finito, uno alla volta.
   */
  async function analizzaInBlocco() {
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

    if (MODALITA_DEMO) {
      // Nessuna finzione: in demo non c'è un modello da interrogare, e simulare
      // venti analisi che non avvengono sarebbe peggio che dirlo.
      avvisa(
        `Ho ${esito.assets.length} foto, ma in modalità demo non c'è nessun modello da interrogare: collega l'API e riprova.`,
      )
      return
    }

    let avviate = 0
    setInBlocco(esito.assets.length)
    try {
      for (const scatto of esito.assets) {
        const firma = await api.firmaUpload('image/jpeg')
        await api.caricaFoto(firma, await (await fetch(scatto.uri)).blob())
        await api.avviaAnalisi(firma.chiave)
        avviate += 1
        setInBlocco(esito.assets.length - avviate)
      }
      avvisa(
        `${avviate} ${avviate === 1 ? 'capo' : 'capi'} in analisi: li trovi in armadio appena il modello ha finito.`,
      )
      router.push('/(tabs)/armadio')
    } catch (errore) {
      avvisa(
        `${avviate} ${avviate === 1 ? 'foto inviata' : 'foto inviate'} su ${esito.assets.length}, poi si è fermato: ${
          errore instanceof Error ? errore.message : 'caricamento non riuscito'
        }`,
      )
    } finally {
      setInBlocco(null)
    }
  }

  /** Inserisce il capo a mano: nessuna pipeline, nessuna confidenza da correggere dopo. */
  async function salvaManuale() {
    if (!foto || salvandoManuale) return
    setSalvandoManuale(true)
    try {
      const paletta = PALETTE_COLORI[coloreManuale]!
      const chiaveFoto = MODALITA_DEMO
        ? `locale/${Date.now()}`
        : await (async () => {
            const firma = await api.firmaUpload('image/jpeg')
            await api.caricaFoto(firma, await (await fetch(foto)).blob())
            return firma.chiave
          })()

      await creaCapoManuale({
        nome: nomeManuale.trim() || `${ETICHETTE.tipo[tipoManuale]} ${paletta.nome.toLowerCase()}`,
        tipo: tipoManuale,
        colore: { nome: paletta.nome, hex: paletta.hex },
        chiave_foto: chiaveFoto,
      })
      avvisa(null)
      setFase('scatta')
      setFoto(null)
      setNomeManuale('')
      router.push('/(tabs)/armadio')
    } catch (errore) {
      avvisa(errore instanceof Error ? errore.message : 'Capo non salvato')
    } finally {
      setSalvandoManuale(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Testata occhiello="Nuovo capo" titolo="Aggiungi" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 130, gap: spazi.l }}
        showsVerticalScrollIndicator={false}
      >
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

            <Toccabile
              onPress={() => void scegliFoto(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                paddingVertical: 18,
                borderRadius: raggi.pillola,
                backgroundColor: colori.inchiostro,
              }}
            >
              <Icona nome="fotocamera" misura={19} colore={colori.crema} />
              <Forte taglia={16} colore={colori.crema}>
                Scatta
              </Forte>
            </Toccabile>

            <View style={{ flexDirection: 'row', gap: 9 }}>
              <BottoneSecondario
                testo="Dalla galleria"
                onPress={() => void scegliFoto(false)}
                style={{ flex: 1 }}
              />
              <BottoneSecondario
                testo={`${LIMITE_BLOCCO} in blocco`}
                onPress={() => void analizzaInBlocco()}
                style={{ flex: 1 }}
              />
            </View>

            {inBlocco !== null ? (
              <Corpo taglia={12.5} tono="tenue" style={{ textAlign: 'center' }}>
                {inBlocco === 0
                  ? "Ci siamo, apro l'armadio…"
                  : `Sto avviando l'analisi · ${inBlocco} ${inBlocco === 1 ? 'capo' : 'capi'} da mandare`}
              </Corpo>
            ) : null}

            <Toccabile onPress={() => void scegliFoto(false, 'manuale')} scala={0} style={{ alignItems: 'center' }}>
              <Forte taglia={12.5} colore={colori.inchiostro} style={{ textDecorationLine: 'underline' }}>
                Preferisco inserirlo a mano
              </Forte>
            </Toccabile>

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
              <Forte taglia={13} colore={colori.oliva}>
                {Math.round((passo / PASSI.length) * 100)}%
              </Forte>
            </View>

            <View style={{ height: 6, borderRadius: 99, backgroundColor: 'rgba(21,21,26,0.08)' }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 99,
                  width: `${(passo / PASSI.length) * 100}%`,
                  backgroundColor: colori.citron,
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
                        ? 'rgba(215,244,92,0.22)'
                        : inCorso
                          ? colori.scheda
                          : 'rgba(21,21,26,0.04)',
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 99,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: fatto
                          ? colori.citron
                          : inCorso
                            ? 'rgba(215,244,92,0.55)'
                            : 'rgba(21,21,26,0.12)',
                      }}
                    >
                      {fatto ? <Icona nome="spunta" misura={11} spessore={3.4} /> : null}
                    </View>
                    <Forte taglia={13.5} tono={fatto || inCorso ? 'forte' : 'debole'} style={{ flex: 1 }}>
                      {voce.testo}
                    </Forte>
                    <Corpo taglia={12} tono="debole">
                      {fatto ? voce.esito : ''}
                    </Corpo>
                  </View>
                )
              })}
            </View>
          </>
        ) : null}

        {fase === 'esito' && lettura ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
              {foto ? (
                <Image
                  source={{ uri: foto }}
                  style={{ width: 124, height: 154, borderRadius: raggi.scheda - 2 }}
                  contentFit="cover"
                />
              ) : null}
              <View style={{ flex: 1, gap: spazi.s }}>
                <BadgeIa testo="pronto" />
                <Titolo taglia={23}>{lettura.nome_proposto ?? 'Capo nuovo'}</Titolo>
                <Corpo taglia={12.5} tono="tenue">
                  {"Ha letto anche l'etichetta di lavaggio"}
                </Corpo>
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
              {(
                [
                  ['tipo', lettura.tipo ? ETICHETTE.tipo[lettura.tipo] : null],
                  ['colore', lettura.colore?.nome ?? null],
                  ['materiale', lettura.materiale],
                  ['fantasia', lettura.fantasia],
                  ['stagione', lettura.stagione ? ETICHETTE.stagione[lettura.stagione] : null],
                  ['vestibilita', lettura.vestibilita],
                  ['lavaggio', lettura.lavaggio],
                ] as const
              ).map(([chiave, valore]) =>
                valore ? (
                  <Attributo
                    key={chiave}
                    chiave={ETICHETTE.attributo[chiave]}
                    valore={valore}
                    incerto={(lettura.confidenze?.[chiave] ?? 100) < 86}
                  />
                ) : null,
              )}
            </View>

            <Corpo taglia={11.5} tono="debole">
              Quelli in corallo sono incerti: il modello preferisce che li confermi tu.
            </Corpo>

            <BottonePrimario
              testo="Salva nell'armadio"
              onPress={() => {
                avvisa(
                  MODALITA_DEMO
                    ? "In modalità demo il capo non viene salvato: collega l'API per aggiungerlo davvero."
                    : null,
                )
                setFase('scatta')
                setFoto(null)
                router.push('/(tabs)/armadio')
              }}
            />
            <BottoneSecondario
              testo="Rifai la foto"
              onPress={() => {
                setFase('scatta')
                setFoto(null)
              }}
              style={{ borderColor: linee.chiara, ...ombre.bassa }}
            />
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
                {TIPI.map((tipo) => (
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
                      borderColor: indice === coloreManuale ? colori.citron : linee.chiara,
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

            <View style={{ gap: spazi.s }}>
              <Etichetta taglia={11} tono="debole">
                Nome (facoltativo)
              </Etichetta>
              <TextInput
                value={nomeManuale}
                onChangeText={setNomeManuale}
                placeholder={`${ETICHETTE.tipo[tipoManuale]} ${PALETTE_COLORI[coloreManuale]!.nome.toLowerCase()}`}
                placeholderTextColor="rgba(21,21,26,0.35)"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: raggi.medio - 4,
                  borderWidth: 1,
                  borderColor: linee.chiara,
                  backgroundColor: colori.scheda,
                  fontFamily: 'Manrope_500Medium',
                  fontSize: 14,
                  color: colori.inchiostro,
                }}
              />
            </View>

            <BottonePrimario
              testo={salvandoManuale ? 'Salvo…' : "Salva nell'armadio"}
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
      </ScrollView>
    </View>
  )
}
