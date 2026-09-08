-- Schema di Wardrobe.
--
-- Ibrido di proposito: colonne vere e indicizzate per ciò su cui filtriamo o
-- ordiniamo, `jsonb` per il resto del modello di dominio. Aggiungere un
-- attributo letto dalla foto non richiede una migrazione; «i capi fermi da sei
-- mesi» resta comunque una query.

create table if not exists profili (
    id          text primary key,
    creato_il   timestamptz not null default now(),
    dati        jsonb       not null
);

create table if not exists capi (
    id          text primary key,
    utente_id   text        not null,
    tipo        text        not null,
    stato       text        not null default 'pulito',
    ultimo_uso  date,
    creato_il   timestamptz not null default now(),
    dati        jsonb       not null
);

create index if not exists capi_utente_idx      on capi (utente_id, creato_il desc);
create index if not exists capi_utente_tipo_idx on capi (utente_id, tipo);
-- I dormienti: `nulls first` perché un capo mai indossato è il più dormiente
-- di tutti, e senza questa clausola resterebbe in fondo all'elenco.
create index if not exists capi_dormienti_idx   on capi (utente_id, ultimo_uso asc nulls first);

create table if not exists outfit (
    id          text primary key,
    utente_id   text        not null,
    creato_il   timestamptz not null default now(),
    dati        jsonb       not null
);

create index if not exists outfit_utente_idx on outfit (utente_id, creato_il desc);

-- Il diario di «cosa ho messo»: una riga per capo per giorno. La chiave
-- composta rende l'inserimento idempotente, così segnare due volte lo stesso
-- capo nello stesso giorno non gonfia le statistiche.
create table if not exists usi (
    utente_id   text not null,
    capo_id     text not null,
    giorno      date not null,
    primary key (utente_id, capo_id, giorno)
);

create index if not exists usi_giorno_idx on usi (utente_id, giorno desc);
