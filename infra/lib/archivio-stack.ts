/**
 * Il bucket delle foto.
 *
 * Mai pubblico. L'app carica con una PUT firmata e legge con GET firmate a vita
 * breve: la foto dell'armadio di qualcuno non deve poter finire in un indice di
 * ricerca. Vedi docs/adr/0003.
 */

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  ObjectOwnership,
  StorageClass,
} from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'
import { type Ambiente, prefisso } from './config.js'

export class ArchivioStack extends Stack {
  readonly bucketFoto: Bucket

  constructor(scope: Construct, id: string, props: StackProps & { env2: Ambiente }) {
    super(scope, id, props)

    this.bucketFoto = new Bucket(this, 'Foto', {
      bucketName: prefisso(props.env2, 'foto'),
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      enforceSSL: true,
      versioned: props.env2.conservaDati,
      removalPolicy: props.env2.conservaDati ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.env2.conservaDati,
      cors: [
        {
          // Serve alla PUT firmata dal telefono e dall'app web. Non apre il
          // bucket: senza firma valida la richiesta viene comunque rifiutata.
          allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['content-type'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          // Le foto dei capi si guardano tanto nei primi giorni e poi quasi
          // mai: dopo tre mesi stanno bene in accesso infrequente.
          id: 'foto-vecchie-in-infrequent-access',
          transitions: [
            { storageClass: StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(90) },
          ],
        },
        {
          // Gli upload interrotti a metà non devono restare a pagamento.
          id: 'pulisci-upload-incompleti',
          abortIncompleteMultipartUploadAfter: Duration.days(3),
        },
      ],
    })
  }
}
