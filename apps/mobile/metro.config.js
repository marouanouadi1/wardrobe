// Metro in un monorepo: npm mette le dipendenze nella root, quindi il bundler
// deve guardare anche lì. Senza queste tre righe l'app non trova né i pacchetti
// hoistati né @wardrobe/contracts.
const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const radiceApp = __dirname
const radiceMonorepo = path.resolve(radiceApp, '../..')

const config = getDefaultConfig(radiceApp)

config.watchFolders = [radiceMonorepo]
config.resolver.nodeModulesPaths = [
  path.resolve(radiceApp, 'node_modules'),
  path.resolve(radiceMonorepo, 'node_modules'),
]
// Senza questo, un pacchetto risolto dalla root potrebbe caricare una seconda
// copia di React: la classica schermata bianca senza errori.
config.resolver.disableHierarchicalLookup = true

// I formati 3D non sono nella lista di default di Metro: senza questa riga
// `require('.../avatar.glb')` non risolve e il bundle fallisce. Dichiararli
// asset è anche ciò che permette a @react-three/fiber/native di risolverli con
// `Asset.fromModule(...).downloadAsync()` invece che come moduli JavaScript.
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf', 'bin']

module.exports = config
