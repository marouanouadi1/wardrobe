/**
 * Il testo deve restare leggibile sul fondo che la primitiva dipinge davvero.
 *
 * Non si verifica che una prop venga inoltrata: quello è il meccanismo di oggi,
 * ed è già cambiato una volta (dal prop-drilling al contesto, commit `ee7f492`).
 * Si verifica il colore risolto contro il fondo effettivo, che è l'invariante e
 * sopravvive al prossimo refactor.
 *
 * `tsc` non vede questa classe di difetti, perché `su` è opzionale: un testo
 * scuro su fondo scuro compila benissimo. È già costata una regressione —
 * PR #4, «Fix invisible text on the onboarding light button».
 */

import { render, type RenderResult } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  BottonePrimario,
  BottoneSecondario,
  Pillola,
  Scheda,
  Segmenti,
} from '../../src/ui/base'
import { Foglio } from '../../src/ui/avviso'
import { RigaImpostazione } from '../../src/ui/righe'
import { Fondo } from '../../src/ui/fondo'
import { Corpo } from '../../src/ui/testo'
import { colori, testoSu } from '../../src/tema/tokens'

// `testoSu.chiaro.debole` è l'inchiostro velato al 45%: la stessa costante che
// `BottonePrimario` usa per il testo dello stato `disabilitato` — non un
// numero coincidente per caso, un token letto due volte.

/**
 * `Foglio` chiede i bordi sicuri, come `Avviso` e `Testata`: fuori da un
 * provider `useSafeAreaInsets()` solleva. Nell'app vera il provider è in
 * `app/_layout.tsx`; qui le misure si danno esplicite, perché un test che
 * dipende dalle dimensioni di uno schermo immaginario non è riproducibile.
 */
const MISURE = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

/** Il colore che un nodo di testo risolve davvero: `style` è un array. */
function coloreDi(vista: RenderResult, testo: string): string | undefined {
  const nodo = vista.getByText(testo)
  return StyleSheet.flatten(nodo.props.style)?.color
}

