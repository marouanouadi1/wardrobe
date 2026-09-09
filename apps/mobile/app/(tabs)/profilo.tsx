/**
 * Profilo: chi sei, come ti vesti.
 */

import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { URL_API } from '../../src/dati/api'
import { useArmadio } from '../../src/dati/archivio'
import { capiDormienti, nomeDiBattesimo } from '../../src/dati/dominio'
import { apriSegnalazione, segnalazioniAttive } from '../../src/dati/segnalazioni'
import { useSessione } from '../../src/dati/sessione'
import { colori, linee, raggi, spazi } from '../../src/tema/tokens'
import { Bolla, BottoneSecondario, Icona, Scheda, Toccabile } from '../../src/ui/base'
import { Conferma } from '../../src/ui/avviso'
import { Corpo, Etichetta, Titolo } from '../../src/ui/testo'
import { RigaNavigabile, RigaStatistiche } from '../../src/ui/righe'
import { Schermata } from '../../src/ui/guscio'
import { Caricamento } from '../../src/ui/stati'

export default function Profilo() {
  const { capi, outfit, profilo, pronto } = useArmadio()
  const { esci } = useSessione()
  const dormienti = capiDormienti(capi)
  const [confermaUscita, setConfermaUscita] = useState(false)

  function uscire() {
    setConfermaUscita(false)
    esci()
    router.replace('/accedi')
  }

  // «Stile» e «Outfit salvati» portano a una schermata; le altre due non
  // hanno ancora un modo di modificarle, quindi restano in sola lettura,
  // senza un chevron che promette un tap che non fa nulla.
  const preferenze = [
    {
      chiave: 'Stile',
      valore: profilo?.preferenze?.stili?.join(', ') || 'da impostare',
      // `rivisita` dice a preferenze.tsx che «indietro» torna qui — a
      // differenza del primo accesso (un redirect dopo il login), qui è
      // un push vero, e router.canGoBack() da solo non basta a distinguerli
      // (la cronologia porta con sé le tappe precedenti al login).
      vai: () => router.push({ pathname: '/preferenze', params: { rivisita: '1' } }),
    },
    { chiave: 'Palette', valore: profilo?.preferenze?.palette?.join(', ') || 'da impostare' },
    { chiave: 'Evita', valore: profilo?.preferenze?.evita?.join(', ') || '—' },
    { chiave: 'Città', valore: profilo?.citta ?? 'da impostare' },
    {
      chiave: 'Outfit salvati',
      valore: String(outfit.length),
      vai: () => router.push('/outfit'),
    },
  ]

  return (
    <Schermata occhiello="Il tuo profilo" titolo={nomeDiBattesimo(profilo) ?? 'Tu'} tab contentStyle={{ gap: spazi.m }}>
      <Scheda imbottitura={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
        {profilo?.foto_url ? (
          <Image
            source={{ uri: profilo.foto_url }}
            style={{ width: 66, height: 66, borderRadius: raggi.pillola }}
            contentFit="cover"
          />
        ) : (
          <Bolla nome="utente" sfondo={linee.tenue} colore={colori.inchiostro} misura={66} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Titolo taglia={22}>{profilo?.nome ?? 'Il tuo profilo'}</Titolo>
          <Corpo taglia={12.5} tono="tenue">
            {profilo?.citta ? `${profilo.citta} · ` : ''}
            {`collegato a ${URL_API}`}
          </Corpo>
        </View>
      </Scheda>

      {pronto ? (
        <>
          <RigaStatistiche
            voci={[
              { numero: String(capi.length), etichetta: 'capi' },
              // Non ambra: un conteggio di dati dell'utente, non il modello
              // che parla — la regola in cima a `tokens.ts`. E senza `sfondo`,
              // così prende la stessa card bianca di «capi» invece di una
              // tinta piena inventata per l'occasione.
              { numero: String(outfit.length), etichetta: 'outfit' },
              { numero: String(dormienti.length), etichetta: 'fermi', sfondo: colori.inchiostro, tinta: colori.crema },
            ]}
          />

          <Etichetta taglia={11} tono="debole" style={{ marginTop: spazi.s }}>
            Il tuo stile
          </Etichetta>
          <Scheda imbottitura={0} style={{ overflow: 'hidden' }}>
            {preferenze.map((riga, indice) => (
              // Senza `onPress` Toccabile è già inerte (niente scala, niente
              // vibrazione, vedi `ui/base.tsx`): non serve un componente diverso
              // per le righe in sola lettura, basta non passargli `vai`.
              <Toccabile
                key={riga.chiave}
                onPress={riga.vai}
                scala={0}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spazi.m,
                  paddingHorizontal: 17,
                  paddingVertical: 15,
                  borderBottomWidth: indice === preferenze.length - 1 ? 0 : 1,
                  borderBottomColor: linee.tenue,
                }}
              >
                <Corpo taglia={14.5} style={{ flex: 1 }}>
                  {riga.chiave}
                </Corpo>
                <Corpo taglia={13} tono="tenue">
                  {riga.valore}
                </Corpo>
                {riga.vai ? <Icona nome="chevron" misura={15} colore={linee.chevron} spessore={2.4} /> : null}
              </Toccabile>
            ))}
          </Scheda>
        </>
      ) : (
        // Prima, mentre l'archivio caricava, questa sezione mostrava 0/0/0 e
        // «da impostare» ovunque — dati falsi, non uno stato di attesa.
        <Caricamento />
      )}

      <View style={{ flexDirection: 'row', gap: 9, marginTop: spazi.s }}>
        <BottoneSecondario
          testo="Cosa ho indossato"
          onPress={() => router.push('/calendario')}
          style={{ flex: 1 }}
        />
        <BottoneSecondario
          testo="Rivedi l'intro"
          onPress={() => router.push('/intro')}
          style={{ flex: 1 }}
        />
      </View>

      {/* Sta qui e non dietro le voci di «Sviluppo» perché non è uno
          strumento interno: è la porta di chi sta provando l'app e trova
          qualcosa che non torna. Sparisce solo se manca il DSN, cioè se non
          c'è nessun posto dove far arrivare la segnalazione. */}
      {segnalazioniAttive ? (
        <RigaNavigabile
          icona="cartellino"
          titolo="Segnala un problema"
          sottotitolo="Scrivi cosa non va e allega uno screenshot"
          onPress={apriSegnalazione}
          bordo
        />
      ) : null}

      {/* Indipendente da `segnalazioniAttive`: legge dal nostro backend,
          non da Sentry, quindi resta utile anche in una build senza DSN —
          mostra quello che è già stato segnalato in passato. È la risposta
          a chi segnala e non ha, come noi, accesso a Sentry per vedere se
          e come la segnalazione è stata presa in carico. */}
      <RigaNavigabile
        icona="griglia"
        titolo="Le mie segnalazioni"
        sottotitolo="Cosa hai segnalato, e a che punto è"
        onPress={() => router.push('/segnalazioni')}
        bordo
      />

      <BottoneSecondario
        testo="Esci"
        onPress={() => setConfermaUscita(true)}
        colore={colori.corallo}
        style={{ borderColor: colori.coralloTenue }}
      />

      <Conferma
        visibile={confermaUscita}
        titolo="Esci"
        messaggio="Dovrai accedere di nuovo con email e password."
        testoConferma="Esci"
        onConferma={uscire}
        onAnnulla={() => setConfermaUscita(false)}
      />
    </Schermata>
  )
}
