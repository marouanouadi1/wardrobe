-- Gli esiti delle analisi eseguite in linea (senza Step Functions).
--
-- Prima vivevano in un dict di processo (`_ESITI_LOCALI` in
-- `handlers/analisi.py`): sopravvivevano solo finché il processo restava
-- vivo. Fuori da Lambda un riavvio del server (deploy, crash) è un evento di
-- routine, non un'eccezione — il capo era già salvato qui sotto in `capi`,
-- ma il polling del client non trovava più l'esecuzione e vedeva un errore
-- permanente. Riga per esecuzione, non per utente: l'`esecuzione_id` è già
-- univoco e non c'è bisogno di sapere di chi è per rispondere al polling.
create table if not exists analisi_esiti (
    esecuzione_id text        primary key,
    dati          jsonb       not null,
    creato_il     timestamptz not null default now()
);
