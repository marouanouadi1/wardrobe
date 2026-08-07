-- Il banco di valutazione: una riga per (run, provider, modello, campione).
--
-- Nessun id surrogato: la quadrupla sotto è già una chiave naturale, ed è
-- anche l'identità con cui rilanciare lo stesso modello sullo stesso
-- campione dentro lo stesso run deve aggiornare la riga, non fallire su un
-- vincolo o duplicarla. Un id separato come PK andrebbe fuori sincrono da
-- `dati` proprio in quel caso: l'`on conflict` aggiornerebbe `dati` (che
-- porta il suo id nuovo) lasciando la colonna PK con l'id vecchio.
create table if not exists valutazioni (
    run_id      text        not null,
    provider    text        not null,
    modello     text        not null,
    campione_id text        not null,
    eseguita_il timestamptz not null default now(),
    dati        jsonb       not null,
    primary key (run_id, provider, modello, campione_id)
);

create index if not exists valutazioni_recenti_idx on valutazioni (eseguita_il desc);
