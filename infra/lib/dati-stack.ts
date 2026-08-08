/**
 * Aurora Serverless v2 Postgres, in subnet isolate.
 *
 * Serverless perché il carico di un armadio digitale è a picchi: tutti si
 * vestono fra le sette e le nove, e il resto della giornata il database non fa
 * nulla. Pagare a capacità usata è la forma giusta per questo profilo.
 */

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { Port, type SecurityGroup, SubnetType, type Vpc } from 'aws-cdk-lib/aws-ec2'
import {
  AuroraPostgresEngineVersion,
  ClusterInstance,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
} from 'aws-cdk-lib/aws-rds'
import type { Construct } from 'constructs'
import { type Ambiente, prefisso } from './config.js'

export class DatiStack extends Stack {
  readonly cluster: DatabaseCluster

  constructor(
    scope: Construct,
    id: string,
    props: StackProps & { env2: Ambiente; vpc: Vpc; sgLambdaDb: SecurityGroup },
  ) {
    super(scope, id, props)

    this.cluster = new DatabaseCluster(this, 'Postgres', {
      clusterIdentifier: prefisso(props.env2, 'postgres'),
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_16_4,
      }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      writer: ClusterInstance.serverlessV2('scrittore', {
        // Aurora applica gli aggiornamenti minori nella finestra di
        // manutenzione, non in mezzo alla mattina.
        autoMinorVersionUpgrade: true,
      }),
      serverlessV2MinCapacity: props.env2.capacitaDbMin,
      serverlessV2MaxCapacity: props.env2.capacitaDbMax,
      defaultDatabaseName: 'wardrobe',
      // La password la genera e la ruota AWS: non passa da noi, non finisce in
      // un file di configurazione, non la conosce nessuno.
      credentials: Credentials.fromGeneratedSecret('wardrobe', {
        secretName: prefisso(props.env2, 'db-credenziali'),
      }),
      storageEncrypted: true,
      backup: {
        retention: Duration.days(props.env2.conservaDati ? 14 : 1),
        preferredWindow: '02:00-03:00',
      },
      deletionProtection: props.env2.conservaDati,
      removalPolicy: props.env2.conservaDati ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
      cloudwatchLogsExports: ['postgresql'],
    })

    // L'unica porta aperta del database, verso l'unico gruppo autorizzato.
    this.cluster.connections.allowFrom(
      props.sgLambdaDb,
      Port.tcp(this.cluster.clusterEndpoint.port),
      'Lambda dell\'API e della pipeline',
    )
  }

  /** Il segreto con host, utente e password: le Lambda leggono da qui. */
  get segretoCredenziali() {
    const segreto = this.cluster.secret
    if (!segreto) {
      throw new Error('Il cluster deve avere un segreto generato: controlla `credentials`.')
    }
    return segreto
  }
}
