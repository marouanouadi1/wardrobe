-- Le credenziali di login, separate dall'armadio: un utente è la sua identità,
-- non cosa possiede. Niente self-signup pubblico a questa scala (poche
-- persone fidate) — le righe le crea scripts/crea_utente.py.
create table if not exists utenti (
    id            uuid        primary key default gen_random_uuid(),
    email         text        not null unique,
    hash_password text        not null,
    creato_il     timestamptz not null default now()
);
