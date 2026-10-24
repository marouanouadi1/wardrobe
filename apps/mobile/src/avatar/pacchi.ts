/**
 * I byte dei pacchetti del corpo, sul telefono: l'asset dell'app, letto con `expo-file-system`.
 *
 * Non con `fetch(uri)`: su Android un `file://` può tornare in silenzio come corpo «File not
 * found» al posto dei byte (la stessa ragione di `caricaFoto` in `dati/supabase.ts`).
 */

import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'

export async function byteDi(modulo: number): Promise<ArrayBuffer> {
  const asset = await Asset.fromModule(modulo).downloadAsync()
  if (!asset.localUri) throw new Error("Il corpo dell'avatar non è nell'app: manca un file.")
  return new File(asset.localUri).arrayBuffer()
}
