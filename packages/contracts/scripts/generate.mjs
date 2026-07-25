// Secondo passo della catena dei contratti: dallo JSON Schema ai tipi TypeScript.
//
//   domain/models.py  ->  schema/*.json  ->  src/generated/*.ts
//
// Con `--verifica` non scrive: rigenera in memoria e confronta con il
// committato, uscendo con codice 1 se differiscono. È il controllo che gira in
// CI: rinominare un campo nel backend senza rigenerare rompe qui, non in
// produzione.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'json-schema-to-typescript'

const QUI = dirname(fileURLToPath(import.meta.url))
const PACCHETTO = join(QUI, '..')
const RADICE = join(PACCHETTO, '..', '..')
const SCHEMI = join(PACCHETTO, 'schema')
const GENERATI = join(PACCHETTO, 'src', 'generated')

const verifica = process.argv.includes('--verifica')

const INTESTAZIONE = [
  '/**',
  ' * GENERATO — non modificare a mano.',
  ' *',
  ' * Fonte di verità: services/api/src/domain/models.py',
  ' * Rigenera con: npm run contracts:generate',
  ' */',
].join('\n')

function esportaSchemi() {
  // Il backend è l'autorità: chiediamo a lui gli schemi invece di tenerne una
  // copia qui. Se uv non c'è, il messaggio deve dirlo chiaramente.
  try {
    execFileSync('uv', ['run', 'python', 'scripts/export_schema.py'], {
      cwd: join(RADICE, 'services', 'api'),
      stdio: verifica ? 'pipe' : 'inherit',
    })
  } catch (errore) {
    console.error(
      "Non riesco a esportare gli schemi dal backend. Serve `uv` e `npm run api:sync` fatto almeno una volta.",
    )
    throw errore
  }
}

function leggiJson(nome) {
  return JSON.parse(readFileSync(join(SCHEMI, nome), 'utf8'))
}

async function generaModelli() {
  const schema = leggiJson('contratti.json')
  const testo = await compile(schema, 'Contratti', {
    bannerComment: INTESTAZIONE,
    additionalProperties: false,
    style: { semi: false, singleQuote: true },
    enableConstEnums: false,
  })
  return testo
}

function generaRuntime() {
  const enums = leggiJson('_enums.json')
  const costanti = leggiJson('_costanti.json')

  const righe = [
    INTESTAZIONE,
    '',
    '// Le soglie vivono nel dominio, in Python. Arrivano qui generate perché',
    "// l'app deve sapere sotto quale confidenza un attributo va mostrato come",
    '// incerto, e due numeri scritti a mano in due linguaggi divergono sempre.',
  ]

  for (const [nome, valore] of Object.entries(costanti)) {
    righe.push(`export const ${nome} = ${valore} as const`)
  }

  righe.push('', '// I valori delle enum, in ordine, per costruire filtri e selettori.')
  for (const [nome, valori] of Object.entries(enums)) {
    const costante = nome
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toUpperCase()
    righe.push(
      `export const VALORI_${costante} = [${valori.map((v) => `'${v}'`).join(', ')}] as const`,
    )
  }

  return righe.join('\n') + '\n'
}

function confronta(percorso, atteso) {
  let attuale = ''
  try {
    attuale = readFileSync(percorso, 'utf8')
  } catch {
    console.error(`✗ manca ${percorso}: esegui npm run contracts:generate`)
    return false
  }
  if (attuale !== atteso) {
    console.error(`✗ ${percorso} è vecchio: esegui npm run contracts:generate e committa`)
    return false
  }
  return true
}

esportaSchemi()
mkdirSync(GENERATI, { recursive: true })

const uscite = [
  [join(GENERATI, 'modelli.ts'), await generaModelli()],
  [join(GENERATI, 'runtime.ts'), generaRuntime()],
]

if (verifica) {
  const tutteAllineate = uscite.every(([percorso, atteso]) => confronta(percorso, atteso))
  if (!tutteAllineate) {
    console.error('\nI contratti non sono allineati al backend.')
    process.exit(1)
  }
  console.log('✓ contratti allineati al backend')
} else {
  for (const [percorso, contenuto] of uscite) {
    writeFileSync(percorso, contenuto, 'utf8')
    console.log(`✓ ${percorso.replace(RADICE + '/', '')}`)
  }
}
