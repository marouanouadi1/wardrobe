/**
 * Il corpo di MakeHuman pronto per il motore: i due pacchetti letti, l'`Umano` costruito, i
 * pesi della posa preparati. Una volta per corpo e per sessione: i pacchetti pesano qualche
 * megabyte, e tornare sulla scheda dell'avatar non deve rileggerli.
 */

import type { CorpoBase } from '@wardrobe/contracts'
// Generati da `tools/avatar/estrai.py`, che li legge dai dati di MPFB: non si toccano a mano.
import COMUNE from '../../assets/avatar/comune.bin'
import DONNA from '../../assets/avatar/donna.bin'
import UOMO from '../../assets/avatar/uomo.bin'
import { leggiPacco, preparaPelle, Umano, type Pelle } from './motore'
import { byteDi } from './pacchi'

const CORPI: Record<CorpoBase, number> = { donna: DONNA, uomo: UOMO }

export interface CorpoPronto {
  umano: Umano
  pelle: Pelle
}

const pronti = new Map<CorpoBase, Promise<CorpoPronto>>()
// Il pacchetto comune serve a tutti e due i corpi: si legge una volta sola.
let comune: Promise<ArrayBuffer> | null = null

export function caricaCorpo(corpo: CorpoBase): Promise<CorpoPronto> {
  let pronto = pronti.get(corpo)
  if (!pronto) {
    pronto = (async () => {
      comune ??= byteDi(COMUNE)
      const [byteComuni, proprio] = await Promise.all([comune, byteDi(CORPI[corpo])])
      const umano = new Umano(corpo, leggiPacco(byteComuni), leggiPacco(proprio))
      return { umano, pelle: preparaPelle(umano) }
    })()
    // Un caricamento fallito non resta in memoria: il prossimo tentativo riparte da capo.
    pronto.catch(() => {
      pronti.delete(corpo)
      comune = null
    })
    pronti.set(corpo, pronto)
  }
  return pronto
}
