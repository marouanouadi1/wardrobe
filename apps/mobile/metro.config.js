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

module.exports = config
