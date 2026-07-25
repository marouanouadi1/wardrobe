/**
 * Il contratto dell'avatar.
 *
 * Esiste perché il 3D è la cosa più a rischio di tutto il prodotto: dipende da
 * WebGL sul telefono, da una libreria in più e da una resa che può non
 * convincere. Definendo un'interfaccia e due implementazioni, la schermata
 * «Come mi sta» funziona comunque — e sostituire il manichino con un modello
 * migliore, o con la foto dell'utente, non tocca nessun'altra riga di codice.
 *
 * Nota cosa riceve un renderer: **colori, non fotografie**. È il vincolo che
 * arriva da `mannequin.js` del design, e insieme è ciò che lega l'avatar al
 * modello di visione: il colore dominante letto dalla foto è l'unica cosa che
 * il manichino sa indossare.
 */

import type { VestizioneColori } from '@wardrobe/contracts'

export interface PropsRenderer {
  colori: VestizioneColori
  /** La foto a figura intera dell'utente: la usa solo il renderer 2D. */
  fotoUtente?: string | null
  /** Chiamata quando il renderer non riesce a partire: la schermata ripiega. */
  onNonDisponibile?: (motivo: string) => void
}

export type ModoAvatar = 'manichino' | 'foto'

export const MODI_AVATAR = [
  { valore: 'manichino' as const, etichetta: 'Manichino 3D' },
  { valore: 'foto' as const, etichetta: 'La tua foto' },
] as const
