-- Le credenziali di login, separate dall'armadio: un utente è la sua identità,
-- non cosa possiede. Le righe le crea POST /auth/registrati (handlers/auth.py),
-- dietro l'allowlist EMAIL_AMMESSE — non più a mano da riga di comando.
create table if not exists utenti (
    id            uuid        primary key default gen_random_uuid(),
    email         text        not null unique,
    hash_password text        not null,
    creato_il     timestamptz not null default now()
);
