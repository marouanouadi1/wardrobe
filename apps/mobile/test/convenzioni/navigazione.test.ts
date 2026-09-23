/**
 * Dove la barra delle schede si vede, e quale scheda accende.
 *
 * Da quando vive fuori dal navigatore (`ui/guscio.tsx`, `Q-11`) la barra è
 * disegnata sopra **qualunque** schermata: non è più il gruppo `(tabs)` a
 * decidere chi ce l'ha. Decide `schedaDi(percorso)`, e con lei due cose
 * diverse — cosa si accende, e se `Schermata` riserva lo spazio in fondo.
 *
 * Quindi un errore qui non è cosmetico. Nel verso peggiore la pillola delle
 * schede comparirebbe **sulla schermata di accesso**, cioè cinque scorciatoie
 * verso l'app addosso a chi non ha ancora un token — e le rotte di `(tabs)`
 * sono protette da un `Redirect`, quindi non si entrerebbe: si toccherebbe e
 * basta. Nel verso opposto, una rotta che dovrebbe avere la barra non
 * riserverebbe lo spazio e si vedrebbe il contenuto passarci sotto.
 *
 * `schedaDi` è una funzione pura su una stringa: si prova per quello che è.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { schedaDi } from '../../src/ui/guscio'

const APP = join(__dirname, '..', '..', 'app')

/**
 * I primi segmenti di percorso che l'app serve davvero, letti da `app/`.
 *
 * Una cartella fra parentesi è un **gruppo**: `(tabs)` non compare in nessun
 * URL, e `app/(tabs)/oggi.tsx` serve `/oggi`. Quindi il gruppo si attraversa e
 * le sue figlie contano come rotte di primo livello — senza questo, il test
 * chiedeva conto di un segmento `(tabs)` che nessun percorso conterrà mai.
 */
function segmentiDiRotta(cartella = APP): string[] {
  return readdirSync(cartella, { withFileTypes: true })
    .filter((voce) => !voce.name.startsWith('_') && !voce.name.startsWith('.'))
    .flatMap((voce) =>
      voce.isDirectory() && voce.name.startsWith('(')
        ? segmentiDiRotta(join(cartella, voce.name))
        : [voce.name.replace(/\.tsx$/, '')],
    )
    .filter((nome) => nome !== 'index')
}

describe('la barra delle schede sa dove va', () => {
  test.each(['oggi', 'armadio', 'carica', 'avatar', 'profilo'])(
    'la scheda /%s accende sé stessa',
    (scheda) => {
      expect(schedaDi(`/${scheda}`)).toBe(scheda)
    },
  )

  test('una rotta annidata accende la scheda da cui ci si arriva', () => {
    expect(schedaDi('/capo/abc-123')).toBe('armadio')
    expect(schedaDi('/outfit')).toBe('armadio')
    expect(schedaDi('/suggeritore')).toBe('oggi')
    expect(schedaDi('/chat')).toBe('oggi')
    expect(schedaDi('/calendario')).toBe('profilo')
    expect(schedaDi('/segnalazioni')).toBe('profilo')
  })

  test.each(['/accedi', '/registrati', '/intro', '/preferenze', '/', ''])(
    'prima del login la barra non esiste: %s',
    (percorso) => {
      // Il caso che questo file esiste per impedire. Se qualcuno passa la
      // mappa da «elenco di ciò che c'è» a «elenco di ciò che si esclude»,
      // queste righe diventano rosse prima che lo scopra un utente.
      expect(schedaDi(percorso)).toBeNull()
    },
  )

  test('il banco 3D non è una scheda e non ne accende nessuna', () => {
    // `app/dev/prova-3d.tsx` è lavoro in corso sull'avatar: la barra lì
    // cambierebbe una schermata che nessuno ha chiesto di cambiare.
    expect(schedaDi('/dev/prova-3d')).toBeNull()
  })

  test('la mappa non contiene rotte che non esistono più', () => {
    // Il difetto lento: una rotta viene rinominata o rimossa e la sua riga
    // nella mappa resta, muta, finché qualcuno non la legge come se fosse
    // viva. `schedaDi` non può accorgersene da sola — restituisce `null` e
    // basta, che è indistinguibile da «non l'ho mai avuta».
    const esistenti = new Set(segmentiDiRotta())
    const mappate = ['capo', 'outfit', 'suggeritore', 'chat', 'calendario', 'segnalazioni', 'darivedere', 'impostazioni', 'misure', 'unita', 'svuota']
    for (const segmento of mappate) {
      expect({ segmento, esiste: esistenti.has(segmento) }).toEqual({ segmento, esiste: true })
    }
  })

  test('ogni rotta di primo livello ha una risposta decisa, non per caso', () => {
    // Nessuna rotta deve restare senza che qualcuno abbia deciso: o accende
    // una scheda, o è dichiarata qui sotto fra quelle che la barra non la
    // vogliono. Una rotta nuova rende questo test rosso — ed è lo scopo: la
    // decisione si prende una volta, quando la rotta nasce.
    const senzaBarra = ['accedi', 'registrati', 'intro', 'preferenze', 'dev', 'guidafoto']
    for (const segmento of segmentiDiRotta()) {
      const scheda = schedaDi(`/${segmento}`)
      const deciso = scheda !== null || senzaBarra.includes(segmento)
      expect({ segmento, deciso }).toEqual({ segmento, deciso: true })
    }
  })
})
