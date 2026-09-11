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
import {
  BottonePrimario,
  BottoneSecondario,
  Pillola,
  Scheda,
  Segmenti,
} from '../../src/ui/base'
import { Fondo } from '../../src/ui/fondo'
import { Corpo } from '../../src/ui/testo'
import { colori, testoSu } from '../../src/tema/tokens'

// `testoSu.chiaro.debole` **è** `rgba(21,21,26,0.4)`: la stessa costante che
// `BottonePrimario` usa per il testo dello stato `disabilitato` — non un
// numero coincidente per caso, un token letto due volte.

/** Il colore che un nodo di testo risolve davvero: `style` è un array. */
function coloreDi(vista: RenderResult, testo: string): string | undefined {
  const nodo = vista.getByText(testo)
  return StyleSheet.flatten(nodo.props.style)?.color
}

describe('il testo è leggibile sul fondo che la primitiva dipinge', () => {
  test('una Scheda dentro un ambiente scuro asserisce il proprio fondo chiaro', async () => {
    // È il caso che il docblock di `fondo.tsx` dice di voler prevenire: la
    // Scheda dipinge crema anche dentro una Schermata scura, quindi il testo
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

  test('BottonePrimario chiaro: testo scuro — la regressione di PR #4', async () => {
    const vista = await render(<BottonePrimario testo="Continua" chiaro />)
    expect(coloreDi(vista, 'Continua')).toBe(colori.inchiostro)
  })

  test('BottonePrimario di default: fondo inchiostro, testo crema', async () => {
    const vista = await render(<BottonePrimario testo="Continua" />)
    expect(coloreDi(vista, 'Continua')).toBe(colori.crema)
  })

  test('BottonePrimario pericolo: fondo corallo, testo crema', async () => {
    // La variante esiste perché il colore del testo si calcoli insieme al
    // fondo. Prima era `style={{ backgroundColor: colori.corallo }}` dal punto
    // di chiamata, in `avviso.tsx`.
    const vista = await render(<BottonePrimario testo="Elimina" pericolo />)
    expect(coloreDi(vista, 'Elimina')).toBe(colori.crema)
  })

  test('BottonePrimario pericolo + disabilitato: `disabilitato` vince, non torna al corallo', async () => {
    // Il difetto di T-04: `sfondo` e `su` venivano da due ternarie con una
    // precedenza diversa, e questa combinazione era l'unica in cui
    // divergevano — `sfondo` restava quello di `disabilitato` (chiaro) ma
    // `su` dichiarava `'scuro'`. `BottonePrimario` passa sempre `colore`
    // esplicito al testo (mai un `Corpo` nudo che legga il contesto), quindi
    // questo test non può osservare `su` attraverso l'API pubblica — pin
    // invece l'altra metà dell'invariante, quella osservabile: la stessa
    // `variante` unica decide sia il fondo sia il testo, quindi
    // `disabilitato` continua a vincere su `pericolo` anche nel colore del
    // testo (il debole della scala chiara, non il crema di `pericolo`). Se un
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

  test('Pillola attiva su fondo scuro: si dipinge ambra, quindi testo scuro', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Pillola testo="Estate" attiva />
      </Fondo>,
    )
    expect(coloreDi(vista, 'Estate')).toBe(testoSu.chiaro.forte)
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
})

describe('un colore esplicito vince sempre', () => {
  test('la prop `colore` ha la precedenza sul fondo ereditato', async () => {
    const vista = await render(
      <Fondo su="scuro">
        <Corpo colore={colori.ambra}>avviso</Corpo>
      </Fondo>,
    )
    expect(coloreDi(vista, 'avviso')).toBe(colori.ambra)
  })
})

// Un Text nudo non passa da `useColore`: serve a provare che l'helper legge
// davvero lo stile risolto e non un default del test.
test("l'helper legge lo stile vero", async () => {
  const vista = await render(<Text style={{ color: '#123456' }}>sonda</Text>)
  expect(coloreDi(vista, 'sonda')).toBe('#123456')
})
