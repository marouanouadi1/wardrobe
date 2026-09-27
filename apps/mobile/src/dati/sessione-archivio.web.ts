/**
 * Dove supabase-js tiene la sessione, sul web: il `localStorage` del browser.
 *
 * Il web serve allo sviluppo (`npm run web`), e lì una sessione che sopravvive
 * a un refresh vale più della cifratura che il browser non offre. Sul telefono
 * la sessione sta nel portachiavi: `sessione-archivio.ts`.
 */

export const archiviazioneSessione = {
  getItem: (chiave: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(chiave)),
  setItem: (chiave: string, valore: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(chiave, valore)
  },
  removeItem: (chiave: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(chiave)
  },
}
