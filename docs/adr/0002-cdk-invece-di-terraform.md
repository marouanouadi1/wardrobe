# 0002 — CDK in TypeScript invece di Terraform

**Stato:** accettata · **Data:** 2026-07-25

## Contesto

L'infrastruttura è tutta su AWS: HTTP API, Lambda, Aurora Serverless, S3,
Cognito, Step Functions, VPC con endpoint. Serve descriverla come codice, in un
monorepo dove la parte TypeScript esiste già (app Expo e contratti generati) e
la parte Python è il servizio applicativo.

## Decisione

**AWS CDK in TypeScript**, un ambiente per volta scelto da contesto
(`--context ambiente=staging`), sei stack separati per confine di
responsabilità: rete, archivio, dati, identità, analisi, api.

Tre cose hanno pesato più delle altre:

**L'infrastruttura la testiamo.** `infra/test/stack.test.ts` afferma le decisioni
che contano: nessun NAT Gateway, nessun bucket pubblico, `deletionProtection` in
produzione, nessuna rotta `/dev/*` in produzione, solo `/salute` senza
autenticazione. Sono asserzioni su un albero di oggetti, scritte con
`aws-cdk-lib/assertions` e il runner di Node — nessuna dipendenza in più. Con
Terraform lo stesso controllo si fa su un piano JSON o con uno strumento a parte
(Sentinel, Conftest, tflint): possibile, ma è un altro linguaggio e un altro
ciclo di vita.

**Un linguaggio in meno.** Il monorepo ha già TypeScript e Python. Aggiungere HCL
significa una terza sintassi, un terzo formattatore, un terzo modo di fare
condizioni e cicli. Le condizioni degli ambienti stanno in un file
(`lib/config.ts`) come dati tipizzati, e il compilatore verifica che ogni
ambiente sia completo.

**CDK costruisce anche il pacchetto Lambda.** `lib/codice-lambda.ts` invoca
`services/api/scripts/build_lambda.sh` durante il synth, quindi `cdk deploy`
distribuisce sempre il codice corrente. Con Terraform serve un passo di build
esterno e un artefatto versionato a parte — un prerequisito non documentato, cioè
la cosa che rompe il deploy alle sette di sera.

### Conseguenze

CloudFormation resta sotto, con i suoi limiti: rollback lenti, messaggi d'errore
avari, alcune risorse che si aggiornano solo sostituendole. In cambio lo stato non
è un file da custodire: lo tiene AWS, con il locking incluso.

Gli stack fissano la **regione** ma lasciano l'**account agnostico**. Non è
pigrizia: uno stack con account concreto obbliga CDK a interrogare AWS già al
synth (per esempio per elencare le availability zone), e `cdk synth` in CI non ha
credenziali né deve averle. Con l'account agnostico il template si risolve al
deploy, nell'account del ruolo che sta deployando.

Chi arriva su questo repository deve conoscere CDK. È un costo reale, mitigato dal
fatto che è TypeScript come metà del monorepo.

## Alternative scartate

**Terraform.** Migliore su più cloud, stato esplicito, un `plan` più leggibile di
un changeset CloudFormation. Ma qui non c'è multi-cloud, e il vantaggio vero —
`plan` prima di applicare — c'è anche con `cdk diff`. Il costo (terzo linguaggio,
test dell'infrastruttura con un altro strumento, build della Lambda fuori dal
flusso) non è compensato.

**SAM o Serverless Framework.** Ottimi finché il progetto è solo Lambda più API
Gateway. Qui ci sono VPC con quattro interface endpoint, Aurora Serverless,
Cognito e Step Functions: si finisce a scrivere CloudFormation grezzo dentro un
template SAM, che è il peggiore dei due mondi.

**CDK in Python**, per avere un linguaggio solo insieme al backend. Scartata
perché l'app e i contratti sono TypeScript, e perché il supporto CDK in
TypeScript è quello di prima classe: gli esempi, le librerie di construct e i tipi
nascono lì.

**Console AWS a mano.** Va bene per provare qualcosa il primo giorno. Al secondo
ambiente non si sa più cosa è stato cambiato dove.
