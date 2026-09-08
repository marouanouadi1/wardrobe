-- La chat continua dello stilista.
--
-- Una riga per turno, non una tabella "conversazioni": non esistono chat
-- multiple in Wardrobe, solo quella dell'utente che continua.

create table if not exists messaggi_chat (
    id          text primary key,
    utente_id   text        not null,
    creato_il   timestamptz not null,
    dati        jsonb       not null
);

create index if not exists messaggi_chat_utente_idx on messaggi_chat (utente_id, creato_il asc);
