/**
 * «Come mi sta»: bloccata finché l'avatar vero non è integrato.
 *
 * La tab resta registrata (sei punti dell'app ci navigano già) ma il
 * contenuto è un placeholder: niente manichino a primitive tinte spacciato
 * per il prodotto finito mentre si lavora sullo scontorno/texture vero.
 */

import { View } from 'react-native'
import { useArmadio } from '../../src/dati/archivio'
import { spazi } from '../../src/tema/tokens'
import { Vuoto } from '../../src/ui/base'
import { Testata } from '../../src/ui/testata'

export default function SchermataAvatar() {
  const { profilo } = useArmadio()

  return (
    <View style={{ flex: 1 }}>
      <Testata occhiello="Prova virtuale" titolo="Come mi sta" fotoProfilo={profilo?.foto_url} />
      <View style={{ flex: 1, paddingHorizontal: spazi.xl, justifyContent: 'center' }}>
        <Vuoto
          titolo="In arrivo"
          spiegazione="L'avatar è in lavorazione: per ora il manichino a primitive tinte non è pronto da mostrare. Torna qui quando lo scontorno e la texture vera saranno integrati."
        />
      </View>
    </View>
  )
}
