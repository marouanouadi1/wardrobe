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
 * Le chiavi dei provider non stanno nell'app. Vivono su Secrets Manager e il
 * backend le usa senza restituirle mai. In sviluppo si può passare una chiave
 * usa e getta con l'header X-Provider-Key, e serve solo per non aspettare un
 * deploy prima di provare un provider nuovo.
 */

import type { EsecuzionePlayground, EsitoPlayground, JobIa, ModelloDisponibile, PresetPrompt } from '@wardrobe/contracts'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native'
import { api } from '../../src/dati/api'
import { useArmadio } from '../../src/dati/archivio'
import { colori, raggi, spazi } from '../../src/tema/tokens'
import { Icona, Pillola, Toccabile } from '../../src/ui/base'
import { Corpo, Etichetta, Forte, Numero, Titolo } from '../../src/ui/testo'
import { Testata } from '../../src/ui/testata'

const CREMA_TENUE = 'rgba(247,244,239,0.5)'
const FONDO_CAMPO = 'rgba(247,244,239,0.06)'
const BORDO_CAMPO = 'rgba(247,244,239,0.16)'

/** Il form parte da questi finché il fetch di `/dev/preset` non risponde. */
const PRESET_INIZIALI: PresetPrompt[] = [
  {
    id: 'analisi-foto-capo',
    etichetta: 'Analisi foto capo',
    job: 'analisi_capo',
    system_prompt:
      'Sei il modulo di visione di Tela. Ricevi la foto di UN SOLO capo e restituisci JSON con tipo, colore (nome + hex), materiale, fantasia, stagione, vestibilità, lavaggio e una confidenza 0-100 per ciascuno. Se un attributo non è leggibile mettilo a null: non tirare a indovinare.',
    temperatura: 0.2,
    max_token: 900,
  },
  {
    id: 'suggeritore-mattina',
    etichetta: 'Suggeritore mattina',
    job: 'suggerimento',
    system_prompt:
      'Sei lo stilista personale di Tela. Proponi outfit usando SOLO i capi forniti, citandoli per id. Massimo tre motivi brevi per proposta, tono amichevole, in italiano. Non inventare capi.',
    temperatura: 0.45,
    max_token: 1200,
  },
]

