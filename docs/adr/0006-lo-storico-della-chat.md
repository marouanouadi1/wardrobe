# 0006 — Lo storico della chat: conversazioni, non una sola continua

**Stato:** accettata · **Data:** 2026-09-08

## Contesto

`0002_chat.sql` partiva da una scelta esplicita: *«una riga per turno, non una
tabella "conversazioni": non esistono chat multiple in Wardrobe, solo quella
dell'utente che continua»*. `GET /chat` restituiva l'intera cronologia di un
utente, senza confini; `POST /chat` vi appendeva sempre due turni in coda.

Nell'uso reale quella riga unica smette di bastare non appena la chat vive
più di un giorno o due: la conversazione di stamattina («cosa metto oggi?»)
e quella di tre settimane fa («vado a un matrimonio») finiscono nello stesso
filo, senza un modo di separarle, ritrovarle o chiuderle. Non c'era neanche
un modo di *vedere* che la cronologia esisteva — mancavano l'eco immediato
del messaggio appena scritto e l'auto-scroll in fondo (corretti nello stesso
lavoro che ha portato a questa decisione, ma indipendenti da essa: risolvono
la percezione, non la struttura).

## Decisione

### Un contenitore `conversazione`, creato dal primo messaggio

`conversazioni_chat` (`0009_conversazioni_chat.sql`) affianca `messaggi_chat`,
che guadagna una `conversazione_id`. Non esiste una rotta «crea
conversazione»: `POST /chat` senza `conversazione_id` nel corpo ne apre una
nuova, con un titolo dedotto dal primo messaggio
(`domain.chat.titolo_da_primo_messaggio`, non chiesto al modello — un
titolo non merita una chiamata al provider tutta sua). Con `conversazione_id`
presente, il turno si aggiunge a quella.

### La conversazione nasce solo dopo una risposta valida

`handlers/chat.py` già validava la risposta del modello prima di salvare
qualunque turno, per non lasciare una domanda dell'utente senza risposta
nella cronologia. La stessa regola vale per la riga della conversazione: se
il provider non è configurato o risponde fuori formato, non deve restare
nell'elenco una conversazione vuota che l'utente scoprirebbe di dover
cancellare a mano. La creazione (o l'aggiornamento di `ultimo_turno_il`)
avviene nello stesso blocco dei due `salva_messaggio_chat`, non prima.

### `GET /chat` resta il punto d'ingresso, ma ora è «l'ultima»

Per non rompere il comportamento che l'app già aveva — aprire la chat e
trovarsi dove l'avevi lasciata — `GET /chat` risponde con l'ultima
conversazione e i suoi messaggi, non con l'elenco. L'elenco vero è
`GET /chat/conversazioni`; una conversazione specifica si legge da
`GET /chat/conversazioni/{id}` e si elimina con `DELETE` sulla stessa rotta.

### La migrazione backfilla, non azzera

`scripts/applica_migrazioni.py` esegue ogni file a ogni avvio, senza una
tabella di versione: `0009_conversazioni_chat.sql` usa solo `create ... if
not exists` / `add column if not exists`, e il backfill (una conversazione
per utente, dai turni già scritti prima di questa migrazione) è un no-op dal
secondo giro in poi, perché nessuna riga resta con `conversazione_id` nullo.
Lo storico di chi usava già l'app non sparisce dall'elenco appena introdotto.

## Conseguenze

- I contratti TypeScript guadagnano `ConversazioneChat`, `ElencoConversazioniChat`
  e `VoceElencoConversazioni` (quest'ultima porta anche `turni` e `anteprima`,
  che l'elenco calcola da un aggregato su `messaggi_chat` — non colonne
  proprie di `conversazioni_chat`, per questo vive in un modello separato da
  `ConversazioneChat`).
- L'app guadagna una schermata (`app/chat.tsx`) e due affordance nel
  suggeritore — «Storico» e «Nuova» — dove prima la chat non aveva altro
  stato che «continua».
- Chi chiede qualcosa da «Oggi» (la scorciatoia `chiedi` su `/suggeritore`)
  continua l'ultima conversazione, come faceva prima: aprire una chat nuova a
  ogni tocco di una scorciatoia sarebbe stato un peggioramento, non
  l'obiettivo di questa decisione.

## Alternative scartate

**Solo separatori di data, nessuno schema nuovo.** Bastava a rendere leggibile
una cronologia lunga, ma non a una richiesta esplicita di poter *ritrovare* e
*chiudere* una conversazione passata — un separatore visivo non è un
contenitore che si possa elencare o eliminare.

**Una conversazione al giorno, automatica.** Eviterebbe il concetto di
«Nuova» esplicito, ma deciderebbe per l'utente cosa conta come una
conversazione — chi scrive a mezzanotte e mezzo dopo, sulla stessa
domanda, si troverebbe la chat spezzata in due senza averlo chiesto.
