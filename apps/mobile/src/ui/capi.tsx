/**
 * I capi, nelle forme in cui il design li mostra: griglia, e le miniature
 * più piccole (suggerimenti, selettore dell'avatar).
 *
 * Sotto la foto c'è `colori.fondoFoto`, uguale per tutti i capi. Non era così:
 * c'era il colore dominante del capo, come segnaposto di caricamento. Ha
 * smesso di funzionare quando lo scontorno (`handlers/analisi.py`) ha
 * iniziato a produrre PNG trasparenti — il fondo non è più coperto dalla
 * foto, e ogni capo finiva adagiato su una velatura del proprio colore. Il
 * segnaposto resta, ma è lo stesso bianco per tutti.
 */

import type { Capo, Outfit, SlotAvatar } from '@wardrobe/contracts'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { capiDiVestizione, fotoDaMostrare, quandoUsato } from '../dati/dominio'
import {
  ETICHETTE,
  colori,
  durate,
  griglie,
  linee,
  ombre,
  raggi,
  spazi,
  superfici,
  testoSu,
  velature,
  velo,
} from '../tema/tokens'
import { Badge, BottonePrimario, BottoneTondo, Icona, Scheda, Toccabile } from './base'
import { Fondo, type Su } from './fondo'
import { PistaIndeterminata, Vuoto } from './stati'
import { Corpo, Etichetta, Forte } from './testo'

const OMBRE_SCHEDA_FOTO = {
  scheda: ombre.scheda,
  alta: ombre.alta,
  bassa: ombre.bassa,
  nessuna: {},
} as const

/**
 * La card foto a tutta larghezza: angoli smussati, un fondo, e dentro quello
 * che la schermata vuole (di solito un'`<Image>` più un testo sovrapposto).
 *
 * Sostituisce sei ricostruzioni a mano quasi identiche — il dettaglio di un
 * capo, il suggeritore, gli outfit salvati, la proposta di Oggi, le due
 * schermate di `carica.tsx` — ciascuna con un raggio o un'ombra leggermente
 * diversi senza una ragione: la stessa forma, copiata a mano sei volte,
 * diverge in silenzio.
 */
export function SchedaFoto({
  raggio = raggi.grande - 2,
  ombra = 'scheda',
  su,
  sfondo,
  style,
  children,
}: {
  raggio?: number
  ombra?: keyof typeof OMBRE_SCHEDA_FOTO
  su?: Su
  /** Un fondo esplicito, invece del solido che `su` ricava da sé — il velo
   * d'inchiostro di uno scheletro che sa di stare già su una `Schermata`
   * scura (`ScheletroSchedaOutfit`), non un rettangolo scuro autonomo su una
   * schermata chiara (`carica.tsx`). */
  sfondo?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  // Prima `sfondo` era l'unica leva — `carica.tsx` le passava
  // `colori.inchiostro` senza modo di dirlo ai testi dentro, che finivano
  // cablati a mano (`colore={colori.scheda}`, `colore="rgba(255,253,249,…)"`).
  const fondo: Su = su ?? 'chiaro'
  const scura = fondo === 'scuro'
  return (
    <Fondo su={fondo}>
      <View
        style={[
          {
            borderRadius: raggio,
            overflow: 'hidden',
            backgroundColor: sfondo ?? (scura ? colori.inchiostro : colori.scheda),
          },
          OMBRE_SCHEDA_FOTO[ombra],
          style,
        ]}
      >
        {children}
      </View>
    </Fondo>
  )
}

/**
 * Il piede di una foto: la sfumatura verso l'inchiostro, ancorata in fondo,
 * con `su="scuro"` già dichiarato per chi ci scrive dentro. `CapoInGriglia`
 * e le due schermate di `carica.tsx` lo ricostruivano a mano — stesso
 * gradiente, e per la stessa ragione i loro testi erano cablati a mano
 * (`colore={colori.scheda}`, `colore="rgba(255,253,249,…)"`): nessuno dei
 * due sapeva dirsi scuro all'unico modo che un `ReactNode` permette.
 */
export function PiedeFoto({
  children,
  opacita = 0.82,
  style,
}: {
  children: ReactNode
  /** Quanto scende verso l'inchiostro pieno: 0.82 di norma. La copertina di
   * `carica.tsx` usa 0.85 — una foto già velata al 50% ha meno bisogno di
   * sfumatura per restare leggibile. */
  opacita?: number
  style?: StyleProp<ViewStyle>
}) {
  return (
    <LinearGradient
      colors={[velo(colori.inchiostro, 0), velo(colori.inchiostro, opacita)]}
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, style]}
    >
      <Fondo su="scuro">{children}</Fondo>
    </LinearGradient>
  )
}

