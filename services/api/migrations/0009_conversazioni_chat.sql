-- Le conversazioni della chat: da «una chat continua per utente»
-- (0002_chat.sql) a più conversazioni, ognuna col suo elenco di turni.
-- Il perché sta in docs/adr/0006-lo-storico-della-chat.md.
--
-- Come tutte le migrazioni di questo progetto, il file gira a ogni avvio
-- (scripts/applica_migrazioni.py non tiene una tabella di versione): ogni
-- istruzione è ripetibile, e il backfill sotto è un no-op dal secondo giro
-- in poi, perché dopo il primo nessuna riga di messaggi_chat ha più
-- conversazione_id nullo.

create table if not exists conversazioni_chat (
    id               text primary key,
    utente_id        text        not null,
    titolo           text        not null,
    creata_il        timestamptz not null,
    ultimo_turno_il  timestamptz not null
);

create index if not exists conversazioni_chat_utente_idx
    on conversazioni_chat (utente_id, ultimo_turno_il desc);

-- Nullable di proposito: è ciò che rende il backfill sotto ripetibile senza
-- errori. Il codice applicativo la scrive sempre.
alter table messaggi_chat add column if not exists conversazione_id text;

create index if not exists messaggi_chat_conversazione_idx
    on messaggi_chat (conversazione_id, creato_il asc);

-- Backfill: i turni scritti prima di questa migrazione finiscono in
-- un'unica conversazione per utente, così lo storico esistente non sparisce
-- dall'elenco appena introdotto.
insert into conversazioni_chat (id, utente_id, titolo, creata_il, ultimo_turno_il)
select 'storica-' || utente_id, utente_id, 'La tua chat', min(creato_il), max(creato_il)
  from messaggi_chat
 where conversazione_id is null
 group by utente_id
on conflict (id) do nothing;

update messaggi_chat set conversazione_id = 'storica-' || utente_id
 where conversazione_id is null;
