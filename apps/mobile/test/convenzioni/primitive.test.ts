/**
 * Nessuno ridipinge dal di fuori il fondo di una primitiva.
 *
 * Questo difetto nessun test di rendering può prenderlo, perché non è un bug
 * della primitiva: è un punto di chiamata che le passa `style={{
 * backgroundColor }}`. La primitiva continua a calcolare il colore del testo
 * per il fondo che *credeva* di dipingere, e il testo sparisce.
 *
 * È esattamente ciò che è successo in PR #4: il diff di `be3392e` mostra una
 * schermata che scriveva `<BottonePrimario style={{ backgroundColor:
 * colori.scheda }} />`. Se serve un fondo diverso, si aggiunge una variante
 * alla primitiva — come `ambra`, `chiaro` e `pericolo` su `BottonePrimario` —
 * così il colore del testo si calcola insieme al fondo.
 *
 * **L'elenco delle primitive non è scritto a mano: si deriva dall'AST.** Una
 * primitiva «ridipingibile» è una funzione esportata da `src/ui/**` che
 * dipinge un `<Fondo su=…>` (asserisce un fondo, non lo eredita soltanto) *e*
 * lascia al chiamante la possibilità di passare `style` (lo distrugge fra i
 * propri parametri). Un elenco scritto a mano ne aveva dimenticate due
 * (`Campo`, `BarraChiedi`) e ne conteneva sei che `tsc` rifiuta già da sole
 * perché non hanno nessuna prop `style` — un test su un nome del genere non
 * verifica niente. Il criterio ha un'eccezione dichiarata, e una sola:
 * `RIDIPINGIBILI_SENZA_FONDO` qui sotto, col motivo accanto.
 *
 * La ricerca dei punti di chiamata legge anch'essa l'AST, non un regex: un
 * `new RegExp('<${primitiva}\\b[^>]*?>')` si ferma alla prima chiusura `>`,
 * che in una chiamata su più righe è quasi sempre quella di `onPress={() =>
 * …}` — tutto ciò che segue, incluso uno `style` scritto dopo, restava fuori
 * da quello che il test ispezionava. Con l'AST si guarda l'attributo `style`
 * per nome, ovunque stia nella lista degli attributi e su quante righe vuole.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const RADICE = join(__dirname, '..', '..')

function sorgenti(cartella: string): string[] {
  const trovati: string[] = []
  for (const voce of readdirSync(cartella)) {
    if (voce === 'node_modules' || voce === '.expo') continue
    const percorso = join(cartella, voce)
    if (statSync(percorso).isDirectory()) trovati.push(...sorgenti(percorso))
    else if (/\.tsx?$/.test(voce)) trovati.push(percorso)
  }
  return trovati
}

function analizza(percorso: string): ts.SourceFile {
  const testo = readFileSync(percorso, 'utf8')
  // TSX per tutti: nessun sorgente di `src/ui/**` usa il cast d'epoca
  // `<Tipo>valore` (verificato a mano), quindi non c'è ambiguità con la
  // sintassi JSX da disambiguare.
  return ts.createSourceFile(percorso, testo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** Vero se, in un punto qualunque sotto `nodo`, compare un `<Fondo su=…>` —
 * aperto o auto-chiuso: è la dichiarazione che asserisce un fondo, non la
 * semplice lettura di `useFondo()`. */
function contieneFondoSu(nodo: ts.Node): boolean {
  let trovato = false
  const visita = (n: ts.Node): void => {
    if (trovato) return
    if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
      if (
        n.tagName.getText() === 'Fondo' &&
        n.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText() === 'su')
      ) {
        trovato = true
        return
      }
    }
    ts.forEachChild(n, visita)
  }
  visita(nodo)
  return trovato
}

/** Vero se il primo parametro distrugge una proprietà chiamata `style`. */
function dichiaraStyle(parametri: ts.NodeArray<ts.ParameterDeclaration>): boolean {
  const primo = parametri[0]
  if (!primo || !ts.isObjectBindingPattern(primo.name)) return false
  return primo.name.elements.some((elemento) => {
    const nome = elemento.propertyName ?? elemento.name
    return ts.isIdentifier(nome) && nome.text === 'style'
  })
}

/**
 * Deriva l'elenco delle primitive «ridipingibili»: funzioni esportate da
 * `src/ui/**` che dipingono un `<Fondo su=…>` e dichiarano `style` fra i loro
 * parametri. Le altre — o non dipingono un fondo proprio, o non lo espongono
 * al chiamante — non possono soffrire di questo difetto.
 */
function derivaPrimitiveRidipingibili(): string[] {
  const nomi: string[] = []
  for (const file of sorgenti(join(RADICE, 'src', 'ui'))) {
    const sorgente = analizza(file)
    const visita = (nodo: ts.Node): void => {
      if (ts.isFunctionDeclaration(nodo) && nodo.name && nodo.body) {
        const esportata = (ts.getCombinedModifierFlags(nodo) & ts.ModifierFlags.Export) !== 0
        if (esportata && dichiaraStyle(nodo.parameters) && contieneFondoSu(nodo.body)) {
          nomi.push(nodo.name.text)
        }
      }
      ts.forEachChild(nodo, visita)
    }
    visita(sorgente)
  }
  return nomi
}

