-- Solo per lo stack locale: `supabase db reset` lo applica dopo le migrazioni,
-- e il progetto vero non lo vede mai.
--
-- Un invito, perché senza nessuno la registrazione è chiusa anche in locale
-- (l'hook `privato.accetta_solo_invitati`). Per provare con la propria email se
-- ne aggiunge un'altra dallo Studio (http://127.0.0.1:54323) o con una insert.
insert into privato.inviti (email) values ('sviluppo@esempio.invalid') on conflict do nothing;
