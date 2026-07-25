# apps/web — vuoto, ma il posto c'è

Nessun codice qui dentro, per scelta. Il posto è riservato e il workspace è
registrato, così quando servirà un web vero non si dovrà toccare la struttura
del monorepo né i workflow.

## Perché non serve ancora

`apps/mobile` è un'app Expo con React Native Web: `npm run mobile:web` la
esporta già come sito e `npm run build:web` la costruisce in CI. Per la prima
versione del prodotto quello basta — la stessa base di codice serve iOS,
Android e browser.

## Quando aprirlo

Quando servirà qualcosa che l'app non è:

- **una landing page** indicizzabile (l'app esportata da Expo non lo è bene);
- **un pannello interno** per l'assistenza, con tabelle e viste dense che su
  React Native Web costano più di quanto rendono;
- **una dashboard di valutazione dei modelli** più seria del playground: grafici
  di latenza e costo per provider nel tempo, sopra la tabella
  `playground_esecuzioni`.

Il candidato naturale è Next.js: `packages/contracts` è già consumabile così
com'è, e il workflow `mobile.yml` si duplica in `web.yml` cambiando i path del
filtro.
