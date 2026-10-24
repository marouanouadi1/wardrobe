/**
 * «Come mi sta»: l'avatar di MakeHuman, il suo corpo da regolare, e l'outfit scelto.
 *
 * Il corpo è quello di MakeHuman (ADR 0012), calcolato nell'app dai suoi dati grezzi e
 * disegnato con `three` (ADR 0013). Si regola con i cursori di `src/avatar/cursori.ts`, su
 * pochi livelli, e l'altezza è quella di `Misure`: cambiarla qui cambia la misura, non una
 * seconda copia (ADR 0011).
 *
 * **L'avatar non indossa ancora i capi.** Lo farà con i template dei capi, modellati sullo
 * stesso corpo (ADR 0011); fino ad allora porta uno strato neutro, color tela, e l'outfit si
 * legge nella sua scheda. Il manichino SVG tinto dei colori dei capi, che c'era prima, non
 * c'è più: tingere il corpo del colore dominante è proprio la scorciatoia che lo 0011 esclude.
 */

import {
  VALORI_COLORE_CAPELLI,
  VALORI_CORPO_BASE,
  VALORI_TONO_PELLE,
  type Avatar,
  type CorpoBase,
  type Profilo,
  type UnitaLunghezza,
} from '@wardrobe/contracts'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { caricaCorpo } from '../../src/avatar/corpo'
import { cursoriPer, livelloVicino, ZONE } from '../../src/avatar/cursori'
import { calcola, statoDi } from '../../src/avatar/motore'
import type { Tinte } from '../../src/avatar/scena'
import { useArmadio } from '../../src/dati/archivio'
import {
  aCentimetri,
  CAPELLI_AVATAR,
  daCentimetri,
  formattaLunghezza,
  limitiIn,
  PELLI_AVATAR,
  SLOT_ORDINATI,
} from '../../src/dati/dominio'
import { useAzione, useRisorsa } from '../../src/dati/risorsa'
import { salvaProfilo } from '../../src/dati/supabase'
import { colori, ETICHETTE, scena3d, spazi } from '../../src/tema/tokens'
import {
  BottonePrimario,
  BottoneSecondario,
  BottoneTondo,
  Campione,
  LinkTesto,
  Livelli,
  Pillola,
  Scheda,
  Segmenti,
} from '../../src/ui/base'
import { Schermata } from '../../src/ui/guscio'
import { Caricamento, Errore, SenzaRete, Vuoto } from '../../src/ui/stati'
import { Corpo, Etichetta, Forte, Numero } from '../../src/ui/testo'

// `three` pesa: si carica quando l'avatar si disegna, non quando l'app apre la barra delle schede.
const VistaAvatar = lazy(() => import('../../src/avatar/VistaAvatar'))

const SLOT_CON_ABITO = [...SLOT_ORDINATI, 'dress'] as const
const NESSUN_CURSORE: Record<string, number> = {}
type Pannello = 'corpo' | 'outfit'