describe('il testo è leggibile sul fondo che la primitiva dipinge', () => {
  test('una Scheda dentro un ambiente scuro asserisce il proprio fondo chiaro', async () => {
    // È il caso che il docblock di `fondo.tsx` dice di voler prevenire: la
    // Scheda dipinge bianco anche dentro una Schermata scura, quindi il testo
    // che contiene deve essere scuro, non ereditare il chiaro dell'ambiente.
    const vista = await render(
      <Fondo su="scuro">
        <Scheda>
          <Corpo>contenuto</Corpo>
        </Scheda>
      </Fondo>,
    )
    expect(coloreDi(vista, 'contenuto')).toBe(testoSu.chiaro.forte)
  })

  test('la Scheda di vetro si posa su chiaro, anche dentro un ambiente scuro', async () => {
    // Il vetro è bianco al 60% sul gradiente di `SfondoAura`: chiaro, sempre.
    // `vetro` vince su `su` proprio perché «vetro scuro» non vuol dire niente,
    // e se `su` passasse comunque si otterrebbe testo chiaro su bianco.
    const vista = await render(
      <Fondo su="scuro">
        <Scheda vetro su="scuro">
          <Corpo>dentro il vetro</Corpo>
        </Scheda>
      </Fondo>,
    )
    expect(coloreDi(vista, 'dentro il vetro')).toBe(testoSu.chiaro.forte)
  })

  test('BottonePrimario accento: fondo primario, quindi testo chiaro', async () => {
    // Il `primario` è scuro (#5566D6). Finché la variante era ambra — chiara —
    // qui ci andava l'inchiostro; lasciarcelo darebbe 3.6:1.
    const vista = await render(<BottonePrimario testo="Continua" accento />)
    expect(coloreDi(vista, 'Continua')).toBe(colori.scheda)
  })

  test('BottonePrimario chiaro: testo scuro — la regressione di PR #4', async () => {
    const vista = await render(<BottonePrimario testo="Continua" chiaro />)
    expect(coloreDi(vista, 'Continua')).toBe(colori.inchiostro)
  })

  test('BottonePrimario di default: fondo inchiostro, testo bianco', async () => {
    const vista = await render(<BottonePrimario testo="Continua" />)
    expect(coloreDi(vista, 'Continua')).toBe(colori.scheda)
  })

  test('BottonePrimario pericolo: fondo pericolo, testo bianco', async () => {
    // La variante esiste perché il colore del testo si calcoli insieme al
    // fondo. Prima era `style={{ backgroundColor: colori.pericolo }}` dal punto
    // di chiamata, in `avviso.tsx`.
    const vista = await render(<BottonePrimario testo="Elimina" pericolo />)
    expect(coloreDi(vista, 'Elimina')).toBe(colori.scheda)
  })

  test('BottonePrimario pericolo + disabilitato: `disabilitato` vince, non torna al pericolo', async () => {
    // Il difetto di T-04: `sfondo` e `su` venivano da due ternarie con una
    // precedenza diversa, e questa combinazione era l'unica in cui
    // divergevano — `sfondo` restava quello di `disabilitato` (chiaro) ma
    // `su` dichiarava `'scuro'`. `BottonePrimario` passa sempre `colore`
    // esplicito al testo (mai un `Corpo` nudo che legga il contesto), quindi
    // questo test non può osservare `su` attraverso l'API pubblica — pin
    // invece l'altra metà dell'invariante, quella osservabile: la stessa
    // `variante` unica decide sia il fondo sia il testo, quindi
    // `disabilitato` continua a vincere su `pericolo` anche nel colore del
    // testo (il debole della scala chiara, non il bianco di `pericolo`). Se un
    // domani la precedenza si invertisse, un testo quasi bianco finirebbe su
    // un fondo quasi bianco.
    const vista = await render(<BottonePrimario testo="Elimina" pericolo disabilitato />)
    expect(coloreDi(vista, 'Elimina')).toBe(testoSu.chiaro.debole)
  })

  test('Pillola attiva su fondo chiaro: si dipinge scura, quindi testo chiaro', async () => {
    const vista = await render(
      <Fondo su="chiaro">
        <Pillola testo="Estate" attiva />
      </Fondo>,
    )
    expect(coloreDi(vista, 'Estate')).toBe(testoSu.scuro.forte)
  })

  // Dal passaggio alla palette del deck questa pillola si dipinge `primario`,
  // che è **scuro** come l'inchiostro del ramo chiaro: i due rami vogliono
  // ormai lo stesso verso di testo. Finché era ambra — una tinta chiara — qui
  // ci andava `testoSu.chiaro.forte`, e lasciarcelo avrebbe dato inchiostro su
  // blu, 3.6:1. È il difetto che questo caso esiste per prendere, ed è la
  // ragione per cui il test confronta un colore risolto e non una prop.
  test('Pillola attiva su fondo scuro: si dipinge primario, quindi testo chiaro', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Pillola testo="Estate" attiva />
      </Fondo>,
    )
    expect(coloreDi(vista, 'Estate')).toBe(testoSu.scuro.forte)
  })

  test('Pillola non attiva è trasparente: eredita il fondo, non lo asserisce', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Pillola testo="Inverno" />
      </Fondo>,
    )
    expect(coloreDi(vista, 'Inverno')).toBe(testoSu.scuro.medio)
  })

  test('il segmento attivo dipinge chiaro anche in un ambiente scuro', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Segmenti
          voci={[
            { valore: 'a', etichetta: 'Tutti' },
            { valore: 'b', etichetta: 'Puliti' },
          ]}
          scelta="a"
          onScegli={() => {}}
        />
      </Fondo>,
    )
    expect(coloreDi(vista, 'Tutti')).toBe(testoSu.chiaro.forte)
  })

  test('BottoneSecondario su fondo scuro non cade su un default invisibile', async () => {
    // Il commento a `base.tsx` dichiara questo bug come già accaduto, e senza
    // un test che lo tenesse fermo: «`colore` assente cadeva silenziosamente su
    // un default che su fondo scuro era invisibile».
    const vista = await render(
      <Fondo su="scuro">
        <BottoneSecondario testo="Annulla" onPress={() => {}} />
      </Fondo>,
    )
    expect(coloreDi(vista, 'Annulla')).toBe(testoSu.scuro.forte)
  })

  test('il Foglio si posa su un velo scuro, ma dentro dipinge chiaro e lo asserisce', async () => {
    // Il menu «···» galleggia sopra una schermata qualunque, dietro un velo
    // d'inchiostro. La sua `Scheda` è opaca e chiara: il testo dentro deve
    // essere scuro, non ereditare qualcosa dall'ambiente di sotto.
    const vista = await render(
      <SafeAreaProvider initialMetrics={MISURE}>
        <Fondo su="scuro">
          <Foglio visibile titolo="Felpa blu" voci={[]} onChiudi={() => {}} />
        </Fondo>
      </SafeAreaProvider>,
    )
    expect(coloreDi(vista, 'Felpa blu')).toBe(testoSu.chiaro.forte)
  })

  test('il «perché» di una voce spenta non è il tono dell\'interfaccia inattiva', async () => {
    // La scelta di `Foglio` è che una voce senza azione **si mostra** con la
    // sua ragione, invece di sparire. Allora quella riga è la cosa che va
    // letta, e non può stare al tono più debole che l'app ha — `debole` è
    // 0.45 d'inchiostro, cioè ~3:1 a 11px. Questo test tiene fermo `tenue`:
    // se qualcuno lo abbassa «per coerenza con l'etichetta spenta», diventa
    // rosso qui invece che illeggibile sul telefono.
    const vista = await render(
      <SafeAreaProvider initialMetrics={MISURE}>
        <Foglio
          visibile
          titolo="Felpa blu"
          onChiudi={() => {}}
          voci={[{ etichetta: 'Elimina il capo', icona: 'cestino', perche: 'Manca la rotta.' }]}
        />
      </SafeAreaProvider>,
    )
    expect(coloreDi(vista, 'Manca la rotta.')).toBe(testoSu.chiaro.tenue)
    // E l'etichetta spenta, che invece interfaccia inattiva lo è davvero.
    expect(coloreDi(vista, 'Elimina il capo')).toBe(testoSu.chiaro.debole)
  })
})

