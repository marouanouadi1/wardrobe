/**
 * Le poche formattazioni che tornavano uguali in più schermate: il singolare
 * e il plurale scritti a mano, l'euro che distingue «zero» da «non lo
 * sappiamo», una percentuale, una data.
 */

/** «capo» o «capi», secondo `n` — la sola parola, per infilarla in una frase. */
export function parola(n: number, singolare: string, pluraleForma: string): string {
  return n === 1 ? singolare : pluraleForma
}

/** «1 capo» / «5 capi»: il conteggio con la parola giusta già incollata. */
export function conta(n: number, singolare: string, pluraleForma: string): string {
  return `${n} ${parola(n, singolare, pluraleForma)}`
}

/**
 * `null`/assente non è «costa zero»: è «non lo sappiamo», e va mostrato
 * diverso da uno zero vero — vedi `domain.adapters.llm.registry._con_prezzi`.
 */
export function euro(valore: number | null | undefined): string {
  return valore === null || valore === undefined ? '—' : `${valore.toFixed(4)} €`
}

export function percentuale(valore: number): string {
  return `${Math.round(valore * 100)}%`
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
