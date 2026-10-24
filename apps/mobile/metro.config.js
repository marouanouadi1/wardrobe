// Il monorepo lo configura `expo/metro-config` da sé (SDK 52+): `watchFolders` e
// `nodeModulesPaths` sono quelli che qui si scrivevano a mano. Non si rimette
// `disableHierarchicalLookup`: impedisce a Metro di trovare i pacchetti che npm
// annida, e con l'SDK 58 faceva cadere il bundle (`semver` 7, annidato sotto
// `react-native-reanimated`). Una copia sola di React la garantisce la radice che
// lo dichiara (`T-23`), non il resolver.
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
