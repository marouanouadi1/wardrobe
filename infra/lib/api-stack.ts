/**
 * L'API HTTP.
 *
 * Una Lambda per gruppo di rotte, non una per endpoint: gli handler sono
 * sottili e condividono lo stesso pacchetto, quindi separarli oltre questo
 * punto moltiplicherebbe i cold start senza isolare nulla di utile.
 *
 * Le rotte `/dev/*` esistono solo dove `env.playground` è vero: in produzione
 * il playground non è nascosto dietro un controllo, semplicemente non c'è.
 */

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import type { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito'
import { type SecurityGroup, SubnetType, type Vpc } from 'aws-cdk-lib/aws-ec2'
import { Architecture, Function as Funzione, Runtime } from 'aws-cdk-lib/aws-lambda'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import type { Bucket } from 'aws-cdk-lib/aws-s3'
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager'
import type { StateMachine } from 'aws-cdk-lib/aws-stepfunctions'
import type { Construct } from 'constructs'
import { codiceApi } from './codice-lambda.js'
import { type Ambiente, prefisso } from './config.js'

interface Props extends StackProps {
  env2: Ambiente
  vpc: Vpc
  sgLambdaDb: SecurityGroup
  bucketFoto: Bucket
  segretoDb: ISecret
  userPool: UserPool
  clientApp: UserPoolClient
  stateMachine: StateMachine
  llmWorker: Funzione
}

/** Una rotta: verbo, percorso, e il metodo Python che la serve. */
interface Rotta {
  readonly metodo: HttpMethod
  readonly percorso: string
  readonly handler: string
  readonly pubblica?: boolean
  readonly soloPlayground?: boolean
}

const ROTTE: readonly Rotta[] = [
  { metodo: HttpMethod.GET, percorso: '/salute', handler: 'handlers.health.salute', pubblica: true },

  { metodo: HttpMethod.POST, percorso: '/foto/upload', handler: 'handlers.foto.upload' },

  { metodo: HttpMethod.GET, percorso: '/capi', handler: 'handlers.capi.elenca' },
  { metodo: HttpMethod.POST, percorso: '/capi', handler: 'handlers.capi.crea' },
  { metodo: HttpMethod.GET, percorso: '/capi/{capoId}', handler: 'handlers.capi.leggi' },
  { metodo: HttpMethod.PATCH, percorso: '/capi/{capoId}', handler: 'handlers.capi.aggiorna' },
  {
    metodo: HttpMethod.POST,
    percorso: '/capi/{capoId}/indossato',
    handler: 'handlers.capi.indossa',
  },
  { metodo: HttpMethod.GET, percorso: '/armadio/riepilogo', handler: 'handlers.capi.sommario' },

  { metodo: HttpMethod.POST, percorso: '/capi/analisi', handler: 'handlers.analisi.avvia' },
  {
    metodo: HttpMethod.GET,
    percorso: '/capi/analisi/{esecuzioneId}',
    handler: 'handlers.analisi.stato',
  },

  { metodo: HttpMethod.POST, percorso: '/suggerimenti', handler: 'handlers.suggerimenti.proponi' },

  { metodo: HttpMethod.GET, percorso: '/chat', handler: 'handlers.chat.elenca' },
  { metodo: HttpMethod.POST, percorso: '/chat', handler: 'handlers.chat.invia' },

  { metodo: HttpMethod.GET, percorso: '/outfit', handler: 'handlers.outfit.elenca' },
  { metodo: HttpMethod.POST, percorso: '/outfit', handler: 'handlers.outfit.salva' },
  {
    metodo: HttpMethod.GET,
    percorso: '/outfit/{outfitId}/colori',
    handler: 'handlers.outfit.colori',
  },

  { metodo: HttpMethod.GET, percorso: '/profilo', handler: 'handlers.profilo.leggi' },
  { metodo: HttpMethod.PUT, percorso: '/profilo', handler: 'handlers.profilo.aggiorna' },

  { metodo: HttpMethod.GET, percorso: '/dev/modelli', handler: 'handlers.playground.modelli', soloPlayground: true },
  { metodo: HttpMethod.GET, percorso: '/dev/preset', handler: 'handlers.playground.preset', soloPlayground: true },
  { metodo: HttpMethod.POST, percorso: '/dev/preset', handler: 'handlers.playground.salva_preset', soloPlayground: true },
  { metodo: HttpMethod.GET, percorso: '/dev/contesto', handler: 'handlers.playground.contesto', soloPlayground: true },
  { metodo: HttpMethod.GET, percorso: '/dev/playground/storico', handler: 'handlers.playground.storico', soloPlayground: true },
  { metodo: HttpMethod.POST, percorso: '/dev/playground', handler: 'handlers.playground.esegui_test', soloPlayground: true },
]

export class ApiStack extends Stack {
  readonly api: HttpApi

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props)

    const codice = codiceApi()

    this.api = new HttpApi(this, 'Api', {
      apiName: prefisso(props.env2, 'api'),
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.PUT,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
    })

    // L'authorizer valida firma e scadenza del token Cognito prima che la
    // richiesta arrivi al nostro codice.
    const authorizer = new HttpJwtAuthorizer(
      'Cognito',
      `https://cognito-idp.${props.env2.regione}.amazonaws.com/${props.userPool.userPoolId}`,
      {
        jwtAudience: [props.clientApp.userPoolClientId],
        identitySource: ['$request.header.Authorization'],
      },
    )

    const funzioni = new Map<string, Funzione>()

    for (const rotta of ROTTE) {
      if (rotta.soloPlayground && !props.env2.playground) continue

      const modulo = rotta.handler.split('.')[1] ?? 'api'
      const nomeFunzione = `${modulo}-${rotta.handler.split('.').pop()}`

      let funzione = funzioni.get(rotta.handler)
      if (!funzione) {
        const nomeCompleto = prefisso(props.env2, nomeFunzione).slice(0, 64)
        funzione = new Funzione(this, `Fn${nomeFunzione}`, {
          functionName: nomeCompleto,
          runtime: Runtime.PYTHON_3_12,
          architecture: Architecture.ARM_64,
          code: codice,
          handler: rotta.handler,
          timeout: Duration.seconds(30),
          memorySize: 512,
          logGroup: new LogGroup(this, `Log${nomeFunzione}`, {
            logGroupName: `/aws/lambda/${nomeCompleto}`,
            retention: props.env2.ritenzioneLog,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
          // Tutte le rotte dell'API leggono o scrivono l'armadio, quindi
          // stanno nella VPC. L'uscita su Internet la delegano al worker.
          vpc: props.vpc,
          vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
          securityGroups: [props.sgLambdaDb],
          environment: {
            VERSIONE_APP: props.env2.nome,
            DB_SECRET_ARN: props.segretoDb.secretArn,
            BUCKET_FOTO: props.bucketFoto.bucketName,
            STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
            LLM_WORKER_ARN: props.llmWorker.functionArn,
            PLAYGROUND_ABILITATO: props.env2.playground ? '1' : '0',
          },
        })

        props.segretoDb.grantRead(funzione)
        props.bucketFoto.grantReadWrite(funzione)
        props.stateMachine.grantStartExecution(funzione)
        props.stateMachine.grantRead(funzione)
        props.llmWorker.grantInvoke(funzione)

        funzioni.set(rotta.handler, funzione)
      }

      this.api.addRoutes({
        path: rotta.percorso,
        methods: [rotta.metodo],
        integration: new HttpLambdaIntegration(`Int${nomeFunzione}${rotta.metodo}`, funzione),
        authorizer: rotta.pubblica || !props.env2.autenticazione ? undefined : authorizer,
      })
    }

    new CfnOutput(this, 'UrlApi', {
      value: this.api.apiEndpoint,
      description: "Da mettere in EXPO_PUBLIC_API_URL per l'app",
    })
  }
}
