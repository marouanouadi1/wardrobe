-- Il banco immagini: una riga per (run, servizio, modello, campione).
--
-- Stessa forma di `valutazioni` (0003): chiave naturale come primary key,
-- nessun id surrogato da tenere sincrono con `dati`. La differenza è che qui
-- la riga nasce senza un giudizio (la genera `scripts/genera_immagini.py`) e
-- viene aggiornata più tardi con il rating umano dalla schermata di
-- valutazione — due scritture sulla stessa riga, non due tabelle.
create table if not exists valutazioni_immagini (
    run_id      text        not null,
    servizio    text        not null,
    modello     text        not null,
    campione_id text        not null,
    eseguita_il timestamptz not null default now(),
    dati        jsonb       not null,
    primary key (run_id, servizio, modello, campione_id)
);

create index if not exists valutazioni_immagini_recenti_idx on valutazioni_immagini (eseguita_il desc);
