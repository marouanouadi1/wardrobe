/**
 * Cognito: «l'utente accede e vede il suo armadio».
 *
 * L'autenticazione la verifica API Gateway con un authorizer JWT, prima che la
 * richiesta arrivi al nostro codice. Per questo `handlers/_http.py` può fidarsi
 * della claim `sub` senza validare nulla: se siamo dentro l'handler, il token
 * era buono.
 */

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import {
  AccountRecovery,
  OAuthScope,
  UserPool,
  UserPoolClient,
  UserPoolEmail,
} from 'aws-cdk-lib/aws-cognito'
import type { Construct } from 'constructs'
import { type Ambiente, prefisso } from './config.js'

export class IdentitaStack extends Stack {
  readonly userPool: UserPool
  readonly clientApp: UserPoolClient

  constructor(scope: Construct, id: string, props: StackProps & { env2: Ambiente }) {
    super(scope, id, props)

    this.userPool = new UserPool(this, 'Utenti', {
      userPoolName: prefisso(props.env2, 'utenti'),
      selfSignUpEnabled: true,
      // Email come identificativo: chiedere di inventare un nome utente è un
      // attrito gratuito su un'app che deve essere facilissima da usare.
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      email: UserPoolEmail.withCognito(),
      removalPolicy: props.env2.conservaDati ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    })

    this.clientApp = this.userPool.addClient('AppMobile', {
      userPoolClientName: prefisso(props.env2, 'app'),
      // Nessun client secret: un'app che sta sul telefono non può custodire
      // segreti, e finger di poterlo fare è peggio che non averne.
      generateSecret: false,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
        callbackUrls: ['tela://auth', 'http://localhost:8081'],
        logoutUrls: ['tela://auth', 'http://localhost:8081'],
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      // Trenta giorni: l'utente non deve rifare il login ogni settimana per
      // guardare il proprio armadio.
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    })

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId })
    new CfnOutput(this, 'ClientId', { value: this.clientApp.userPoolClientId })
  }
}
