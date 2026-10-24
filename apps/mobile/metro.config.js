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

// I pacchetti del corpo dell'avatar (`assets/avatar/*.bin`, da `tools/avatar/estrai.py`) non
// sono nella lista di default di Metro: senza questa riga `require('…/comune.bin')` non
// risolve. Dichiararli asset è anche ciò che li fa leggere come byte, non come moduli.
config.resolver.assetExts = [...config.resolver.assetExts, 'bin']

module.exports = config
