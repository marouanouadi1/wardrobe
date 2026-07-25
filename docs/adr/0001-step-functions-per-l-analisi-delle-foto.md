# 0001 — Step Functions per l'analisi delle foto

**Stato:** accettata · **Data:** 2026-07-25

## Contesto

Quando l'utente fotografa un capo devono succedere due cose molto diverse fra
loro:

1. **chiedere a un modello di visione cosa vede** — decine di secondi nel caso
   peggiore, costa denaro a ogni tentativo, e fallisce per motivi che non
   dipendono da noi (provider sovraccarico, 429, timeout, un rifiuto delle
   classificazioni di sicurezza);
2. **scrivere il capo su Postgres** — decine di millisecondi, non fallisce quasi
   mai, e deve avvenire **una volta sola**.

Le due hanno anche bisogni di rete opposti. La prima richiede uscita su Internet;
la seconda richiede l'accesso al database, che sta in subnet isolate. Metterle
nella stessa Lambda significa una funzione che ha bisogno di entrambe le cose, e
quindi un NAT Gateway: circa 32 €/mese prima di trasportare un byte, solo per
far uscire su Internet una funzione che sta dentro la VPC.

## Decisione

Una state machine di Step Functions con due task:

```
[analizza]  ── fuori dalla VPC, nessun accesso al database, retry x3
     │         handler: handlers.analisi.analizza
     ▼
[salva]     ── dentro la VPC, nessuna uscita su Internet
               handler: handlers.analisi.salva
```

L'endpoint HTTP `POST /capi/analisi` avvia l'esecuzione e restituisce subito
`202` con l'identificativo; l'app interroga `GET /capi/analisi/{id}` mentre mostra
i passi. Lo stato dell'esecuzione lo conosce già Step Functions: non teniamo una
tabella «lavori in corso», che sarebbe una seconda verità da tenere allineata.

Il retry sta **solo** sul primo task, ed è la ragione principale della
separazione: ritentare la chiamata al modello ha senso, ritentare la scrittura no.

### Conseguenze

**Nessun NAT Gateway in tutto il progetto.** L'unica funzione con uscita su
Internet (`llm-worker`, più `analizza`) sta fuori dalla VPC; quelle che leggono
il database stanno in subnet isolate e raggiungono AWS tramite VPC endpoint. Le
Lambda dell'API che avrebbero bisogno di un modello — per esempio i suggerimenti
— non escono: invocano `llm-worker` attraverso l'endpoint di Lambda. È il motivo
per cui `adapters/llm/remoto.py` esiste e implementa lo stesso Protocol degli
altri provider: il dominio non sa che in mezzo c'è una Lambda.

Il test `infra/test/stack.test.ts` verifica che il conteggio dei NAT Gateway sia
zero, che il worker non abbia `VpcConfig` e che chi scrive sul database ce l'abbia.
Se qualcuno rimette insieme le due funzioni, i test cadono.

**Il caricamento in blocco diventa possibile.** Venti foto sono venti esecuzioni
indipendenti, non una richiesta HTTP da quaranta secondi.

**In cambio:** un servizio in più da capire, e l'analisi è asincrona anche quando
non servirebbe. L'app deve fare polling, con la complessità che ne segue.

## Alternative scartate

**Una sola Lambda che fa tutto.** Più semplice da leggere e da distribuire, ma
richiede il NAT (costo fisso), mette il retry sulla scrittura oltre che sulla
lettura, e un timeout a metà lascia il capo analizzato ma non salvato — e la
prossima analisi ricomincia da zero, pagando di nuovo il modello.

**Una coda SQS più un consumatore.** Costa meno di Step Functions e regge il
carico, ma lo stato di ogni analisi diventa una tabella nostra: quanti tentativi,
dove si è fermata, com'è finita. Step Functions questo lo fa già, ha una console
che mostra dove si è rotto, e non c'è codice nostro da mantenere per rispondere a
«com'è andata l'analisi di ieri sera».

**Analisi sincrona nella richiesta HTTP.** L'app aspetta e va tutto bene, finché
il provider non prende quaranta secondi. API Gateway chiude a 29 secondi: la
funzione continua a girare e a costare, l'utente vede un errore, e il capo appare
in armadio dopo che se ne è andato. È peggio di un'attesa dichiarata.
