// Il monorepo lo configura `expo/metro-config` da sé (SDK 52+): `watchFolders` e
// `nodeModulesPaths` sono quelli che qui si scrivevano a mano. Non si rimette
// `disableHierarchicalLookup`: impedisce a Metro di trovare i pacchetti che npm
// annida, e con l'SDK 58 faceva cadere il bundle (`semver` 7, annidato sotto
// `react-native-reanimated`). Una copia sola di React la garantisce la radice che
// lo dichiara (`T-23`), non il resolver.
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// I pacchetti del corpo dell'avatar (`assets/avatar/*.bin`, da `tools/avatar/estrai.py`) non
// sono nella lista di default di Metro: senza questa riga l'import di `comune.bin` non
// risolve. Dichiararli asset è anche ciò che li fa leggere come byte, non come moduli.
config.resolver.assetExts = [...config.resolver.assetExts, 'bin']

module.exports = config
