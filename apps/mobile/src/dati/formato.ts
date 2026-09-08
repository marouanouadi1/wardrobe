/**
 * Le poche formattazioni che tornavano uguali in più schermate: il singolare
 * e il plurale scritti a mano, una data.
 */

/** «capo» o «capi», secondo `n` — la sola parola, per infilarla in una frase. */
export function parola(n: number, singolare: string, pluraleForma: string): string {
  return n === 1 ? singolare : pluraleForma
}

/** «1 capo» / «5 capi»: il conteggio con la parola giusta già incollata. */
export function conta(n: number, singolare: string, pluraleForma: string): string {
  return `${n} ${parola(n, singolare, pluraleForma)}`
}

/** «8 set, 14:30»: la data di una segnalazione. */
export function formattaData(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** «Settembre 2026»: il mese del calendario, con l'iniziale maiuscola come lo scrive il design. */
export function formattaMeseAnno(data: Date): string {
  const testo = data.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return testo.charAt(0).toUpperCase() + testo.slice(1)
}

function stessoGiorno(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** «Oggi», «Ieri», altrimenti «12 marzo»: il giorno di una data, relativo a
 * adesso — l'elenco delle conversazioni e i separatori nella chat. */
export function giornoRelativo(iso: string): string {
  const data = new Date(iso)
  const adesso = new Date()
  if (stessoGiorno(data, adesso)) return 'Oggi'

  const ieri = new Date(adesso)
  ieri.setDate(ieri.getDate() - 1)
  if (stessoGiorno(data, ieri)) return 'Ieri'

  return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}
