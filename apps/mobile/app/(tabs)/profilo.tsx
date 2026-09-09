/**
 * Profilo: chi sei, come ti vesti.
 */

import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Alert, View } from 'react-native'
import { URL_API } from '../../src/dati/api'
import { useArmadio } from '../../src/dati/archivio'
import { capiDormienti, nomeDiBattesimo } from '../../src/dati/dominio'
import { apriSegnalazione, segnalazioniAttive } from '../../src/dati/segnalazioni'
import { useSessione } from '../../src/dati/sessione'
import { colori, linee, raggi, spazi } from '../../src/tema/tokens'
import { Bolla, BottoneSecondario, Icona, Scheda, Toccabile } from '../../src/ui/base'
import { Corpo, Etichetta, Forte, Numero, Titolo } from '../../src/ui/testo'
import { RigaNavigabile } from '../../src/ui/righe'
import { Schermata } from '../../src/ui/guscio'
import { Caricamento } from '../../src/ui/stati'

export default function Profilo() {
  const { capi, outfit, profilo, pronto } = useArmadio()
  const { esci } = useSessione()
  const dormienti = capiDormienti(capi)

  function chiediDiUscire() {
    Alert.alert('Esci', 'Dovrai accedere di nuovo con email e password.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: () => {
          esci()
          router.replace('/accedi')
        },
      },
    ])
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
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {[
              { numero: String(capi.length), etichetta: 'capi', sfondo: colori.scheda, tinta: colori.inchiostro },
              // Non ambra: un conteggio di dati dell'utente, non il modello
              // che parla — la regola in cima a `tokens.ts`.
              { numero: String(outfit.length), etichetta: 'outfit', sfondo: colori.scheda, tinta: colori.inchiostro },
              { numero: String(dormienti.length), etichetta: 'fermi', sfondo: colori.inchiostro, tinta: colori.crema },
            ].map((voce) => (
              <View
                key={voce.etichetta}
                style={{
                  flex: 1,
                  padding: 15,
                  borderRadius: raggi.medio + 2,
                  backgroundColor: voce.sfondo,
                }}
              >
                <Numero taglia={24} colore={voce.tinta}>
                  {voce.numero}
                </Numero>
                <Forte taglia={10.5} colore={voce.tinta} style={{ marginTop: 5, opacity: 0.6 }}>
                  {voce.etichetta}
                </Forte>
              </View>
            ))}
          </View>

          <Etichetta taglia={11} tono="debole" style={{ marginTop: spazi.s }}>
            Il tuo stile
          </Etichetta>
          <View style={{ borderRadius: raggi.medioAlto, backgroundColor: colori.scheda, overflow: 'hidden' }}>
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
                {riga.vai ? (
                  <Icona nome="chevron" misura={15} colore="rgba(21,21,26,0.3)" spessore={2.4} />
                ) : null}
              </Toccabile>
            ))}
          </View>
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
        onPress={chiediDiUscire}
        colore={colori.corallo}
        style={{ borderColor: colori.coralloTenue }}
      />
    </Schermata>
  )
}