export default function Playground() {
  const { capi } = useArmadio()
  const [modelli, setModelli] = useState<ModelloDisponibile[]>([])
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

  return (
    <View style={{ flex: 1, backgroundColor: colori.inchiostro }}>
      <Testata occhiello="Solo interno" titolo="Playground IA" indietro scura />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spazi.xl, paddingBottom: 60, gap: spazi.l }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {preset.map((voce, indice) => (
            <Pillola
              key={voce.id}
              testo={voce.etichetta}
              scura
              attiva={indice === presetScelto}
              onPress={() => {
                setPresetScelto(indice)
                setPrompt(voce.system_prompt)
                setTemperatura(voce.temperatura ?? 0.4)
                setMaxToken(String(voce.max_token ?? 900))
              }}
            />
          ))}
        </ScrollView>

        <View style={{ gap: spazi.s }}>
          <Etichetta taglia={11} colore={CREMA_TENUE}>
            Modello
          </Etichetta>
          {modelli.map((voce, indice) => (
            <Toccabile
              key={`${voce.provider}-${voce.id}`}
              onPress={() => setScelto(indice)}
              scala={0.99}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spazi.m,
                paddingHorizontal: 15,
                paddingVertical: 14,
                borderRadius: raggi.medio,
                borderWidth: 1,
                borderColor: indice === scelto ? colori.citron : 'rgba(247,244,239,0.12)',
                backgroundColor: indice === scelto ? 'rgba(215,244,92,0.12)' : 'rgba(247,244,239,0.04)',
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 99,
                  borderWidth: 2,
                  borderColor: indice === scelto ? colori.citron : 'rgba(247,244,239,0.3)',
                  backgroundColor: indice === scelto ? colori.citron : 'transparent',
                }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Titolo taglia={15} colore={colori.crema}>
                  {voce.etichetta}
                </Titolo>
                <Corpo taglia={11.5} colore={CREMA_TENUE}>
                  {voce.provider}
                  {voce.note ? ` · ${voce.note}` : ''}
                </Corpo>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {/* La spia più utile della schermata: se la chiave non c'è, il
                    test fallirà, ed è meglio saperlo prima di premere. */}
                <Forte taglia={10} colore={voce.configurato ? colori.citron : 'rgba(255,106,69,0.9)'}>
                  {voce.configurato ? 'pronto' : 'senza chiave'}
                </Forte>
                {voce.costo_input_eur_mtok !== null && voce.costo_input_eur_mtok !== undefined ? (
                  <Corpo taglia={10.5} colore="rgba(247,244,239,0.45)">
                    {`${voce.costo_input_eur_mtok}/${voce.costo_output_eur_mtok} €·Mtok`}
                  </Corpo>
                ) : null}
              </View>
            </Toccabile>
          ))}
        </View>

        <View style={{ gap: spazi.s }}>
          <Etichetta taglia={11} colore={CREMA_TENUE}>
            System prompt
          </Etichetta>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            multiline
            style={{
              minHeight: 150,
              padding: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: BORDO_CAMPO,
              backgroundColor: FONDO_CAMPO,
              color: colori.crema,
              fontFamily: 'Manrope_500Medium',
              fontSize: 12.5,
              lineHeight: 19,
              textAlignVertical: 'top',
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: spazi.m }}>
          <View style={{ flex: 1, gap: spazi.s }}>
            <Etichetta taglia={11} colore={CREMA_TENUE}>
              {accettaTemperatura
                ? `Temperature · ${temperatura.toFixed(2).replace('.', ',')}`
                : 'Temperature · non accettata'}
            </Etichetta>
            {/* Sui modelli che hanno rimosso il parametro la manopola si
                spegne. Lasciarla attiva sarebbe peggio che non averla: in un
                banco di prova si trarrebbero conclusioni da un valore che non
                arriva mai al modello. */}
            <View style={{ flexDirection: 'row', gap: 6, opacity: accettaTemperatura ? 1 : 0.35 }}>
              {[0, 0.2, 0.45, 0.7, 1].map((valore) => (
                <Toccabile
                  key={valore}
                  onPress={accettaTemperatura ? () => setTemperatura(valore) : undefined}
                  scala={accettaTemperatura ? 0.94 : 0}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 11,
                    borderRadius: raggi.piccolo,
                    borderWidth: 1,
                    borderColor:
                      accettaTemperatura && temperatura === valore ? colori.citron : BORDO_CAMPO,
                    backgroundColor:
                      accettaTemperatura && temperatura === valore
                        ? 'rgba(215,244,92,0.14)'
                        : FONDO_CAMPO,
                  }}
                >
                  <Forte taglia={12} colore={colori.crema}>
                    {valore.toFixed(1).replace('.', ',')}
                  </Forte>
                </Toccabile>
              ))}
            </View>
            {!accettaTemperatura ? (
              <Corpo taglia={11} colore="rgba(247,244,239,0.45)">
                {"Questo modello ha rimosso `temperature`: la profondità del ragionamento si regola con l'effort, che non è la stessa cosa."}
              </Corpo>
            ) : null}
          </View>
          <View style={{ width: 104, gap: spazi.s }}>
            <Etichetta taglia={11} colore={CREMA_TENUE}>
              Max token
            </Etichetta>
            <TextInput
              value={maxToken}
              onChangeText={setMaxToken}
              keyboardType="number-pad"
              style={{
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderRadius: raggi.piccolo,
                borderWidth: 1,
                borderColor: BORDO_CAMPO,
                backgroundColor: FONDO_CAMPO,
                color: colori.crema,
                fontFamily: 'Manrope_700Bold',
                fontSize: 14,
              }}
            />
          </View>
        </View>

        <View style={{ gap: spazi.s }}>
          <Etichetta taglia={11} colore={CREMA_TENUE}>
            Chiave usa e getta · solo sviluppo
          </Etichetta>
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
              borderColor: BORDO_CAMPO,
              backgroundColor: FONDO_CAMPO,
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
            borderColor: BORDO_CAMPO,
          }}
        >
          <Forte taglia={12.5} colore="rgba(247,244,239,0.65)" style={{ flex: 1 }}>
            {`Contesto iniettato · ${(contesto.length / 1024).toFixed(1)} kB`}
          </Forte>
          <Forte taglia={12.5} colore={colori.citron}>
            {mostraContesto ? 'Nascondi' : 'Mostra'}
          </Forte>
        </Toccabile>

        {mostraContesto ? (
          <ScrollView
            horizontal
            style={{ maxHeight: 260, borderRadius: 18, backgroundColor: FONDO_CAMPO }}
            contentContainerStyle={{ padding: 16 }}
          >
            <Corpo taglia={10.5} colore="rgba(247,244,239,0.85)" style={{ fontFamily: 'monospace' }}>
              {contesto}
            </Corpo>
          </ScrollView>
        ) : null}

        <Toccabile
          onPress={() => void esegui()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            paddingVertical: 18,
            borderRadius: raggi.pillola,
            backgroundColor: colori.citron,
            opacity: inCorso ? 0.7 : 1,
          }}
        >
          {inCorso ? <ActivityIndicator color={colori.inchiostro} /> : <Icona nome="scintilla" misura={18} spessore={2.2} />}
          <Forte taglia={15.5}>
            {inCorso ? `Sto interrogando ${modello?.etichetta}…` : `Esegui su ${modello?.etichetta ?? '—'}`}
          </Forte>
        </Toccabile>

        {esito ? (
          <View style={{ padding: 18, borderRadius: raggi.scheda - 2, backgroundColor: FONDO_CAMPO, gap: spazi.m }}>
            <View style={{ flexDirection: 'row', gap: spazi.s }}>
              {[
                { valore: `${esito.latenza_ms} ms`, etichetta: 'latenza' },
                {
                  valore: esito.uso
                    ? String((esito.uso.token_input ?? 0) + (esito.uso.token_output ?? 0))
                    : '—',
                  etichetta: 'token',
                },
                {
                  valore:
                    esito.costo_eur === null || esito.costo_eur === undefined
                      ? '—'
                      : `${esito.costo_eur.toFixed(4)} €`,
                  etichetta: 'costo',
                },
              ].map((metrica) => (
                <View
                  key={metrica.etichetta}
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                    borderRadius: raggi.piccolo,
                    backgroundColor: 'rgba(247,244,239,0.07)',
                  }}
                >
                  <Numero taglia={17} colore={colori.crema}>
                    {metrica.valore}
                  </Numero>
                  <Etichetta taglia={9.5} colore="rgba(247,244,239,0.45)" style={{ marginTop: 3 }}>
                    {metrica.etichetta}
                  </Etichetta>
                </View>
              ))}
            </View>

            <Forte
              taglia={12}
              colore={esito.esito === 'ok' ? colori.citron : esito.esito === 'vago' ? '#FFD08B' : '#FFB39B'}
            >
              {esito.esito.toUpperCase()}
            </Forte>

            {esito.errore ? (
              <Corpo taglia={13} colore="#FFB39B">
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
            <Etichetta taglia={11} colore={CREMA_TENUE}>
              Storico test
            </Etichetta>
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
                  backgroundColor: 'rgba(247,244,239,0.05)',
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Forte taglia={13} colore={colori.crema} numberOfLines={1}>
                    {riga.modello}
                  </Forte>
                  <Corpo taglia={11} colore="rgba(247,244,239,0.45)">
                    {`${riga.job} · T ${riga.temperatura}`}
                  </Corpo>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Forte taglia={12} colore={colori.crema}>
                    {`${riga.latenza_ms} ms`}
                  </Forte>
                  <Corpo taglia={11} colore="rgba(247,244,239,0.45)">
                    {riga.costo_eur === null || riga.costo_eur === undefined
                      ? '—'
                      : `${riga.costo_eur.toFixed(4)} €`}
                  </Corpo>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: raggi.pillola,
                    backgroundColor: riga.esito === 'ok' ? 'rgba(215,244,92,0.18)' : 'rgba(255,106,69,0.2)',
                  }}
                >
                  <Etichetta taglia={10} colore={riga.esito === 'ok' ? colori.citron : '#FFB39B'}>
                    {riga.esito}
                  </Etichetta>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