describe('una riga che non dipinge eredita, e i suoi colori composti la seguono', () => {
  // `RigaImpostazione` non dipinge niente: sta dentro la `Scheda` di chi la
  // chiama. Ma compone tre colori a mano — il testo spento, la linea che la
  // separa dalla precedente, il chevron — e li leggeva da `testoSu.chiaro.*`
  // senza guardare il fondo. Dentro una scheda scura sarebbero stati invisibili.
  // Oggi in app la scheda è chiara sempre: questo test difende l'invariante,
  // non l'uso di oggi — è lo stesso motivo per cui esiste il file.
  test('spenta su fondo scuro: il testo è il debole scuro, non quello chiaro', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <RigaImpostazione etichetta="Notifiche" nota="Aura non ti manda ancora niente." />
      </Fondo>,
    )
    expect(coloreDi(vista, 'Notifiche')).toBe(testoSu.scuro.debole)
    expect(coloreDi(vista, 'Aura non ti manda ancora niente.')).toBe(testoSu.scuro.tenue)
  })

  test('accesa su fondo chiaro: il testo è il forte chiaro', async () => {
    const vista = await render(
      <Fondo su="chiaro">
        <RigaImpostazione etichetta="Stile e abitudini" onPress={() => {}} />
      </Fondo>,
    )
    expect(coloreDi(vista, 'Stile e abitudini')).toBe(testoSu.chiaro.forte)
  })
})

describe('un colore esplicito vince sempre', () => {
  test('la prop `colore` ha la precedenza sul fondo ereditato', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Corpo colore={colori.primario}>avviso</Corpo>
      </Fondo>,
    )
    expect(coloreDi(vista, 'avviso')).toBe(colori.primario)
  })
})

// Un Text nudo non passa da `useColore`: serve a provare che l'helper legge
// davvero lo stile risolto e non un default del test.
test("l'helper legge lo stile vero", async () => {
  const vista = await render(<Text style={{ color: '#123456' }}>sonda</Text>)
  expect(coloreDi(vista, 'sonda')).toBe('#123456')
})