/**
 * Le primitive che il criterio derivato **non** vede, e che vanno controllate
 * comunque: dipingono un fondo che il chiamante può ridipingere, ma non
 * asseriscono nessun `<Fondo>`.
 *
 * `BottoneSecondario` (`base.tsx`) dipinge `backgroundColor: sfondo ??
 * 'transparent'` e ricava l'inchiostro da `useFondo()` — cioè dal fondo *di
 * sotto*. Ridipingerlo dal punto di chiamata è la forma più pura della
 * regressione di PR #4, perché il testo resta calcolato per l'ambiente e non
 * per il fondo nuovo. L'elenco scritto a mano di prima lo conteneva, e quella
 * riga era viva (la prop `style` c'è, quindi `tsc` accettava la chiamata): il
 * criterio `<Fondo su=…>` da solo perderebbe copertura invece di aggiungerne.
 *
 * Resta un nome a mano — uno, con il motivo accanto — e non riapre il difetto
 * di T-02, che era un *elenco* scritto a mano: qui l'elenco si deriva e questa
 * è un'eccezione dichiarata al criterio. Il rimedio definitivo è un criterio
 * su «dipinge un `backgroundColor` che non eredita», che allarga l'insieme
 * derivato e va acceso solo potendo eseguire il gate per vederlo verde prima.
 */
const RIDIPINGIBILI_SENZA_FONDO = ['BottoneSecondario']

/** Vero se, in un punto qualunque sotto `nodo`, compare una chiave
 * `backgroundColor` — dentro un oggetto solo, un array di oggetti
 * (`style={[…]}`), o un'espressione condizionale: si cerca la chiave, non la
 * forma esatta dell'espressione che la contiene. */
function contieneBackgroundColor(nodo: ts.Node): boolean {
  let trovato = false
  const visita = (n: ts.Node): void => {
    if (trovato) return
    if (
      (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'backgroundColor'
    ) {
      trovato = true
      return
    }
    ts.forEachChild(n, visita)
  }
  visita(nodo)
  return trovato
}

describe('le primitive non vengono ridipinte dal punto di chiamata', () => {
  const filesApp = [...sorgenti(join(RADICE, 'app')), ...sorgenti(join(RADICE, 'src'))]
  const primitiveRidipingibili = derivaPrimitiveRidipingibili()
  const daControllare = [...primitiveRidipingibili, ...RIDIPINGIBILI_SENZA_FONDO]

  test('ci sono sorgenti da controllare', () => {
    // Se la scansione trovasse zero file, ogni test qui sotto passerebbe senza
    // verificare niente — che è peggio di un test che non c'è.
    expect(filesApp.length).toBeGreaterThan(20)
  })

  test("l'elenco delle primitive ridipingibili si deriva, e non è vuoto", () => {
    // Un pavimento sul numero, non solo sui nomi: se la derivazione si rompe
    // e smette di trovarne una, `arrayContaining` da solo non se ne
    // accorgerebbe (passerebbe lo stesso con un elenco più corto). Oggi sono
    // sei: le quattro di `base.tsx` più `SchedaFoto` e `PiedeFoto` di
    // `capi.tsx` — quest'ultima non l'aveva notata nessuno finché non l'ha
    // trovata la derivazione stessa.
    expect(primitiveRidipingibili.length).toBeGreaterThanOrEqual(6)
    expect(primitiveRidipingibili).toEqual(
      expect.arrayContaining(['Campo', 'BarraChiedi', 'BottonePrimario', 'Scheda', 'SchedaFoto', 'PiedeFoto']),
    )
    // L'eccezione dichiarata non si perde per strada: è l'unica primitiva
    // che il criterio non vede e che va controllata comunque.
    expect(daControllare).toContain('BottoneSecondario')
  })

  test('nessun `backgroundColor` passato dal punto di chiamata a una primitiva ridipingibile', () => {
    const insieme = new Set(daControllare)
    const colpevoli: string[] = []

    for (const file of filesApp) {
      const sorgente = analizza(file)
      const visita = (nodo: ts.Node): void => {
        if (ts.isJsxSelfClosingElement(nodo) || ts.isJsxOpeningElement(nodo)) {
          if (insieme.has(nodo.tagName.getText())) {
            for (const attributo of nodo.attributes.properties) {
              if (
                ts.isJsxAttribute(attributo) &&
                attributo.name.getText() === 'style' &&
                attributo.initializer &&
                contieneBackgroundColor(attributo.initializer)
              ) {
                const { line } = sorgente.getLineAndCharacterOfPosition(nodo.getStart())
                colpevoli.push(`${file.replace(RADICE + '/', '')}:${line + 1}`)
              }
            }
          }
        }
        ts.forEachChild(nodo, visita)
      }
      visita(sorgente)
    }

    expect(colpevoli).toEqual([])
  })
})
