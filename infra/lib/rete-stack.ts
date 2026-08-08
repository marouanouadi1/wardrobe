/**
 * La rete. La decisione che conta: nessun NAT Gateway.
 *
 * Un NAT costa una trentina di euro al mese prima di trasportare un solo byte,
 * e serve solo perché una Lambda dentro la VPC possa raggiungere Internet. Qui
 * non serve, perché nessuna Lambda dentro la VPC ha bisogno di Internet:
 *
 *  - quelle che leggono il database stanno in subnet isolate e parlano con AWS
 *    attraverso i VPC endpoint qui sotto;
 *  - l'unica che chiama i provider LLM (`llm-worker`) sta fuori dalla VPC.
 *
 * Vedi docs/adr/0001. La conseguenza è che questo stack non ha subnet
 * pubbliche: se un giorno servissero, sarà una decisione esplicita.
 */

import { Stack, type StackProps } from 'aws-cdk-lib'
import {
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpointAwsService,
  IpAddresses,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2'
import type { Construct } from 'constructs'
import { type Ambiente, prefisso } from './config.js'

export class ReteStack extends Stack {
  readonly vpc: Vpc

  /**
   * Il gruppo di sicurezza delle Lambda che accedono al database.
   *
   * Sta qui e non negli stack che lo usano per una ragione concreta: se ogni
   * stack creasse il proprio gruppo e poi chiedesse al cluster di aprirsi a
   * quel gruppo, il riferimento andrebbe in entrambe le direzioni e CDK
   * rifiuterebbe il ciclo. Un gruppo solo, creato a monte, è anche una frontiera
   * di fiducia sola da leggere: «chi ha questo gruppo può parlare col database».
   */
  readonly sgLambdaDb: SecurityGroup

  constructor(scope: Construct, id: string, props: StackProps & { env2: Ambiente }) {
    super(scope, id, props)

    this.vpc = new Vpc(this, 'Vpc', {
      vpcName: prefisso(props.env2, 'vpc'),
      ipAddresses: IpAddresses.cidr('10.42.0.0/16'),
      // Due zone: abbastanza per la ridondanza di Aurora, non tre, perché ogni
      // zona in più moltiplica il costo degli interface endpoint qui sotto.
      //
      // Il template usa `Fn::GetAZs` e non un elenco fisso di zone. È una
      // conseguenza voluta di come `bin/wardrobe.ts` definisce l'ambiente:
      // l'account resta agnostico, quindi CDK risolve le zone al deploy invece
      // di interrogare AWS al synth — e `cdk synth` gira in CI senza credenziali.
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'isolata', subnetType: SubnetType.PRIVATE_ISOLATED, cidrMask: 20 },
      ],
    })

    this.sgLambdaDb = new SecurityGroup(this, 'SgLambdaDb', {
      vpc: this.vpc,
      securityGroupName: prefisso(props.env2, 'lambda-db'),
      description: 'Lambda autorizzate a parlare con Postgres',
      allowAllOutbound: true,
    })

    // S3 come gateway endpoint: gratuito, e serve alla Lambda che salva i capi
    // per leggere le foto.
    this.vpc.addGatewayEndpoint('EndpointS3', {
      service: GatewayVpcEndpointAwsService.S3,
    })

    // Gli interface endpoint costano (circa 7 €/mese ciascuno per AZ), ma
    // restano meno di un NAT e non espongono niente a Internet.
    const interfacce: Record<string, InterfaceVpcEndpointAwsService> = {
      EndpointSegreti: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      EndpointLambda: InterfaceVpcEndpointAwsService.LAMBDA,
      EndpointStepFunctions: InterfaceVpcEndpointAwsService.STEP_FUNCTIONS,
      EndpointLog: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    }

    for (const [nome, servizio] of Object.entries(interfacce)) {
      this.vpc.addInterfaceEndpoint(nome, {
        service: servizio,
        subnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
        privateDnsEnabled: true,
      })
    }
  }
}
