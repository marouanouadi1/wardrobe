/**
 * Il contratto dell'avatar.
 *
 * Esiste perché il 3D è la cosa più a rischio di tutto il prodotto: dipende da
 * WebGL sul telefono, da una libreria in più e da una resa che può non
 * convincere. Definendo un'interfaccia e due implementazioni, la schermata
 * «Come mi sta» funziona comunque — e sostituire il manichino con un modello
 * migliore, o con la foto dell'utente, non tocca nessun'altra riga di codice.
 *
 * Nota cosa riceve un renderer oggi: **colori, non fotografie**. È il vincolo
 * ereditato da `mannequin.js` del design — il colore dominante letto dalla foto è
 * l'unica cosa che il manichino sa indossare — ed è il primo passo, non la forma
 * definitiva. La direzione (`docs/adr/0004`) è che il capo si veda dalla propria
 * foto scontornata, applicata come texture su una geometria, addosso a un corpo
 * fedele alla persona. Quando succederà, questa interfaccia crescerà: i colori
 * restano per il ripiego.
 */

import type { VestizioneColori } from '@wardrobe/contracts'

export interface PropsRenderer {
  colori: VestizioneColori
  /** La foto a figura intera dell'utente: la usa solo il renderer 2D. */
  fotoUtente?: string | null
  /** Chiamata quando il renderer non riesce a partire: la schermata ripiega. */
  onNonDisponibile?: (motivo: string) => void
}

/**
 * I due modi esistono perché nessuno dei due mostra ancora il capo addosso: uno
 * dà una figura girabile che non è la tua, l'altro sei tu ma con i capi di fianco
 * invece che indossati. Il bivio è destinato a chiudersi — vedi `docs/adr/0004` —
 * non a essere conservato.
 */
export type ModoAvatar = 'manichino' | 'foto'

export const MODI_AVATAR = [
  { valore: 'manichino' as const, etichetta: 'Manichino 3D' },
  { valore: 'foto' as const, etichetta: 'La tua foto' },
] as const