export default function SchermataAvatar() {
  const { profilo, pronto, erroreCaricamento, ricarica, avvisa, vestizione, indice, mescola, svestiSlot, salvaOutfit } =
    useArmadio()
  const { height: altoSchermo } = useWindowDimensions()
  const unita = profilo?.unita_lunghezza ?? 'cm'

  // Le modifiche si tengono qui finché non si salvano: un tocco su un livello ricalcola il
  // corpo, non scrive il profilo. `undefined` vuol dire «non toccato».
  const [bozza, setBozza] = useState<Avatar | undefined>(undefined)
  const [altezzaBozza, setAltezzaBozza] = useState<number | undefined>(undefined)
  const [scelto, setScelto] = useState<Pannello | undefined>(undefined)
  const avatar = bozza ?? profilo?.avatar ?? null
  const altezzaCm = altezzaBozza ?? profilo?.misure?.altezza_cm ?? null
  const modificato = bozza !== undefined || altezzaBozza !== undefined
  const pannello = scelto ?? (profilo?.avatar ? 'outfit' : 'corpo')

  const corpo = useRisorsa(
    () => (avatar ? caricaCorpo(avatar.corpo_base) : Promise.resolve(null)),
    [avatar?.corpo_base],
  )
  const umano = corpo.dati?.umano.corpoBase === avatar?.corpo_base ? corpo.dati : null
  // Il conto dipende dai cursori, non dall'avatar intero: scegliere una pelle o un colore di
  // capelli non deve ricalcolare il corpo (`cambia` tiene lo stesso oggetto `cursori`).
  const cursoriAvatar = avatar ? (avatar.cursori ?? NESSUN_CURSORE) : null
  const conto = useMemo(() => {
    if (!umano || !cursoriAvatar) return null
    const { stato, altezza } = statoDi(umano.umano, cursoriAvatar, altezzaCm)
    return { vestito: calcola(umano.umano, umano.pelle, stato), altezza }
  }, [umano, cursoriAvatar, altezzaCm])

  const pelle = avatar?.pelle
  const capelli = avatar?.capelli
  const tinte = useMemo<Tinte>(
    () => ({
      pelle: pelle ? PELLI_AVATAR[pelle] : scena3d.pelleNeutra,
      capelli: capelli ? CAPELLI_AVATAR[capelli] : scena3d.capelliNeutri,
      tela: scena3d.tela,
      cielo: scena3d.cielo,
      terra: scena3d.terra,
      chiave: scena3d.chiave,
      taglio: scena3d.taglio,
      riempimento: scena3d.riempimento,
      ombra: scena3d.ombra,
    }),
    [pelle, capelli],
  )

  const { caricamento: salvando, esegui } = useAzione<Profilo>()
  async function salva() {
    if (!profilo || !avatar) {
      avvisa('Non riesco a leggere il tuo profilo: riprova tra poco.')
      return
    }
    const misure =
      altezzaBozza === undefined ? profilo.misure : { ...(profilo.misure ?? {}), altezza_cm: altezzaBozza }
    const salvato = await esegui(() => salvaProfilo({ ...profilo, avatar, misure }))
    if (!salvato) {
      avvisa('Non sono riuscito a salvare il corpo.')
      return
    }
    await ricarica()
    setBozza(undefined)
    setAltezzaBozza(undefined)
  }

  const cambia = (modifica: Partial<Avatar>) => {
    if (avatar) setBozza({ ...avatar, ...modifica })
  }
  const parti = (corpoBase: CorpoBase) => {
    setBozza({ corpo_base: corpoBase, cursori: avatar?.cursori ?? {}, pelle: avatar?.pelle ?? null, capelli: avatar?.capelli ?? null })
    setScelto('corpo')
  }

  const altezzaVista = Math.round(Math.min(460, Math.max(300, altoSchermo * 0.5)))

  return (
    <Schermata
      occhiello="Prova virtuale"
      titolo="Come mi sta"
      fotoProfilo={profilo?.foto_url}
      contentStyle={{ gap: spazi.l }}
      piede={
        modificato ? (
          <View style={{ flexDirection: 'row', gap: spazi.s }}>
            <BottoneSecondario
              testo="Annulla"
              style={{ flex: 1 }}
              onPress={() => {
                setBozza(undefined)
                setAltezzaBozza(undefined)
              }}
            />
            <BottonePrimario
              testo="Salva il corpo"
              style={{ flex: 2 }}
              caricando={salvando}
              disabilitato={salvando || !avatar}
              onPress={() => void salva()}
            />
          </View>
        ) : undefined
      }
    >
      {/* Prima che il profilo arrivi non si sa se un avatar c'è: chiedere «Da che corpo
          parti?» lì farebbe nascere una bozza vuota che poi vince su quello salvato. */}
      {!pronto ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <SenzaRete onRiprova={() => void ricarica()} />
      ) : (
        <>
          {!avatar ? (
            <Scheda vetro style={{ gap: spazi.m }}>
              <Forte taglia="guida">Da che corpo parti?</Forte>
              <Corpo taglia="minuto" tono="medio">
                L’avatar nasce da uno dei due corpi di MakeHuman, e da lì lo regoli tu: altezza, spalle,
                fianchi, gambe. Non è una domanda su chi sei: è il punto da cui partono i cursori, e puoi
                cambiarlo quando vuoi.
              </Corpo>
              <View style={{ flexDirection: 'row', gap: spazi.s }}>
                {VALORI_CORPO_BASE.map((valore) => (
                  <Pillola key={valore} testo={`Corpo ${ETICHETTE.corpoBase[valore].toLowerCase()}`} onPress={() => parti(valore)} />
                ))}
              </View>
            </Scheda>
          ) : corpo.errore ? (
            // Non il testo dell'eccezione: i dati del corpo stanno dentro l'app, e chi la usa non
            // ha niente da fare con «target mancante nei pacchetti». Riprovare sì.
            <View style={{ gap: spazi.s }}>
              <Errore
                titolo="Non riesco a preparare il corpo"
                spiegazione="Non sono riuscito a leggere i dati del corpo. Riprova tra un momento."
              />
              <BottoneSecondario testo="Riprova" onPress={() => void corpo.ricarica()} />
            </View>
          ) : umano && conto ? (
            <Suspense fallback={<View style={{ height: altezzaVista, justifyContent: 'center' }}><Caricamento /></View>}>
              <VistaAvatar
                key={umano.umano.corpoBase}
                umano={umano.umano}
                vestito={conto.vestito}
                tinte={tinte}
                altezza={altezzaVista}
              />
            </Suspense>
          ) : (
            <View style={{ height: altezzaVista, justifyContent: 'center', alignItems: 'center', gap: spazi.s }}>
              <Caricamento />
              <Corpo taglia="minuto" tono="tenue">
                Preparo il corpo…
              </Corpo>
            </View>
          )}

          <Segmenti<Pannello>
            voci={[
              { valore: 'corpo', etichetta: 'Il corpo' },
              { valore: 'outfit', etichetta: 'L’outfit' },
            ]}
            scelta={pannello}
            onScegli={setScelto}
          />

          {pannello === 'corpo' ? (
            avatar ? (
              <PannelloCorpo
                avatar={avatar}
                altezzaCm={altezzaCm}
                raggiunta={conto?.altezza ?? null}
                altezzaMedia={conto && !conto.altezza ? conto.vestito.altezzaCm : null}
                unita={unita}
                onCambia={cambia}
                onAltezza={setAltezzaBozza}
              />
            ) : (
              <Corpo taglia="minuto" tono="tenue">
                Scegli il corpo da cui partire, qui sopra: poi compaiono i cursori.
              </Corpo>
            )
          ) : (
            <PannelloOutfit
              indossati={SLOT_CON_ABITO.filter((slot) => vestizione[slot]).flatMap((slot) => {
                const capo = indice.get(vestizione[slot]!)
                return capo ? [{ slot, nome: capo.nome }] : []
              })}
              onSvesti={svestiSlot}
              onMescola={mescola}
              onSalva={() => void salvaOutfit('Outfit di oggi')}
            />
          )}
        </>
      )}
    </Schermata>
  )
}

