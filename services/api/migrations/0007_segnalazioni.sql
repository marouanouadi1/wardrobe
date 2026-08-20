-- La copia che l'app tiene delle segnalazioni già inviate a Sentry (vedi
-- domain/segnalazioni.py): non sostituisce Sentry, gli affianca uno stato che
-- chi ha segnalato può vedere. `utente_id` è colonna vera perché ogni lettura
-- filtra per utente; lo stato resta dentro `dati` (jsonb), come per gli altri
-- modelli — una PATCH aggiorna l'intero blob, non una colonna a sé.
create table if not exists segnalazioni (
    id        text        primary key,
    utente_id text        not null,
    creata_il timestamptz not null,
    dati      jsonb       not null
);

create index if not exists segnalazioni_utente_idx on segnalazioni (utente_id, creata_il desc);
