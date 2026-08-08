#!/usr/bin/env node
/**
 * L'app CDK. Un ambiente per volta, scelto da WARDROBE_ENV o dal contesto.
 *
 *   npm run synth
 *   npm run deploy -- --context ambiente=staging
 */

import { App, Tags } from 'aws-cdk-lib'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { Stack } from 'aws-cdk-lib'
import { AnalisiStack } from '../lib/analisi-stack.js'
import { ApiStack } from '../lib/api-stack.js'
import { ArchivioStack } from '../lib/archivio-stack.js'
import { ambiente, prefisso } from '../lib/config.js'
import { DatiStack } from '../lib/dati-stack.js'
import { IdentitaStack } from '../lib/identita-stack.js'
import { ReteStack } from '../lib/rete-stack.js'

const app = new App()
const env2 = ambiente(app.node.tryGetContext('ambiente') ?? process.env.WARDROBE_ENV)

/**
 * La regione la decide la configurazione; l'account no.
 *
 * Non è pigrizia: uno stack con account concreto obbliga CDK a interrogare AWS
 * già al synth (per esempio per elencare le availability zone), e `cdk synth`
 * in CI non ha credenziali né deve averle. Con l'account agnostico il template
 * si risolve al deploy, dove le credenziali ci sono — e va nell'account del
 * ruolo che sta deployando, che è l'unico posto giusto.
 */
const env = { region: env2.regione }
const comune = { env, env2 }
const nome = (pezzo: string) => `Wardrobe-${env2.nome}-${pezzo}`

const rete = new ReteStack(app, nome('Rete'), comune)
const archivio = new ArchivioStack(app, nome('Archivio'), comune)
const identita = new IdentitaStack(app, nome('Identita'), comune)
const dati = new DatiStack(app, nome('Dati'), {
  ...comune,
  vpc: rete.vpc,
  sgLambdaDb: rete.sgLambdaDb,
})

/**
 * Le chiavi dei provider: un solo segreto con una chiave per provider.
 *
 * CDK crea il contenitore vuoto; i valori si scrivono a mano una volta sola
 * dalla console o dalla CLI. Volutamente non sono in nessun file di questo
 * repository, e nemmeno nelle variabili d'ambiente della Lambda: il worker le
 * legge da qui a runtime.
 */
class SegretiStack extends Stack {
  readonly segretoProvider: Secret
  constructor() {
    super(app, nome('Segreti'), { env })
    this.segretoProvider = new Secret(this, 'ChiaviProvider', {
      secretName: prefisso(env2, 'chiavi-provider'),
      description:
        'Chiavi dei provider: ANTHROPIC_API_KEY (visione, stilista), OPENAI_API_KEY, GOOGLE_API_KEY, FAL_KEY (scontorno)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          ANTHROPIC_API_KEY: '',
          OPENAI_API_KEY: '',
          GOOGLE_API_KEY: '',
          FAL_KEY: '',
        }),
        generateStringKey: 'segnaposto',
      },
    })
  }
}
const segreti = new SegretiStack()

const analisi = new AnalisiStack(app, nome('Analisi'), {
  ...comune,
  vpc: rete.vpc,
  sgLambdaDb: rete.sgLambdaDb,
  bucketFoto: archivio.bucketFoto,
  segretoDb: dati.segretoCredenziali,
  segretoProvider: segreti.segretoProvider,
})

new ApiStack(app, nome('Api'), {
  ...comune,
  vpc: rete.vpc,
  sgLambdaDb: rete.sgLambdaDb,
  bucketFoto: archivio.bucketFoto,
  segretoDb: dati.segretoCredenziali,
  userPool: identita.userPool,
  clientApp: identita.clientApp,
  stateMachine: analisi.stateMachine,
  llmWorker: analisi.llmWorker,
})

Tags.of(app).add('progetto', 'wardrobe')
Tags.of(app).add('ambiente', env2.nome)
Tags.of(app).add('gestito-da', 'cdk')