function PannelloCorpo({
  avatar,
  altezzaCm,
  raggiunta,
  altezzaMedia,
  unita,
  onCambia,
  onAltezza,
}: {
  avatar: Avatar
  altezzaCm: number | null
  raggiunta: { raggiunta: number; minimo: number; massimo: number } | null
  /** L'altezza del corpo medio, quando `Misure` non ne dice una. */
  altezzaMedia: number | null
  unita: UnitaLunghezza
  onCambia: (modifica: Partial<Avatar>) => void
  onAltezza: (cm: number) => void
}) {
  const cursori = cursoriPer(avatar.corpo_base)
  const valori = avatar.cursori ?? {}
  const daCuiPartire = altezzaCm ?? Math.round(altezzaMedia ?? 165)
  // Il passo e i limiti nell'unità che si legge, come fa `misure.tsx`: limitare in centimetri
  // dopo la conversione lasciava arrivare a 91″, che la schermata delle misure rifiuta.
  const passo = (verso: 1 | -1) => {
    const { min, max } = limitiIn('altezza', unita)
    onAltezza(aCentimetri(Math.min(max, Math.max(min, daCentimetri(daCuiPartire, unita) + verso)), unita))
  }
  const fuori = raggiunta && altezzaCm != null && Math.abs(raggiunta.raggiunta - altezzaCm) >= 1

  return (
    <View style={{ gap: spazi.l }}>
      <Scheda vetro style={{ gap: spazi.s }}>
        <Etichetta>Corpo di partenza</Etichetta>
        <Segmenti<CorpoBase>
          voci={VALORI_CORPO_BASE.map((valore) => ({ valore, etichetta: ETICHETTE.corpoBase[valore] }))}
          scelta={avatar.corpo_base}
          onScegli={(corpo_base) => onCambia({ corpo_base })}
        />
      </Scheda>

      <Scheda vetro style={{ gap: spazi.s }}>
        <Etichetta>Altezza</Etichetta>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Un'azione si dipinge d'inchiostro, non di primario (`tema/tokens.ts`). */}
          <BottoneTondo nome="meno" misura={40} sfondo={colori.inchiostro} colore={colori.scheda} onPress={() => passo(-1)} />
          <Numero taglia="sezione">{formattaLunghezza(daCuiPartire, unita)}</Numero>
          <BottoneTondo nome="piu" misura={40} sfondo={colori.inchiostro} colore={colori.scheda} onPress={() => passo(1)} />
        </View>
        <Corpo taglia="micro" tono="tenue">
          {altezzaCm == null
            ? 'Non l’hai ancora indicata: parto dall’altezza media del corpo. Quella che scegli qui finisce nelle tue misure.'
            : fuori
              ? `Il corpo arriva da ${formattaLunghezza(Math.ceil(raggiunta.minimo), unita)} a ${formattaLunghezza(Math.floor(raggiunta.massimo), unita)}: si ferma lì.`
              : 'È l’altezza delle tue misure: cambiarla qui la cambia anche lì.'}
        </Corpo>
      </Scheda>

      {ZONE.map(({ zona, nome }) => {
        const diQui = cursori.filter((c) => c.zona === zona)
        if (diQui.length === 0) return null
        return (
          <Scheda key={zona} vetro style={{ gap: spazi.m }}>
            <Etichetta>{nome}</Etichetta>
            {diQui.map((c) => (
              <Livelli
                key={c.nome}
                etichetta={c.etichetta}
                livelli={c.livelli}
                valore={livelloVicino(c, valori[c.nome])}
                estremi={c.estremi}
                onCambia={(v) => {
                  // Un cursore al suo valore neutro non si salva: assente vuol dire neutro.
                  const { [c.nome]: _, ...altri } = valori
                  onCambia({ cursori: v === c.neutro ? altri : { ...altri, [c.nome]: v } })
                }}
              />
            ))}
          </Scheda>
        )
      })}

      <Scheda vetro style={{ gap: spazi.m }}>
        <Etichetta>Pelle</Etichetta>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
          {VALORI_TONO_PELLE.map((valore) => (
            <Campione
              key={valore}
              sfondo={PELLI_AVATAR[valore]}
              scelto={avatar.pelle === valore}
              etichetta={ETICHETTE.tonoPelle[valore]}
              onPress={() => onCambia({ pelle: avatar.pelle === valore ? null : valore })}
            />
          ))}
        </View>
        <Etichetta>Capelli</Etichetta>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
          {VALORI_COLORE_CAPELLI.map((valore) => (
            <Campione
              key={valore}
              sfondo={CAPELLI_AVATAR[valore]}
              scelto={avatar.capelli === valore}
              etichetta={ETICHETTE.coloreCapelli[valore]}
              onPress={() => onCambia({ capelli: avatar.capelli === valore ? null : valore })}
            />
          ))}
        </View>
      </Scheda>

      {/* Solo i cursori di questo corpo: quelli dell'altro (il seno, i pettorali) restano nel
          dizionario per quando si torna indietro, ma qui non si vedono e non contano. */}
      {cursori.some((c) => valori[c.nome] !== undefined) ? (
        <LinkTesto
          onPress={() =>
            onCambia({ cursori: Object.fromEntries(Object.entries(valori).filter(([k]) => !cursori.some((c) => c.nome === k))) })
          }
        >
          Riporta il corpo al centro
        </LinkTesto>
      ) : null}
    </View>
  )
}

