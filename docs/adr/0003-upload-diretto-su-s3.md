# 0003 — Upload delle foto diretto su S3, con URL firmato

**Stato:** accettata · **Data:** 2026-07-25

## Contesto

L'intero prodotto si regge sul fatto che fotografare un capo sia banale. Se
aggiungere venti capi è faticoso, l'armadio resta vuoto e tutto il resto — i
suggerimenti, l'avatar — non ha materiale su cui lavorare.

Una foto da telefono è 2–5 MB. Le Lambda dell'API stanno dietro API Gateway, che
ha un limite di **10 MB** sul payload e obbliga a codificare in base64 il
binario, gonfiandolo di un terzo. Le foto sono anche il dato più personale che
maneggiamo: sono i vestiti di qualcuno, dentro casa sua.

## Decisione

L'app carica **direttamente su S3** con un URL firmato, e il file non passa mai
dal nostro backend:

```
app                    API                      S3
 │  POST /foto/upload   │                        │
 ├──────────────────────>  firma PUT (15 min)    │
 │  <── url + chiave ───┤                        │
 │                                               │
 ├─── PUT (la foto, senza intermediari) ────────>│
 │                                               │
 │  POST /capi/analisi (solo la chiave)          │
 ├──────────────────────>  avvia la pipeline     │
```

Le decisioni collegate, tutte visibili in `infra/lib/archivio-stack.ts`:

- **il bucket non è mai pubblico**: `BLOCK_ALL`, `BUCKET_OWNER_ENFORCED`, TLS
  obbligatorio;
- **anche la lettura è firmata**, a vita breve: `handlers/capi.py` aggiunge un URL
  di lettura a ogni capo che restituisce. Non esiste nessun URL permanente da
  poter condividere per sbaglio;
- **il Content-Type entra nella firma**: se l'app manda qualcosa che non è
  l'immagine dichiarata, S3 rifiuta. Per questo `UploadFirmato` restituisce anche
  le intestazioni da usare;
- **gli upload interrotti si cancellano da soli** dopo tre giorni, e dopo novanta
  le foto passano in accesso infrequente: una foto di un capo si guarda molto la
  prima settimana e quasi mai dopo.

### Conseguenze

Il caricamento in blocco di venti capi è venti PUT parallele verso S3, che è fatto
per quello. Nessun limite di payload, nessuna Lambda che paga i secondi necessari
a ricevere qualche megabyte, nessun costo di transito attraverso il nostro codice.

In cambio: il client ha un passo in più (firma, poi upload), e serve il CORS sul
bucket — che non lo apre, perché senza una firma valida la richiesta viene comunque
rifiutata. E il backend non vede il byte della foto al momento del caricamento:
non possiamo validare lì che sia davvero un'immagine. Il primo a guardarla è il
modello di visione, che se la foto non è un capo restituisce `tipo: null` e
`domain.vision.crea_capo` la rifiuta.

## Alternative scartate

**Foto in base64 nel corpo della richiesta.** Un endpoint solo, nessuna firma,
nessun CORS. Ma il limite di 10 MB di API Gateway diventa ~7 MB di foto reale, le
foto in HEIC da iPhone recenti lo sfiorano, e si paga tempo di Lambda per fare da
tubo. Con venti foto in blocco non regge affatto.

**Un bucket pubblico in lettura con URL indovinabili.** Semplifica ogni cosa e
rende la cache banale. Escluso senza discussione: sono i vestiti di qualcuno dentro
casa sua, e un URL pubblico è un URL che finisce indicizzato.

**CloudFront con URL firmati davanti al bucket.** Sarebbe meglio per la lettura —
latenza più bassa, meno chiamate a S3 — e prima o poi si farà. Non adesso: aggiunge
una distribuzione, una coppia di chiavi da ruotare e un livello di cache da
invalidare, per un guadagno che con dodici capi non si misura.

**Upload attraverso la nostra API con streaming multipart.** Ci permetterebbe di
validare e ridimensionare al volo. Ma reintroduce il limite di payload, allunga la
durata delle Lambda, e la validazione vera la fa comunque il modello di visione un
istante dopo.
