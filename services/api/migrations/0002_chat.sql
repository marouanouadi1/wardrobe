-- La chat continua dello stilista, e il preset che la guida.
--
-- Una riga per turno, non una tabella "conversazioni": non esistono chat
-- multiple in Wardrobe, solo quella dell'utente che continua. `preset_prompt`
-- tiene la versione del system prompt che il playground ha salvato — quando
-- manca, chi chiama ricade sul default di fabbrica in `domain/playground.py`.

create table if not exists preset_prompt (
    id            text primary key,
    dati          jsonb       not null,
    aggiornato_il timestamptz not null default now()
);

create table if not exists messaggi_chat (
    id          text primary key,
    utente_id   text        not null,
    creato_il   timestamptz not null,
    dati        jsonb       not null
);

create index if not exists messaggi_chat_utente_idx on messaggi_chat (utente_id, creato_il asc);
