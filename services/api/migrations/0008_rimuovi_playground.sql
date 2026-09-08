-- Rimuove le tabelle nate per il playground e il banco di valutazione,
-- tolti dal codice (handlers/playground.py e domain/valutazione.py non
-- esistono più): su un database nuovo non c'è niente da cancellare, perché
-- nessun file di questa cartella le ricrea più. Su un database esistente
-- (il VPS) elimina le tabelle vere insieme ai loro dati: nessuna app le
-- legge più.
drop table if exists playground_esecuzioni;
drop table if exists preset_prompt;
drop table if exists valutazioni;
drop table if exists valutazioni_immagini;
