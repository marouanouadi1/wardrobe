/**
 * Un ambiente, una configurazione. Niente `if (prod)` sparsi negli stack.
 */

import { RetentionDays } from 'aws-cdk-lib/aws-logs'

export type NomeAmbiente = 'dev' | 'staging' | 'produzione'

export interface Ambiente {
  readonly nome: NomeAmbiente
  readonly regione: string
  /** Il playground è uno strumento interno: in produzione le rotte /dev/* non esistono. */
  readonly playground: boolean
  /**
   * Se falso, l'API non ha nessun authorizer (tranne `/salute`, che non lo ha
   * mai): chiunque trovi l'indirizzo legge e scrive l'armadio, senza login.
   *
   * Esiste solo perché l'app non ha ancora una schermata di login vera —
   * vedi docs/adr — ed è pensato per una prova brevissima fra poche persone
   * fidate, mai per un uso prolungato. Falso per costruzione ovunque tranne
   * `dev`: un ambiente senza autenticazione non deve poter nascere da un
   * `WARDROBE_ENV` sbagliato in staging o produzione.
   */
  readonly autenticazione: boolean
  /** Distruggere il database di staging è un comando; quello di produzione no. */
  readonly conservaDati: boolean
  readonly capacitaDbMin: number
  readonly capacitaDbMax: number
  readonly ritenzioneLog: RetentionDays
}

const AMBIENTI: Record<NomeAmbiente, Ambiente> = {
  dev: {
    nome: 'dev',
    regione: 'eu-south-1',
    playground: true,
    autenticazione: false,
    conservaDati: false,
    // 0 ACU: il cluster si mette a dormire quando nessuno lo usa. Su un
    // ambiente di sviluppo è la differenza fra pochi euro al mese e qualche
    // decina.
    capacitaDbMin: 0,
    capacitaDbMax: 1,
    ritenzioneLog: RetentionDays.ONE_WEEK,
  },
  staging: {
    nome: 'staging',
    regione: 'eu-south-1',
    playground: true,
    autenticazione: true,
    conservaDati: false,
    capacitaDbMin: 0,
    capacitaDbMax: 2,
    ritenzioneLog: RetentionDays.TWO_WEEKS,
  },
  produzione: {
    nome: 'produzione',
    regione: 'eu-south-1',
    playground: false,
    autenticazione: true,
    conservaDati: true,
    // In produzione mai 0: il risveglio da zero costa qualche secondo al primo
    // utente della mattina, che è esattamente il momento in cui l'app serve.
    capacitaDbMin: 0.5,
    capacitaDbMax: 8,
    ritenzioneLog: RetentionDays.THREE_MONTHS,
  },
}

export function ambiente(nome: string | undefined): Ambiente {
  const scelto = (nome ?? 'dev') as NomeAmbiente
  const trovato = AMBIENTI[scelto]
  if (!trovato) {
    throw new Error(
      `Ambiente «${nome}» sconosciuto. Validi: ${Object.keys(AMBIENTI).join(', ')}`,
    )
  }
  return trovato
}

export function prefisso(env: Ambiente, pezzo: string): string {
  return `tela-${env.nome}-${pezzo}`
}
