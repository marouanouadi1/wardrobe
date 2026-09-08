/**
 * Le righe che tornano identiche in più schermate: la voce navigabile con
 * icona e chevron (Profilo, l'invito «Chiedi tu» dell'armadio), la riga radio
 * dei selettori di modello (`src/dev/`), il riquadro di una metrica.
 */

import type { ReactNode } from 'react'
import { View } from 'react-native'
import { colori, linee, raggi, spazi, superfici, testoSu, velo } from '../tema/tokens'
import { Bolla, type NomeIcona, Icona, Toccabile } from './base'
import { Corpo, Etichetta, Forte, Numero, Titolo } from './testo'

/**
 * Bolla + titolo + sottotitolo + chevron: la voce navigabile del design.
 * `su="scuro"` è la variante piena (bg inchiostro, chevron ambra) delle
 * scorciatoie in evidenza — «Chiedi tu a Wardrobe», «Modelli in uso».
 */
export function RigaNavigabile({
  icona,
  titolo,
  sottotitolo,
  onPress,
  su = 'chiaro',
  bordo,
}: {
  icona: NomeIcona
  titolo: string
  sottotitolo: string
  onPress?: () => void
  su?: 'chiaro' | 'scuro'
  /** Un bordo sottile invece del solo fondo — le righe «di servizio» di Profilo. */
  bordo?: boolean
}) {
  const scura = su === 'scuro'
  return (
    <Toccabile
      onPress={onPress}
      scala={0.98}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: spazi.xl - 4,
        borderRadius: raggi.medioAlto,
        backgroundColor: scura ? colori.inchiostro : colori.scheda,
        ...(bordo ? { borderWidth: 1, borderColor: linee.tenue } : {}),
      }}
    >
      {scura ? (
        <Bolla nome={icona} misura={40} />
      ) : (
        <Bolla nome={icona} misura={40} sfondo={linee.tenue} colore={colori.inchiostro} />
      )}
      <View style={{ flex: 1 }}>
        <Titolo taglia={17} su={su}>
          {titolo}
        </Titolo>
        <Corpo taglia={12} tono="tenue" su={su}>
          {sottotitolo}
        </Corpo>
      </View>
      <Icona nome="chevron" misura={17} colore={scura ? colori.ambra : 'rgba(21,21,26,0.3)'} spessore={2.4} />
    </Toccabile>
  )
}

/**
 * La riga radio dei selettori di modello: pallino, titolo, sottotitolo, e una
 * spia opzionale a destra («pronto» / «senza chiave», col suo dettaglio di
 * prezzo). Solo per le schermate scure di `src/dev/`.
 */
export function RigaRadio({
  titolo,
  sottotitolo,
  spia,
  spiaColore = colori.ambra,
  dettaglioSpia,
  attivo,
  onPress,
}: {
  titolo: string
  sottotitolo?: string
  spia?: string
  spiaColore?: string
  dettaglioSpia?: string
  attivo: boolean
  onPress: () => void
}) {
  return (
    <Toccabile
      onPress={onPress}
      scala={0.99}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spazi.m,
        paddingHorizontal: 15,
        paddingVertical: 14,
        borderRadius: raggi.medio,
        borderWidth: 1,
        borderColor: attivo ? colori.ambra : 'rgba(247,244,239,0.12)',
        backgroundColor: attivo ? velo(colori.ambra, 0.12) : superfici.suScuro.debole,
      }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: raggi.pillola,
          borderWidth: 2,
          borderColor: attivo ? colori.ambra : 'rgba(247,244,239,0.3)',
          backgroundColor: attivo ? colori.ambra : 'transparent',
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Titolo taglia={15} colore={colori.crema}>
          {titolo}
        </Titolo>
        {sottotitolo ? (
          <Corpo taglia={11.5} colore={testoSu.scuro.tenue}>
            {sottotitolo}
          </Corpo>
        ) : null}
      </View>
      {spia ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Forte taglia={10} colore={spiaColore}>
            {spia}
          </Forte>
          {dettaglioSpia ? (
            <Corpo taglia={10.5} colore="rgba(247,244,239,0.45)">
              {dettaglioSpia}
            </Corpo>
          ) : null}
        </View>
      ) : null}
    </Toccabile>
  )
}

/** La spia «pronto» / «senza chiave»: stessa stringa, stesso colore, in ogni selettore di modello. */
export function spiaModello(configurato: boolean | undefined): { spia: string; spiaColore: string } {
  return configurato
    ? { spia: 'pronto', spiaColore: colori.ambra }
    : { spia: 'senza chiave', spiaColore: colori.coralloChiaro }
}

/** Il riquadro di una metrica scura: numero grande, etichetta piccola sotto. */
export function RiquadroStatistica({
  numero,
  etichetta,
  taglia = 14,
}: {
  numero: string
  etichetta: string
  /** 17 nell'esito del playground, 14 nella valutazione dei modelli. */
  taglia?: number
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: taglia >= 17 ? 11 : 9,
        borderRadius: raggi.piccolo,
        backgroundColor: superfici.suScuro.chip,
      }}
    >
      <Numero taglia={taglia} colore={colori.crema}>
        {numero}
      </Numero>
      <Etichetta
        taglia={taglia >= 17 ? 9.5 : 8.5}
        colore={testoSu.scuro.tenue}
        style={{ marginTop: taglia >= 17 ? 3 : 2 }}
      >
        {etichetta}
      </Etichetta>
    </View>
  )
}

/** Un titolo di sezione debole, ripetuto identico in ogni form di `src/dev/`. */
export function TitoloSezione({ children, su }: { children: ReactNode; su?: 'chiaro' | 'scuro' }) {
  return (
    <Etichetta taglia={11} tono="debole" su={su}>
      {children}
    </Etichetta>
  )
}
