/** I byte dei pacchetti del corpo, sul web: l'asset servito accanto all'app, scaricato. */

import { Asset } from 'expo-asset'

export async function byteDi(modulo: number): Promise<ArrayBuffer> {
  const asset = Asset.fromModule(modulo)
  const risposta = await fetch(asset.uri)
  if (!risposta.ok) throw new Error(`Non riesco a scaricare il corpo dell'avatar (${risposta.status}).`)
  return risposta.arrayBuffer()
}
