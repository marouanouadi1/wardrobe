/**
 * Il playground: un posto per provare i modelli, non una chat.
 *
 * Esercita i due lavori veri del prodotto — leggere la foto di un capo e
 * proporre outfit — e per ognuno riporta latenza, token, costo ed esito. È la
 * differenza fra «questo modello mi sembra migliore» e «questo modello legge il
 * tessuto nell'88% dei casi e costa un terzo».
 *
 * Perché è scura: qui non stiamo usando il prodotto, lo stiamo misurando. Il
 * cambio di fondo è il modo più rapido per ricordarselo.
 *
 * Le chiavi dei provider non stanno nell'app. Vivono nell'ambiente del
 * backend e il backend le usa senza restituirle mai. In sviluppo si può
 * passare una chiave usa e getta con l'header X-Provider-Key, e serve solo
 * per non aspettare un riavvio prima di provare un provider nuovo.
 */

import type { EsecuzionePlayground, EsitoPlayground, JobIa, PresetPrompt } from '@wardrobe/contracts'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { api } from '../dati/api'
import { useArmadio } from '../dati/archivio'
import { euro } from '../dati/formato'
import { colori, raggi, spazi, superfici, testoSu, velo } from '../tema/tokens'
import { BottonePrimario, Pillola, Toccabile } from '../ui/base'
import { Schermata } from '../ui/guscio'
import { RigaRadio, RiquadroStatistica, TitoloSezione, spiaModello } from '../ui/righe'
import { Corpo, Etichetta, Forte } from '../ui/testo'

/** Il form parte da questi finché il fetch di `/dev/preset` non risponde. */
const PRESET_INIZIALI: PresetPrompt[] = [
  {
    id: 'analisi-foto-capo',
    etichetta: 'Analisi foto capo',
    job: 'analisi_capo',
    system_prompt:
      'Sei il modulo di visione di Wardrobe. Ricevi la foto di UN SOLO capo e restituisci JSON con tipo, colore (nome + hex), materiale, fantasia, stagione, vestibilità, lavaggio e una confidenza 0-100 per ciascuno. Se un attributo non è leggibile mettilo a null: non tirare a indovinare.',
    temperatura: 0.2,
    max_token: 900,
  },
  {
    id: 'suggeritore-mattina',
    etichetta: 'Suggeritore mattina',
    job: 'suggerimento',
    system_prompt:
      'Sei lo stilista personale di Wardrobe. Proponi outfit usando SOLO i capi forniti, citandoli per id. Massimo tre motivi brevi per proposta, tono amichevole, in italiano. Non inventare capi.',
    temperatura: 0.45,
    max_token: 1200,
  },
]

