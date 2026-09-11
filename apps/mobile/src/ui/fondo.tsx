/**
 * Su che fondo si posa un componente: si eredita, non si ridichiara.
 *
 * Prima `su` era una prop passata a mano, riga per riga, da chi componeva una
 * schermata a ogni testo che ci infilava dentro — e infatti nessuna schermata
 * lo faceva davvero: 35 dei 37 `su=` di questo albero vivono dentro le
 * primitive stesse, non nelle 18 schermate che le usano. Il motivo per cui un
 * contesto e non una prop: `Scheda` e `BollaChat` ricevono `children:
 * ReactNode`, e un `ReactNode` non si può far attraversare da una prop in
 * più — non hanno modo di dirlo ai testi che contengono, se non con un
 * contesto.
 *
 * La regola di chi scrive `<Fondo>`: chi dipinge **in opaco** lo scrive
 * sempre, asserendo ciò che dipinge (`su={su ?? 'chiaro'}` in una `Scheda`
 * senza `su`, non `su={su}` — altrimenti una scheda chiara dentro una
 * `Schermata su="scuro"` erediterebbe `'scuro'` e il suo testo ci sparirebbe
 * sopra). Chi dipinge **in trasparenza** — un velo d'inchiostro al 4-6%,
 * `Segmenti`, `Attributo` — inoltra: una velatura non fonda un fondo, prende
 * quello di sotto, e asserire lì fabbricherebbe lo stesso difetto capovolto.
 * Chi non dipinge nulla e non ha ricevuto `su` da chi lo chiama, non lo
 * scrive: eredita e basta.
 */

import { createContext, useContext, type ReactNode } from 'react'

export type Su = 'chiaro' | 'scuro'

const Contesto = createContext<Su>('chiaro')

/**
 * Dichiara il fondo per tutto ciò che sta dentro. `su` assente = eredita il
 * fondo del contenitore che lo racchiude (di default, `'chiaro'`).
 */
export function Fondo({ su, children }: { su?: Su; children: ReactNode }) {
  const ereditato = useFondo()
  return <Contesto.Provider value={su ?? ereditato}>{children}</Contesto.Provider>
}

/**
 * A differenza di `useSessione`/`useArmadio` (`src/dati/`), non lancia se
 * manca un `<Fondo>` sopra: `'chiaro'` è il default corretto, non un errore
 * di programmazione — è ciò che rende installabile il contesto senza
 * muovere un pixel finché nessun provider dice `'scuro'`.
 */
export function useFondo(): Su {
  return useContext(Contesto)
}
