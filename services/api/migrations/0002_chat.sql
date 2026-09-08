-- La chat continua dello stilista.
--
-- Una riga per turno. Nata come «una chat continua per utente, non chat
-- multiple»: quella scelta è stata ribaltata da 0009_conversazioni_chat.sql,
-- che aggiunge il contenitore `conversazioni_chat` e una `conversazione_id`
-- qui sotto — vedi docs/adr/0006-lo-storico-della-chat.md per il perché.

create table if not exists messaggi_chat (
    id          text primary key,
    utente_id   text        not null,
    creato_il   timestamptz not null,
    dati        jsonb       not null
);

create index if not exists messaggi_chat_utente_idx on messaggi_chat (utente_id, creato_il asc);
