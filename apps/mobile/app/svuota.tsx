/**
 * «Svuota l'armadio»: la schermata `impelimina` del deck, dimezzata.
 *
 * Il deck ne faceva **una** operazione sola, che portava via anche l'account —
 * la sua lista finisce con «L'account e i modi per entrare». Qui sono due cose
 * distinte: questa svuota il contenuto, «Elimina l'account» è un'altra
 * decisione, ancora da prendere anche in base a policy e privacy.
 *
 * **Il deck ha un elenco solo, questa schermata ne ha due.** Davanti a
 * qualcosa che non torna indietro, dire cosa sparisce non basta: chi legge
 * deve sapere anche cosa resta, altrimenti se lo immagina — e di solito se lo
 * immagina peggio. Il secondo elenco è anche il posto dove la scelta fatta il
 * 2026-09-23 (misure e preferenze restano) diventa visibile invece che
 * implicita.
 *
 * I numeri sono **veri**, non arrotondati: capi e outfit arrivano dallo store,
 * le conversazioni da `useRisorsa`. Un elenco con scritto «alcuni capi» davanti
 * a una cancellazione definitiva è la cosa che fa premere senza guardare.
 */

import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { api } from '../src/dati/api'
import { useArmadio } from '../src/dati/archivio'
import { useAzione, useRisorsa } from '../src/dati/risorsa'
import { colori, linee, spazi, velature } from '../src/tema/tokens'
import { BottonePrimario, Campo, Icona, LinkTesto, Scheda } from '../src/ui/base'
import { Schermata } from '../src/ui/guscio'
import { Corpo, Etichetta, Forte } from '../src/ui/testo'

/** La parola da scrivere. Combacia col `Literal` del contratto, che il backend
 *  pretende comunque: qui è la difesa contro il tocco distratto, là quella
 *  contro tutto il resto. */
const PAROLA = 'SVUOTA'

function Elenco({ voci }: { voci: { cosa: string; quanti?: string }[] }) {
  return (
    <Scheda vetro imbottitura={0} style={{ overflow: 'hidden' }}>
      {voci.map((voce, indice) => (
        <View
          key={voce.cosa}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 13,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spazi.m,
            borderTopWidth: indice === 0 ? 0 : 1,
            borderTopColor: linee.tenue,
          }}
        >
          <Corpo taglia={14} style={{ flex: 1 }}>
            {voce.cosa}
          </Corpo>
          {voce.quanti ? (
            <Corpo taglia={13} tono="tenue">
              {voce.quanti}
            </Corpo>
          ) : null}
        </View>
      ))}
    </Scheda>
  )
}

export default function Svuota() {
  const { capi, outfit, ricarica, avvisa } = useArmadio()
  const { dati: elenco } = useRisorsa(() => api.chat.conversazioni())
  const { caricamento: svuotando, esegui } = useAzione<Awaited<ReturnType<typeof api.svuotaArmadio>>>()
  const [scritto, setScritto] = useState('')

  const conversazioni = elenco?.conversazioni.length
  const puoProcedere = scritto.trim().toUpperCase() === PAROLA && !svuotando

  async function svuota() {
    const conto = await esegui(() => api.svuotaArmadio())
    if (!conto) {
      avvisa('Non sono riuscito a svuotare l’armadio. Non è stato cancellato niente.')
      return
    }
    // Senza questo lo schermo continuerebbe a mostrare un armadio che non
    // esiste più, e il primo tocco su un capo darebbe un errore inspiegabile.
    await ricarica()
    avvisa(`Fatto: ${conto.capi} capi, ${conto.outfit} outfit e ${conto.conversazioni} conversazioni.`)
    router.replace('/(tabs)/armadio')
  }

  return (
    <Schermata
      occhiello=""
      titolo="Svuota l’armadio"
      tavolozza="neutro"
      indietro
      contentStyle={{ gap: spazi.l }}
    >
      <Scheda
        su="chiaro"
        sfondo={velature.pericolo}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spazi.m }}
      >
        <Icona nome="info" misura={19} colore={colori.pericolo} />
        <Corpo taglia={13} style={{ flex: 1 }}>
          Non c’è un cestino e non c’è un ripensamento: quando confermi, cancello davvero.
        </Corpo>
      </Scheda>

      <View style={{ gap: spazi.s }}>
        <Etichetta taglia={11} tono="debole">
          SPARISCE QUESTO
        </Etichetta>
        <Elenco
          voci={[
            { cosa: 'I capi e le loro foto', quanti: String(capi.length) },
            { cosa: 'Gli outfit salvati', quanti: String(outfit.length) },
            {
              cosa: 'Le conversazioni con Aura',
              quanti: conversazioni === undefined ? '…' : String(conversazioni),
            },
            { cosa: 'Il diario di cosa hai messo' },
          ]}
        />
      </View>

      <View style={{ gap: spazi.s }}>
        <Etichetta taglia={11} tono="debole">
          RESTA QUESTO
        </Etichetta>
        <Elenco
          voci={[
            { cosa: 'Il tuo account: email e password' },
            { cosa: 'Misure, taglia e preferenze di stile' },
            { cosa: 'La tua foto per l’avatar' },
            { cosa: 'Le segnalazioni che hai mandato' },
          ]}
        />
      </View>

      <View style={{ gap: spazi.s }}>
        <Campo
          etichetta={`Scrivi ${PAROLA} per confermare`}
          value={scritto}
          onChangeText={setScritto}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={PAROLA}
        />
        <BottonePrimario
          testo="Svuota per sempre"
          pericolo
          caricando={svuotando}
          disabilitato={!puoProcedere}
          onPress={() => void svuota()}
        />
        <LinkTesto onPress={() => router.back()}>Lascia stare</LinkTesto>
      </View>

      <Corpo taglia="micro" tono="tenue" style={{ textAlign: 'center' }}>
        <Forte taglia="micro">Se ti serve solo una copia</Forte>
        {', torna indietro e scarica prima i tuoi dati: dopo non si può più.'}
      </Corpo>
    </Schermata>
  )
}
