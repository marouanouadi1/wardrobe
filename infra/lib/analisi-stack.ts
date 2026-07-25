/**
 * La pipeline che trasforma una foto in un capo.
 *
 *   [analizza]  fuori dalla VPC, parla col provider, ritenta se rifiuta
 *        │
 *        ▼
 *   [salva]     dentro la VPC, scrive su Postgres, nessuna uscita su Internet
 *
 * Perché una state machine e non una Lambda sola: la chiamata al modello è
 * lenta, costosa e a volte fallisce per motivi transitori, mentre la scrittura
 * è veloce e deve avvenire una volta sola. Separandole, il retry riguarda solo
 * la parte che vale la pena ritentare — e il confine fra «ha bisogno di
 * Internet» e «ha bisogno del database» diventa il confine fra due funzioni.
 * Vedi docs/adr/0001.
 */

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { type SecurityGroup, SubnetType, type Vpc } from 'aws-cdk-lib/aws-ec2'
import { Architecture, Function as Funzione, Runtime } from 'aws-cdk-lib/aws-lambda'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import type { Bucket } from 'aws-cdk-lib/aws-s3'
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager'
import { DefinitionBody, JsonPath, StateMachine, TaskInput } from 'aws-cdk-lib/aws-stepfunctions'
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks'
import type { Construct } from 'constructs'
import { codiceApi } from './codice-lambda.js'
import { type Ambiente, prefisso } from './config.js'

interface Props extends StackProps {
  env2: Ambiente
  vpc: Vpc
  sgLambdaDb: SecurityGroup
  bucketFoto: Bucket
  segretoDb: ISecret
  segretoProvider: ISecret
}

export class AnalisiStack extends Stack {
  readonly stateMachine: StateMachine
  readonly llmWorker: Funzione

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props)

    const codice = codiceApi()

    // Un log group per funzione, creato da noi: `logRetention` è deprecato e
    // dietro le quinte creava una Lambda custom solo per impostare la
    // ritenzione — una funzione in più da mantenere per niente.
    const gruppoLog = (nomeFunzione: string) =>
      new LogGroup(this, `Log${nomeFunzione}`, {
        logGroupName: `/aws/lambda/${nomeFunzione}`,
        retention: props.env2.ritenzioneLog,
        removalPolicy: RemovalPolicy.DESTROY,
      })

    const comuni = {
      runtime: Runtime.PYTHON_3_12,
      architecture: Architecture.ARM_64,
      code: codice,
      environment: {
        VERSIONE_APP: props.env2.nome,
        SEGRETO_PROVIDER_ARN: props.segretoProvider.secretArn,
      },
    }

    // ── il worker dei provider: fuori dalla VPC, l'unico con uscita ─────────
    this.llmWorker = new Funzione(this, 'LlmWorker', {
      ...comuni,
      functionName: prefisso(props.env2, 'llm-worker'),
      logGroup: gruppoLog(prefisso(props.env2, 'llm-worker')),
      handler: 'handlers.llm_worker.esegui',
      // I modelli di visione su una foto grande possono prendersi mezzo minuto.
      timeout: Duration.seconds(90),
      memorySize: 512,
      description: 'Chiama i provider LLM. Nessun accesso al database.',
    })
    props.segretoProvider.grantRead(this.llmWorker)

    // ── task 1: leggi la foto e interroga il modello ────────────────────────
    const funzioneAnalizza = new Funzione(this, 'Analizza', {
      ...comuni,
      functionName: prefisso(props.env2, 'analizza'),
      logGroup: gruppoLog(prefisso(props.env2, 'analizza')),
      handler: 'handlers.analisi.analizza',
      timeout: Duration.seconds(120),
      memorySize: 1024,
      environment: {
        ...comuni.environment,
        BUCKET_FOTO: props.bucketFoto.bucketName,
      },
      description: 'Visione: foto -> attributi. Fuori dalla VPC.',
    })
    props.bucketFoto.grantRead(funzioneAnalizza)
    props.segretoProvider.grantRead(funzioneAnalizza)

    // ── task 2: salva il capo ───────────────────────────────────────────────
    const funzioneSalva = new Funzione(this, 'Salva', {
      ...comuni,
      functionName: prefisso(props.env2, 'salva-capo'),
      logGroup: gruppoLog(prefisso(props.env2, 'salva-capo')),
      handler: 'handlers.analisi.salva',
      timeout: Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.sgLambdaDb],
      environment: {
        ...comuni.environment,
        DB_SECRET_ARN: props.segretoDb.secretArn,
      },
      description: 'Scrive il capo su Postgres. Dentro la VPC.',
    })
    props.segretoDb.grantRead(funzioneSalva)

    // ── la macchina a stati ────────────────────────────────────────────────
    const analizza = new LambdaInvoke(this, 'AnalizzaFoto', {
      lambdaFunction: funzioneAnalizza,
      payloadResponseOnly: true,
    })

    // Il provider può essere momentaneamente sovraccarico o lento: sono i due
    // casi in cui ritentare ha senso. Un JSON malformato invece non migliora
    // ritentandolo, e infatti il dominio lo classifica come errore definitivo.
    analizza.addRetry({
      errors: ['States.TaskFailed', 'States.Timeout'],
      interval: Duration.seconds(3),
      backoffRate: 2,
      maxAttempts: 3,
    })

    const salva = new LambdaInvoke(this, 'SalvaCapo', {
      lambdaFunction: funzioneSalva,
      payload: TaskInput.fromObject({
        utente_id: JsonPath.stringAt('$.utente_id'),
        chiave_foto: JsonPath.stringAt('$.chiave_foto'),
        provider: JsonPath.stringAt('$.provider'),
        modello: JsonPath.stringAt('$.modello'),
        lettura: JsonPath.objectAt('$.lettura'),
      }),
      payloadResponseOnly: true,
    })

    this.stateMachine = new StateMachine(this, 'PipelineCapo', {
      stateMachineName: prefisso(props.env2, 'analisi-capo'),
      definitionBody: DefinitionBody.fromChainable(analizza.next(salva)),
      // Un'analisi che dopo cinque minuti non è finita non finirà: meglio
      // fallire e dirlo all'utente che restare appesa.
      timeout: Duration.minutes(5),
      comment: 'Foto -> attributi -> capo salvato',
    })
  }
}
