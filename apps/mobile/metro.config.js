// Non si rimette `disableHierarchicalLookup`: impedisce a Metro di trovare i
// pacchetti che npm annida, e con l'SDK 58 faceva cadere il bundle (`semver` 7,
// annidato sotto `react-native-reanimated`). Una copia sola di React la garantisce
// il fatto che questo è l'unico progetto npm del repo (ADR 0014), non il resolver.
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// I pacchetti del corpo dell'avatar (`assets/avatar/*.bin`, da `tools/avatar/estrai.py`) non
// sono nella lista di default di Metro: senza questa riga l'import di `comune.bin` non
// risolve. Dichiararli asset è anche ciò che li fa leggere come byte, non come moduli.
config.resolver.assetExts = [...config.resolver.assetExts, 'bin']

module.exports = config