export default function Playground() {
  const { capi } = useArmadio()
  const [modelli, setModelli] = useState<import('@wardrobe/contracts').ModelloDisponibile[]>([])
  const [preset, setPreset] = useState<PresetPrompt[]>(PRESET_INIZIALI)
  const [scelto, setScelto] = useState(0)
  const [presetScelto, setPresetScelto] = useState(0)
  const [prompt, setPrompt] = useState(PRESET_INIZIALI[0]!.system_prompt)
  const [temperatura, setTemperatura] = useState(0.2)
  const [maxToken, setMaxToken] = useState('900')
  const [chiaveSviluppo, setChiaveSviluppo] = useState('')
  const [mostraContesto, setMostraContesto] = useState(false)
  const [contestoRemoto, setContestoRemoto] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [esito, setEsito] = useState<EsitoPlayground | null>(null)
  const [storico, setStorico] = useState<EsecuzionePlayground[]>([])
  const [salvandoPreset, setSalvandoPreset] = useState(false)
  const [presetAppenaSalvato, setPresetAppenaSalvato] = useState(false)

  const modello = modelli[scelto]
  const job: JobIa = preset[presetScelto]?.job ?? 'suggerimento'
  const accettaTemperatura = modello?.accetta_temperatura !== false

  /**
   * Il contesto locale: la stessa forma che il backend invierebbe allo stilista.
   *
   * È calcolato dai capi, non tenuto in stato: così si vede il payload anche
   * senza server, e cambia da sé quando cambia l'armadio.
   */
  const contestoLocale = useMemo(
    () =>
      JSON.stringify(
        {
          capi_disponibili: capi
            .filter((capo) => capo.stato === 'pulito')
            .map((capo) => ({
              id: capo.id,
              nome: capo.nome,
              tipo: capo.tipo,
              slot: capo.slot,
              colore: capo.colore.nome,
              hex: capo.colore.hex,
              materiale: capo.materiale,
              stagione: capo.stagione,
            })),
          in_lavaggio: capi.filter((capo) => capo.stato !== 'pulito').map((capo) => capo.nome),
          preferenze: { palette: ['neutri', 'terra'], evita: ['fantasie vistose'] },
          numero_proposte: 3,
        },
        null,
        2,
      ),
    [capi],
  )
  const contesto = contestoRemoto ?? contestoLocale

  useEffect(() => {
    void (async () => {
      try {
        const [catalogo, elencoPreset, contestoVero, storicoVero] = await Promise.all([
          api.dev.modelli(),
          api.dev.preset(),
          api.dev.contesto(),
          api.dev.storico(),
        ])
        setModelli(catalogo)
        setPreset(elencoPreset)
        if (elencoPreset[0]) setPrompt(elencoPreset[0].system_prompt)
        setContestoRemoto(JSON.stringify(contestoVero, null, 2))
        setStorico(storicoVero)
      } catch {
        // Il playground è uno strumento: se il backend non risponde resta
        // utilizzabile in lettura, con il catalogo di riferimento.
      }
    })()
  }, [])

  async function esegui() {
    if (!modello || inCorso) return
    setInCorso(true)
    setEsito(null)

    try {
      const risultato = await api.dev.esegui(
        {
          job,
          provider: modello.provider,
          modello: modello.id,
          system_prompt: prompt,
          temperatura,
          max_token: Number(maxToken) || 900,
          contesto: job === 'suggerimento' ? JSON.parse(contesto) : null,
          chiave_foto: job === 'analisi_capo' ? capi[0]?.foto.chiave : null,
        },
        chiaveSviluppo || undefined,
      )
      setEsito(risultato)
      setStorico(await api.dev.storico().catch(() => storico))
    } catch (errore) {
      setEsito({
        ok: false,
        esito: 'errore',
        provider: modello.provider,
        modello: modello.id,
        latenza_ms: 0,
        errore: errore instanceof Error ? errore.message : 'Chiamata non riuscita',
        suggerimenti: [],
      })
    } finally {
      setInCorso(false)
    }
  }

  /**
   * Persiste il prompt (e temperatura/max token) che si sta provando come
   * nuovo default del job. Da qui in poi non lo legge solo questo schermo: lo
   * legge anche la chat vera dell'app, a ogni messaggio — è così che un
   * prompt provato qui diventa quello che l'utente vede in «Chiedi a Wardrobe».
   */
  async function salvaPresetCorrente() {
    const attuale = preset[presetScelto]
    if (!attuale || salvandoPreset) return
    setSalvandoPreset(true)
    setPresetAppenaSalvato(false)
    try {
      const salvato = await api.dev.salvaPreset({
        ...attuale,
        system_prompt: prompt,
        temperatura,
        max_token: Number(maxToken) || attuale.max_token,
      })
      setPreset((precedenti) => precedenti.map((p, indicePreset) => (indicePreset === presetScelto ? salvato : p)))
      setPresetAppenaSalvato(true)
    } catch {
      // Il playground resta uno strumento di prova: se il salvataggio fallisce
      // si continua a testare il prompt in memoria, senza bloccare lo schermo.
    } finally {
      setSalvandoPreset(false)
    }
  }

  return (
    <Schermata occhiello="Solo interno" titolo="Playground IA" indietro su="scuro">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
        {preset.map((voce, indice) => (
          <Pillola
            key={voce.id}
            testo={voce.etichetta}
            su="scuro"
            attiva={indice === presetScelto}
            onPress={() => {
              setPresetScelto(indice)
              setPrompt(voce.system_prompt)
              setTemperatura(voce.temperatura ?? 0.4)
              setMaxToken(String(voce.max_token ?? 900))
              setPresetAppenaSalvato(false)
            }}
          />
        ))}
      </ScrollView>

      <View style={{ gap: spazi.s }}>
        <TitoloSezione su="scuro">Modello</TitoloSezione>
        {modelli.map((voce, indice) => (
          <RigaRadio
            key={`${voce.provider}-${voce.id}`}
            titolo={voce.etichetta}
            sottotitolo={`${voce.provider}${voce.note ? ` · ${voce.note}` : ''}`}
            attivo={indice === scelto}
            onPress={() => setScelto(indice)}
            dettaglioSpia={
              voce.costo_input_eur_mtok !== null && voce.costo_input_eur_mtok !== undefined
                ? `${voce.costo_input_eur_mtok}/${voce.costo_output_eur_mtok} €·Mtok`
                : undefined
            }
            {...spiaModello(voce.configurato)}
          />
        ))}
      </View>

      <View style={{ gap: spazi.s }}>
        <TitoloSezione su="scuro">System prompt</TitoloSezione>
        <TextInput
          value={prompt}
          onChangeText={(testo) => {
            setPrompt(testo)
            setPresetAppenaSalvato(false)
          }}
          multiline
          style={{
            minHeight: 150,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: superfici.suScuro.bordoCampo,
            backgroundColor: superfici.suScuro.campo,
            color: colori.crema,
            fontFamily: 'Manrope_500Medium',
            fontSize: 12.5,
            lineHeight: 19,
            textAlignVertical: 'top',
          }}
        />

        {/* Finché non si preme qui, il prompt provato sopra resta solo
            nella memoria di questo schermo: non lo vede né un altro
            collaudo del playground riaperto, né la chat vera. Ambra su
            fondo scuro anche qui: è lo strumento di misura, non l'app
            spedita — la regola «l'ambra è solo dell'IA» vale sulle
            schermate che l'utente vede. */}
        <BottonePrimario
          testo={presetAppenaSalvato ? 'Salvato — lo usa anche la chat vera' : 'Salva come preset predefinito'}
          ambra
          icona={presetAppenaSalvato ? 'spunta' : 'scintilla'}
          caricando={salvandoPreset}
          onPress={() => void salvaPresetCorrente()}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spazi.m }}>
        <View style={{ flex: 1, gap: spazi.s }}>
          <TitoloSezione su="scuro">
            {accettaTemperatura
              ? `Temperature · ${temperatura.toFixed(2).replace('.', ',')}`
              : 'Temperature · non accettata'}
          </TitoloSezione>
          {/* Sui modelli che hanno rimosso il parametro la manopola si
              spegne. Lasciarla attiva sarebbe peggio che non averla: in un
              banco di prova si trarrebbero conclusioni da un valore che non
              arriva mai al modello. */}
          <View style={{ flexDirection: 'row', gap: 6, opacity: accettaTemperatura ? 1 : 0.35 }}>
            {[0, 0.2, 0.45, 0.7, 1].map((valore) => (
              <TastoTemperatura
                key={valore}
                valore={valore}
                attivo={accettaTemperatura && temperatura === valore}
                abilitato={accettaTemperatura}
                onPress={() => {
                  setTemperatura(valore)
                  setPresetAppenaSalvato(false)
                }}
              />
            ))}
          </View>
          {!accettaTemperatura ? (
            <Corpo taglia={11} colore="rgba(247,244,239,0.45)">
              {"Questo modello ha rimosso `temperature`: la profondità del ragionamento si regola con l'effort, che non è la stessa cosa."}
            </Corpo>
          ) : null}
        </View>
        <View style={{ width: 104, gap: spazi.s }}>
          <TitoloSezione su="scuro">Max token</TitoloSezione>
          <TextInput
            value={maxToken}
            onChangeText={(testo) => {
              setMaxToken(testo)
              setPresetAppenaSalvato(false)
            }}
            keyboardType="number-pad"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: raggi.piccolo,
              borderWidth: 1,
              borderColor: superfici.suScuro.bordoCampo,
              backgroundColor: superfici.suScuro.campo,
              color: colori.crema,
              fontFamily: 'Manrope_700Bold',
              fontSize: 14,
            }}
          />
        </View>
      </View>

      <View style={{ gap: spazi.s }}>
        <TitoloSezione su="scuro">Chiave usa e getta · solo sviluppo</TitoloSezione>
        <TextInput
          value={chiaveSviluppo}
          onChangeText={setChiaveSviluppo}
          placeholder="lascia vuoto per usare quella del server"
          placeholderTextColor="rgba(247,244,239,0.3)"
          secureTextEntry
          autoCapitalize="none"
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: superfici.suScuro.bordoCampo,
            backgroundColor: superfici.suScuro.campo,
            color: colori.crema,
            fontFamily: 'Manrope_500Medium',
            fontSize: 14,
          }}
        />
      </View>

      <Toccabile
        onPress={() => setMostraContesto(!mostraContesto)}
        scala={0}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: superfici.suScuro.bordoCampo,
        }}
      >
        <Forte taglia={12.5} colore="rgba(247,244,239,0.65)" style={{ flex: 1 }}>
          {`Contesto iniettato · ${(contesto.length / 1024).toFixed(1)} kB`}
        </Forte>
        <Forte taglia={12.5} colore={colori.ambra}>
          {mostraContesto ? 'Nascondi' : 'Mostra'}
        </Forte>
      </Toccabile>

      {mostraContesto ? (
        <ScrollView
          horizontal
          style={{ maxHeight: 260, borderRadius: 18, backgroundColor: superfici.suScuro.campo }}
          contentContainerStyle={{ padding: 16 }}
        >
          <Corpo taglia={10.5} colore="rgba(247,244,239,0.85)" style={{ fontFamily: 'monospace' }}>
            {contesto}
          </Corpo>
        </ScrollView>
      ) : null}

      <BottonePrimario
        testo={inCorso ? `Sto interrogando ${modello?.etichetta}…` : `Esegui su ${modello?.etichetta ?? '—'}`}
        ambra
        icona="scintilla"
        caricando={inCorso}
        onPress={() => void esegui()}
      />

      {esito ? (
        <View style={{ padding: 18, borderRadius: raggi.scheda - 2, backgroundColor: superfici.suScuro.campo, gap: spazi.m }}>
          <View style={{ flexDirection: 'row', gap: spazi.s }}>
            <RiquadroStatistica numero={`${esito.latenza_ms} ms`} etichetta="latenza" taglia={17} />
            <RiquadroStatistica
              numero={esito.uso ? String((esito.uso.token_input ?? 0) + (esito.uso.token_output ?? 0)) : '—'}
              etichetta="token"
              taglia={17}
            />
            <RiquadroStatistica numero={euro(esito.costo_eur)} etichetta="costo" taglia={17} />
          </View>

          <Forte
            taglia={12}
            colore={esito.esito === 'ok' ? colori.ambra : esito.esito === 'vago' ? colori.ambraChiaro : colori.coralloChiaro}
          >
            {esito.esito.toUpperCase()}
          </Forte>

          {esito.errore ? (
            <Corpo taglia={13} colore={colori.coralloChiaro}>
              {esito.errore}
            </Corpo>
          ) : null}

          {esito.suggerimenti && esito.suggerimenti.length > 0 ? (
            <View style={{ gap: spazi.s }}>
              {esito.suggerimenti.map((proposta) => (
                <View key={proposta.titolo} style={{ gap: 2 }}>
                  <Forte taglia={13} colore={colori.crema}>
                    {`${proposta.titolo} · ${proposta.match}%`}
                  </Forte>
                  {proposta.perche.map((motivo) => (
                    <Corpo key={motivo} taglia={12} colore="rgba(247,244,239,0.7)">
                      {`— ${motivo}`}
                    </Corpo>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

          {esito.lettura ? (
            <Corpo taglia={11.5} colore="rgba(247,244,239,0.85)" style={{ fontFamily: 'monospace' }}>
              {JSON.stringify(esito.lettura, null, 2)}
            </Corpo>
          ) : null}
        </View>
      ) : null}

      {storico.length > 0 ? (
        <View style={{ gap: spazi.s }}>
          <TitoloSezione su="scuro">Storico test</TitoloSezione>
          {storico.map((riga) => (
            <View
              key={riga.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                paddingHorizontal: 15,
                paddingVertical: 13,
                borderRadius: 18,
                backgroundColor: superfici.suScuro.riga,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Forte taglia={13} colore={colori.crema} numberOfLines={1}>
                  {riga.modello}
                </Forte>
                <Corpo taglia={11} colore={testoSu.scuro.tenue}>
                  {`${riga.job} · T ${riga.temperatura}`}
                </Corpo>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Forte taglia={12} colore={colori.crema}>
                  {`${riga.latenza_ms} ms`}
                </Forte>
                <Corpo taglia={11} colore={testoSu.scuro.tenue}>
                  {euro(riga.costo_eur)}
                </Corpo>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: raggi.pillola,
                  backgroundColor: riga.esito === 'ok' ? velo(colori.ambra, 0.18) : velo(colori.corallo, 0.2),
                }}
              >
                <Etichetta taglia={10} colore={riga.esito === 'ok' ? colori.ambra : colori.coralloChiaro}>
                  {riga.esito}
                </Etichetta>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Schermata>
  )
}

function TastoTemperatura({
  valore,
  attivo,
  abilitato,
  onPress,
}: {
  valore: number
  attivo: boolean
  abilitato: boolean
  onPress: () => void
}) {
  return (
    <Pillola
      testo={valore.toFixed(1).replace('.', ',')}
      su="scuro"
      attiva={attivo}
      onPress={abilitato ? onPress : undefined}
    />
  )
}
