// La configurazione di Expo, senza eccezioni.
const expoConfig = require('eslint-config-expo/flat')

module.exports = [...expoConfig, { ignores: ['dist/*', '.expo/*', 'node_modules/*'] }]
