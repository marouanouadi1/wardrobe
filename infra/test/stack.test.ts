/**
 * I test dell'infrastruttura verificano le decisioni, non la sintassi.
 *
 * `cdk synth` da solo dice se il template è valido. Questi test dicono se è
 * ancora *quello che abbiamo deciso*: nessun NAT, nessun bucket pubblico,
 * nessun playground in produzione. Sono le cose che si rompono per distrazione
 * sei mesi dopo, quando nessuno ricorda perché erano importanti.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { AnalisiStack } from '../lib/analisi-stack.js'
import { ApiStack } from '../lib/api-stack.js'
import { ArchivioStack } from '../lib/archivio-stack.js'
import { ambiente } from '../lib/config.js'
import { DatiStack } from '../lib/dati-stack.js'
import { IdentitaStack } from '../lib/identita-stack.js'
import { ReteStack } from '../lib/rete-stack.js'

function costruisci(nomeAmbiente: string) {
  const app = new App()
  const env2 = ambiente(nomeAmbiente)
  const env = { region: env2.regione }
  const comune = { env, env2 }

  const rete = new ReteStack(app, 'Rete', comune)
  const archivio = new ArchivioStack(app, 'Archivio', comune)
  const identita = new IdentitaStack(app, 'Identita', comune)
  const dati = new DatiStack(app, 'Dati', { ...comune, vpc: rete.vpc, sgLambdaDb: rete.sgLambdaDb })

  const portaSegreti = new Stack(app, 'Segreti', { env })
  const segretoProvider = new Secret(portaSegreti, 'ChiaviProvider')

  const analisi = new AnalisiStack(app, 'Analisi', {
    ...comune,
    vpc: rete.vpc,
    sgLambdaDb: rete.sgLambdaDb,
    bucketFoto: archivio.bucketFoto,
    segretoDb: dati.segretoCredenziali,
    segretoProvider,
  })

  const api = new ApiStack(app, 'Api', {
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

  return { rete, archivio, identita, dati, analisi, api }
}

describe('rete', () => {
  it('non crea nessun NAT Gateway', () => {
    // La ragione per cui il worker dei provider sta fuori dalla VPC. Se un
    // giorno qualcuno aggiunge un NAT, quella scelta va rifatta di proposito.
    Template.fromStack(costruisci('dev').rete).resourceCountIs('AWS::EC2::NatGateway', 0)
  })

  it('non ha subnet pubbliche', () => {
    const template = Template.fromStack(costruisci('dev').rete)
    const subnet = template.findResources('AWS::EC2::Subnet')
    for (const risorsa of Object.values(subnet)) {
      assert.notEqual(risorsa.Properties?.MapPublicIpOnLaunch, true)
    }
  })

  it('espone gli endpoint che servono alle Lambda isolate', () => {
    const template = Template.fromStack(costruisci('dev').rete)
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 5)
  })
})

describe('archivio foto', () => {
  it('blocca ogni accesso pubblico', () => {
    Template.fromStack(costruisci('produzione').archivio).hasResourceProperties(
      'AWS::S3::Bucket',
      {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      },
    )
  })

  it('in produzione tiene il bucket anche se lo stack muore', () => {
    const template = Template.fromStack(costruisci('produzione').archivio)
    const bucket = Object.values(template.findResources('AWS::S3::Bucket'))[0]
    assert.equal(bucket?.DeletionPolicy, 'Retain')
  })
})

describe('database', () => {
  it('in sviluppo può dormire a zero capacità', () => {
    Template.fromStack(costruisci('dev').dati).hasResourceProperties('AWS::RDS::DBCluster', {
      ServerlessV2ScalingConfiguration: { MinCapacity: 0, MaxCapacity: 1 },
    })
  })

  it('in produzione non dorme e non si cancella per sbaglio', () => {
    Template.fromStack(costruisci('produzione').dati).hasResourceProperties('AWS::RDS::DBCluster', {
      ServerlessV2ScalingConfiguration: { MinCapacity: 0.5 },
      DeletionProtection: true,
      StorageEncrypted: true,
    })
  })
})

describe('pipeline di analisi', () => {
  it('il worker dei provider non sta nella VPC', () => {
    const template = Template.fromStack(costruisci('dev').analisi)
    const funzioni = template.findResources('AWS::Lambda::Function')
    const worker = Object.values(funzioni).find(
      (f) => f.Properties?.Handler === 'handlers.llm_worker.esegui',
    )
    assert.ok(worker, 'il worker deve esistere')
    assert.equal(worker?.Properties?.VpcConfig, undefined)
  })

  it('chi scrive sul database invece sì', () => {
    const template = Template.fromStack(costruisci('dev').analisi)
    const funzioni = template.findResources('AWS::Lambda::Function')
    const salva = Object.values(funzioni).find(
      (f) => f.Properties?.Handler === 'handlers.analisi.salva',
    )
    assert.ok(salva?.Properties?.VpcConfig, 'la Lambda che scrive deve stare in VPC')
  })

  it('ritenta la chiamata al modello', () => {
    const template = Template.fromStack(costruisci('dev').analisi)
    const macchina = Object.values(template.findResources('AWS::StepFunctions::StateMachine'))[0]
    const definizione = JSON.stringify(macchina?.Properties?.DefinitionString ?? '')
    assert.match(definizione, /Retry/)
  })
})

describe('api', () => {
  it('in produzione le rotte del playground non esistono', () => {
    const template = Template.fromStack(costruisci('produzione').api)
    const rotte = template.findResources('AWS::ApiGatewayV2::Route')
    const chiavi = Object.values(rotte).map((r) => String(r.Properties?.RouteKey))
    assert.equal(
      chiavi.filter((k) => k.includes('/dev/')).length,
      0,
      'nessuna rotta /dev/* in produzione',
    )
    assert.ok(chiavi.some((k) => k.includes('/capi')), 'le rotte vere devono esserci')
  })

  it('in staging il playground c\'è', () => {
    const template = Template.fromStack(costruisci('staging').api)
    const rotte = template.findResources('AWS::ApiGatewayV2::Route')
    const chiavi = Object.values(rotte).map((r) => String(r.Properties?.RouteKey))
    assert.ok(chiavi.some((k) => k.includes('/dev/playground')))
  })

  it('solo /salute è senza autenticazione', () => {
    const template = Template.fromStack(costruisci('produzione').api)
    const rotte = Object.values(template.findResources('AWS::ApiGatewayV2::Route'))
    const senzaAuth = rotte
      .filter((r) => r.Properties?.AuthorizationType !== 'JWT')
      .map((r) => String(r.Properties?.RouteKey))
    assert.deepEqual(senzaAuth, ['GET /salute'])
  })
})