function PannelloOutfit({
  indossati,
  onSvesti,
  onMescola,
  onSalva,
}: {
  indossati: { slot: (typeof SLOT_CON_ABITO)[number]; nome: string }[]
  onSvesti: (slot: (typeof SLOT_CON_ABITO)[number]) => void
  onMescola: () => void
  onSalva: () => void
}) {
  if (indossati.length === 0) {
    return (
      <Vuoto
        titolo="Ancora nessun outfit"
        spiegazione={'Scegline uno da «Oggi» o dal suggeritore, e lo ritrovi qui.'}
      />
    )
  }
  return (
    <View style={{ gap: spazi.m }}>
      <Corpo taglia="micro" tono="tenue">
        L’avatar non indossa ancora i tuoi capi: arriveranno quando ogni capo avrà la sua forma.
      </Corpo>
      {/* Una pillola per slot indossato, con la ‹×› per toglierlo. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spazi.s }}>
        {indossati.map(({ slot, nome }) => (
          <Pillola key={slot} testo={`${ETICHETTE.slot[slot]}: ${nome} ×`} attiva onPress={() => onSvesti(slot)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spazi.s }}>
        <BottoneSecondario testo="Mescola" icona="mescola" style={{ flex: 1 }} onPress={onMescola} />
        <BottonePrimario testo="Salva outfit" style={{ flex: 1 }} onPress={onSalva} />
      </View>
    </View>
  )
}