/**
 * L'elenco dei «perché» di una proposta: un pallino primario e una riga di
 * testo per ciascuno — è il motivo che il modello dà per la
 * sua scelta. Una forma che vive qui invece che ridisegnata inline in una
 * schermata, per la stessa regola di `SchedaFoto` sopra.
 */
export function MotiviProposta({ motivi, su }: { motivi: string[]; su?: Su }) {
  return (
    <View style={{ gap: 7 }}>
      {motivi.map((motivo) => (
        <View key={motivo} style={{ flexDirection: 'row', gap: 9 }}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: raggi.pillola,
              marginTop: 7,
              backgroundColor: colori.primario,
            }}
          />
          <Corpo taglia={13} tono="medio" su={su} style={{ flex: 1 }}>
            {motivo}
          </Corpo>
        </View>
      ))}
    </View>
  )
}

/**
 * La casella tratteggiata che aspetta il prossimo capo, **dentro** la griglia:
 * nel deck il passo successivo non è un bottone da cercare altrove, è la
 * tessera vuota accanto alle altre. Stesse misure di `CapoInGriglia`, o le due
 * non si allineano.
 */
export function CasellaAggiungi({ onPress }: { onPress: () => void }) {
  return (
    <Toccabile onPress={onPress} style={{ gap: griglie.armadio.distanzaNome }}>
      <View
        style={{
          aspectRatio: griglie.armadio.proporzione,
          borderRadius: griglie.armadio.raggio,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: linee.chiara,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icona nome="piu" misura={20} colore={testoSu.chiaro.debole} spessore={1.9} />
      </View>
      <Forte taglia="minuto" tono="tenue">
        Aggiungi
      </Forte>
    </Toccabile>
  )
}

/**
 * La tessera d'armadio, come nel deck: un **quadrato di vetro** con il capo
 * dentro per intero (`contain`, non `cover`: un cappotto lungo non si taglia),
 * il cuore in alto a destra se è un preferito, il badge «da lavare» in basso a
 * sinistra, e il nome **sotto** la tessera invece che sovrapposto.
 *
 * Il fondo è `superfici.vetro` e non `colori.fondoFoto`: la regola di quel
 * token — *un fondo solo per tutti i capi, mai il colore del capo* — vale
 * uguale, ma qui il deck vuole una superficie traslucida sul gradiente. Il
 * bianco opaco resta dove la foto è grande (`oggi`, `capo/[id]`, `outfit`).
 *
 * Il cuore non è un interruttore: dice, non fa. Si tocca nel dettaglio, dove
 * c'è spazio per un bersaglio vero.
 */
export function CapoInGriglia({ capo, onPress }: { capo: Capo; onPress: () => void }) {
  return (
    <Toccabile onPress={onPress} style={{ gap: griglie.armadio.distanzaNome }}>
      <View
        style={{
          aspectRatio: griglie.armadio.proporzione,
          borderRadius: griglie.armadio.raggio,
          overflow: 'hidden',
          backgroundColor: superfici.vetro,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: superfici.bordo,
          alignItems: 'center',
          justifyContent: 'center',
          // Niente ombra: un fondo traslucido la lascia vedere da sotto — la
          // ragione sta sul `vetro` di `Scheda`.
        }}
      >
        <Image
          source={{ uri: fotoDaMostrare(capo) }}
          style={{ width: '82%', height: '82%' }}
          contentFit="contain"
          transition={durate.breve}
        />
        {capo.preferito ? (
          <View style={{ position: 'absolute', top: 7, right: 7 }}>
            <Icona nome="cuore" misura={16} colore={colori.inchiostro} pieno />
          </View>
        ) : null}
        {capo.stato !== 'pulito' ? (
          <View style={{ position: 'absolute', bottom: 7, left: 7 }}>
            <Badge testo="da lavare" sfondo={colori.pericolo} colore={colori.scheda} />
          </View>
        ) : null}
      </View>
      {/* Una riga sola, e non è un vezzo: `griglie.armadio.altezzaNome` vale
          l'interlinea di **una** riga. Un nome che ne prendesse due renderebbe
          la tessera più alta delle sorelle — in un `flexWrap` la riga diventa
          irregolare — e lo scheletro non combacerebbe più. */}
      <Forte taglia="minuto" numberOfLines={1}>
        {capo.nome}
      </Forte>
    </Toccabile>
  )
}

/**
 * La scheda di un outfit salvato, nella forma del deck: una **riga di tessere
 * quadrate** di vetro col capo dentro per intero, poi il nome e una riga che
 * dice se fidarsi. Prima era una copertina alta 250 con le foto `cover`
 * accostate a filo — un capo tagliato non si riconosce, ed è la stessa ragione
 * per cui `CapoInGriglia` è passata a `contain`.
 *
 * Due cose che il deck non ha e qui restano, perché sono dati veri e non
 * decorazione: l'**occasione** (il deck non la mostra in elenco) e la
 * **freccia** che veste l'avatar. Quest'ultima soprattutto: nel deck la scheda
 * si tocca e porta al dettaglio di un outfit, che nell'app **non esiste** —
 * senza la freccia la scheda non porterebbe da nessuna parte.
 */
export function SchedaOutfit({
  outfit,
  capi,
  onVesti,
}: {
  outfit: Outfit
  capi: Capo[]
  onVesti: () => void
}) {
  const g = griglie.outfit
  const meta = [
    outfit.volte_indossato
      ? `Indossato ${outfit.volte_indossato} volte · ultima ${quandoUsato(outfit.ultimo_uso)}`
      : 'Mai indossato',
    outfit.origine === 'ia' ? 'proposto da Aura' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Scheda vetro imbottitura={spazi.m}>
      <View style={{ flexDirection: 'row', gap: g.distanza }}>
        {capi.slice(0, g.quante).map((capo) => (
          <View
            key={capo.id}
            style={{
              flex: 1,
              aspectRatio: g.proporzione,
              borderRadius: g.raggioTessera,
              backgroundColor: superfici.vetroAlto,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Image
              source={{ uri: fotoDaMostrare(capo) }}
              style={{ width: '84%', height: '84%' }}
              contentFit="contain"
              transition={durate.breve}
            />
          </View>
        ))}
        {/* Un outfit senza capi risolti non deve collassare la riga a zero:
            resta una tessera vuota, che dice «qui ci andava qualcosa». */}
        {capi.length === 0 ? (
          <View
            style={{
              flex: 1,
              aspectRatio: g.proporzione,
              borderRadius: g.raggioTessera,
              backgroundColor: superfici.vetroAlto,
            }}
          />
        ) : null}
      </View>

      {outfit.occasione ? (
        <View style={{ flexDirection: 'row', marginTop: spazi.m }}>
          <Badge testo={outfit.occasione} sfondo={velature.primario} colore={colori.primarioScuro} />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spazi.m,
          marginTop: spazi.m,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Una riga ciascuna: `griglie.outfit` vale l'interlinea di **una**
              riga, e lo scheletro è disegnato su quel conto. */}
          <Forte taglia="guida" numberOfLines={1}>
            {outfit.nome}
          </Forte>
          <Corpo taglia="minuto" tono="tenue" numberOfLines={1}>
            {meta}
          </Corpo>
        </View>
        <BottoneTondo
          nome="freccia"
          colore={colori.scheda}
          sfondo={colori.inchiostro}
          misura={44}
          misuraIcona={18}
          onPress={onVesti}
        />
      </View>
    </Scheda>
  )
}

/**
 * L'elenco degli outfit salvati, con i suoi tre stati. Sta qui e non in una
 * schermata perché **due** rotte lo mostrano: il segmento «Outfit» dentro
 * `(tabs)/armadio.tsx` — dove il deck lo mette — e `app/outfit.tsx`, che resta
 * viva per il rimando dal Profilo e per i link diretti (scelta dell'utente del
 * 2026-09-22, `docs/QUESTIONI.md`). Due copie della stessa lista divergono.
 *
 * Lo scheletro arriva **come prop** e non se lo costruisce da sé: `scheletri.tsx`
 * importa già da questo file, e prenderlo di qui chiuderebbe un anello fra i due
 * moduli. È lo stesso motivo — e la stessa forma — di `scheletro` su
 * `StatoRisorsa` (`ui/stati.tsx`).
 */
export function ElencoOutfit({
  outfit,
  indice,
  pronto,
  scheletro,
  onVesti,
  onVediOggi,
}: {
  outfit: Outfit[]
  indice: Map<string, Capo>
  pronto: boolean
  scheletro: ReactNode
  onVesti: (vestizione: Outfit['vestizione']) => void
  onVediOggi: () => void
}) {
  if (!pronto) return <>{scheletro}</>

  if (outfit.length === 0) {
    return (
      <>
        <Vuoto
          titolo="Non hai ancora salvato niente"
          spiegazione="Quando un consiglio ti convince, premi Salva: lo ritrovi qui, e te lo ripropongo quando torna la stagione giusta."
        />
        <View style={{ alignItems: 'center' }}>
          <BottonePrimario testo="Vedi il consiglio di oggi" onPress={onVediOggi} />
        </View>
      </>
    )
  }

  return (
    <View style={{ gap: spazi.m }}>
      {outfit.map((salvato) => (
        <SchedaOutfit
          key={salvato.id}
          outfit={salvato}
          capi={capiDiVestizione(salvato.vestizione, indice)}
          onVesti={() => onVesti(salvato.vestizione)}
        />
      ))}
    </View>
  )
}

/**
 * Una foto in coda, mentre il modello la guarda: miniatura, nome, la pista che
 * scorre, e a destra come è andata.
 *
 * È la schermata `upload` del deck. Prima la coda aveva **un** segnale per
 * tutte — «Sto guardando il capo 3 di 7» più una pista sola — che diceva
 * quante ne restavano ma non *quale* fosse andata male: il conto dei falliti
 * arrivava tutto insieme alla fine, in un coriandolo.
 *
 * **La pista non finge una percentuale.** Le tre chiamate non ne producono
 * una: c'è mentre la foto è in corso, e sparisce quando ha finito. È la stessa
 * regola di `AttesaLunga`, ed è la stessa pista (`PistaIndeterminata`).
 */
export function RigaFotoInCoda({
  uri,
  nome,
  stato,
  nota,
}: {
  uri: string
  /** Il nome che il modello ha letto, quando c'è. Prima di allora la foto non
   * ha un nome: si dice cosa è, non si inventa. */
  nome?: string
  stato: 'attesa' | 'incorso' | 'fatto' | 'fallito'
  /** Il motivo, per una foto che non è andata. */
  nota?: string
}) {
  const ETICHETTA = {
    attesa: 'In coda',
    incorso: 'La sto guardando',
    fatto: 'Nell\'armadio',
    fallito: 'Non riuscita',
  } as const
  return (
    <Scheda vetro imbottitura={spazi.s}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spazi.m }}>
        <Image
          source={{ uri }}
          style={{
            width: 52,
            height: 52,
            borderRadius: raggi.piccolo,
            backgroundColor: superfici.vetroAlto,
          }}
          contentFit="cover"
        />
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Forte taglia="minuto" numberOfLines={1}>
            {nome ?? 'Foto in arrivo'}
          </Forte>
          {stato === 'incorso' ? <PistaIndeterminata altezza={4} /> : null}
          <Corpo taglia="micro" tono={stato === 'fallito' ? 'medio' : 'tenue'} numberOfLines={1}>
            {nota ?? ETICHETTA[stato]}
          </Corpo>
        </View>
        {stato === 'fatto' ? <Icona nome="spunta" misura={17} colore={colori.primario} /> : null}
        {stato === 'fallito' ? (
          <Badge testo="non riuscita" sfondo={velature.pericolo} colore={colori.pericolo} />
        ) : null}
      </View>
    </Scheda>
  )
}

/**
 * Cosa serve per comporre un outfit, e cosa c'è già: una cella per slot, piena
 * se un capo di quel tipo esiste, tratteggiata se manca.
 *
 * **Due celle, non tre.** Il deck ne disegna tre — sopra, sotto, scarpe — e
 * mostra le scarpe mancanti in rosso. Ma la regola è del dominio, non del
 * disegno: `vestizione_indossabile` (`services/api/src/domain/wardrobe.py`) e
 * il suo specchio in `src/dati/dominio.ts` (`slotMancanti`) chiedono **un
 * sopra e un sotto, oppure un abito**. Le scarpe non sono richieste. Disegnare
 * una terza cella rossa insegnerebbe all'utente una regola che il modello non
 * applica, e a quel punto il conto non tornerebbe: aggiungerebbe le scarpe e
 * il consiglio arriverebbe lo stesso di prima.
 */
export function SlotMancanti({ mancanti }: { mancanti: SlotAvatar[] }) {
  const RICHIESTI: SlotAvatar[] = ['top', 'bottom']
  return (
    <View style={{ flexDirection: 'row', gap: spazi.s }}>
      {RICHIESTI.map((slot) => {
        const manca = mancanti.includes(slot)
        return (
          <View
            key={slot}
            style={{
              flex: 1,
              aspectRatio: 1.35,
              borderRadius: raggi.medio,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              backgroundColor: manca ? velature.pericolo : superfici.vetroAlto,
              borderWidth: manca ? 1.5 : StyleSheet.hairlineWidth,
              borderStyle: manca ? 'dashed' : 'solid',
              borderColor: manca ? velature.pericoloBordo : superfici.bordo,
            }}
          >
            <Icona
              nome={manca ? 'piu' : 'spunta'}
              misura={20}
              colore={manca ? colori.pericoloVelato : colori.primario}
              spessore={1.9}
            />
            <Etichetta taglia="nano" colore={manca ? colori.pericolo : testoSu.chiaro.tenue}>
              {ETICHETTE.slot[slot].toUpperCase()}
            </Etichetta>
          </View>
        )
      })}
    </View>
  )
}

/** Miniatura quadrata: la mostrano il dettaglio di un capo («ci sta bene con») e le liste corte. */
export function Miniatura({
  capo,
  larghezza = 96,
  altezza = 118,
  selezionato,
  onPress,
}: {
  capo: Capo
  larghezza?: number
  altezza?: number
  selezionato?: boolean
  onPress?: () => void
}) {
  return (
    <Toccabile onPress={onPress} scala={0.96} style={{ width: larghezza }}>
      <Image
        source={{ uri: fotoDaMostrare(capo) }}
        style={{
          width: larghezza,
          height: altezza,
          borderRadius: raggi.medio,
          backgroundColor: colori.fondoFoto,
          borderWidth: selezionato ? 2 : 0,
          borderColor: colori.inchiostro,
        }}
        contentFit="cover"
        transition={durate.breve}
      />
      <Forte taglia={11.5} style={{ marginTop: 7 }} numberOfLines={2}>
        {capo.nome}
      </Forte>
    </Toccabile>
  )
}

/**
 * Una foto ancora in coda, prima dell'analisi: la miniatura più la ✕ per
 * toglierla. Non prende un `Capo` — a differenza di `Miniatura` — perché a
 * questo punto non esiste ancora: solo un uri locale, appena scattato o
 * scelto dalla galleria. Usata dal riepilogo di `(tabs)/carica.tsx` prima di
 * «Analizza».
 */
export function MiniaturaFoto({
  uri,
  onRimuovi,
  misura = 92,
}: {
  uri: string
  /** Assente: niente ✕ — la foto è già in analisi, toglierla ora non farebbe niente. */
  onRimuovi?: () => void
  misura?: number
}) {
  return (
    <View style={{ width: misura }}>
      <Image
        source={{ uri }}
        style={{
          width: misura,
          height: misura,
          borderRadius: raggi.medio,
          backgroundColor: colori.fondoFoto,
        }}
        contentFit="cover"
      />
      {onRimuovi ? (
        <View style={{ position: 'absolute', top: -6, right: -6 }}>
          <BottoneTondo
            nome="chiudi"
            onPress={onRimuovi}
            misura={26}
            misuraIcona={13}
            sfondo={colori.inchiostro}
            colore={colori.scheda}
            bordo={colori.sfondo}
          />
        </View>
      ) : null}
    </View>
  )
}

/** L'attributo letto dalla foto: in pericolo se il modello non ne è sicuro. */
export function Attributo({
  chiave,
  valore,
  incerto,
  onPress,
}: {
  chiave: string
  valore: string
  incerto?: boolean
  onPress?: () => void
}) {
  return (
    <Toccabile
      onPress={onPress}
      scala={0.96}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: raggi.medio - 2,
        borderWidth: 1,
        borderColor: incerto ? velo(colori.pericolo, 0.45) : 'transparent',
        backgroundColor: incerto ? velature.pericolo : velo(colori.inchiostro, 0.04),
      }}
    >
      <Etichetta taglia={10} tono="debole" style={{ letterSpacing: 0.9 }}>
        {chiave}
      </Etichetta>
      <Forte taglia={13.5} style={{ marginTop: 2 }}>
        {valore}
      </Forte>
    </Toccabile>
  )
}
