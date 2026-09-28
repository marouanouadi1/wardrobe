/**
 * I test girano sempre con l'ora di Roma, anche dove la macchina è in UTC (la
 * CI). Senza, un test sul «giorno locale» passerebbe anche con `toISOString()`,
 * che è proprio il difetto che deve prendere: in UTC le due cose coincidono.
 * `globalSetup` gira prima dei worker di jest, che ereditano la variabile.
 */
module.exports = () => {
  process.env.TZ = 'Europe/Rome'
}
