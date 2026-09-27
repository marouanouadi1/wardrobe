-- Le regole che proteggono i dati, provate contro il database vero.
--
-- Tre persone: A e B sono utenti qualunque, C è l'amministratore (in
-- `app_metadata`). Ogni blocco dice chi è con `request.jwt.claims` e il ruolo
-- `authenticated`, come fa PostgREST per una richiesta dell'app. Tutto gira in
-- una transazione che alla fine si annulla. I conteggi guardano solo le righe
-- di queste tre persone: il database locale può avere già dati di sviluppo.
begin;
select plan(100);

-- ── il catalogo: quello che deve valere per ogni oggetto, anche futuro ───────
select is(
  (select count(*)::integer
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0,
  'ogni tabella di public ha la RLS attiva'
);
select is(
  (select count(*)::integer
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('m', 'f')),
  0,
  'in public non ci sono viste materializzate né tabelle esterne, che l''RLS non copre'
);
select is(
  (select count(*)::integer
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE'))),
  0,
  'anon non ha nessun permesso su nessuna relazione di public'
);
select is(
  (select count(*)::integer
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('authenticated', c.oid, 'TRUNCATE')
        or has_table_privilege('authenticated', c.oid, 'TRIGGER')
        or has_table_privilege('authenticated', c.oid, 'REFERENCES'))),
  0,
  'authenticated non ha TRUNCATE, TRIGGER né REFERENCES: TRUNCATE ignorerebbe l''RLS'
);
select is(
  (select count(*)::integer
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef),
  0,
  'nessuna funzione security definer in public'
);
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  '{}'::text[],
  'nessuna funzione di public eseguibile da anon'
);
select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  array['segna_indossato', 'svuota_armadio'],
  'authenticated esegue solo le due funzioni dichiarate'
);
select ok(
  not has_schema_privilege('authenticated', 'privato', 'USAGE'),
  'authenticated non entra nello schema privato'
);
select ok(
  not has_function_privilege('authenticated', 'privato.crea_profilo()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'privato.accetta_solo_invitati(jsonb)', 'EXECUTE'),
  'né esegue le funzioni del profilo e degli inviti'
);
-- I sette attributi del trigger della correzione sono scritti a mano: questa
-- riga diventa rossa quando l'enum cresce, finché qualcuno non aggiorna il
-- trigger (privato.capi_prima_di_aggiornare) e il numero qui.
select is(
  (select array_length(enum_range(null::public.attributo_capo), 1)),
  7,
  'il trigger della correzione conosce tutti gli attributi'
);

-- Storage vieta la `delete` diretta sulle sue tabelle (un suo trigger): qui la
-- si permette, così a decidere chi cancella cosa resta soltanto l'RLS.
set local storage.allow_delete_query = 'true';

-- ── le persone ─────────────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@esempio.it', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'b@esempio.it', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'c@esempio.it', 'authenticated', 'authenticated');

select is(
  (select count(*)::integer from public.profili
    where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b',
                 '00000000-0000-4000-8000-00000000000c')),
  3,
  'ogni account nasce con il suo profilo'
);

-- ── A: i propri capi ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

-- Due capi letti dall'analisi, uno senza.
insert into public.capi (id, nome, tipo, colore_nome, colore_hex, foto_percorso, confidenze,
                         analisi_provider, analisi_modello, analisi_eseguita_il)
values
  ('10000000-0000-4000-8000-00000000000a', 'Camicia in lino', 'top', 'Panna', '#E7DFD2',
   '00000000-0000-4000-8000-00000000000a/capi/camicia.jpg', '{"tipo": 96, "materiale": 70}',
   'anthropic', 'claude', '2026-09-20'),
  ('20000000-0000-4000-8000-00000000000a', 'Jeans dritti', 'pantaloni', 'Blu', '#46536B',
   '00000000-0000-4000-8000-00000000000a/capi/jeans.jpg', '{"tipo": 90}',
   'anthropic', 'claude', '2026-09-20'),
  ('30000000-0000-4000-8000-00000000000a', 'Sneaker', 'scarpe', 'Bianco', '#EEEEEE',
   '00000000-0000-4000-8000-00000000000a/capi/sneaker.jpg', '{}', null, null, null);

select is(
  (select count(*)::integer from public.capi where utente_id = '00000000-0000-4000-8000-00000000000a'),
  3,
  'A vede i suoi capi'
);
select is(
  (select utente_id from public.capi where nome = 'Jeans dritti'),
  '00000000-0000-4000-8000-00000000000a'::uuid,
  'il capo prende come proprietario chi lo crea'
);
select is((select slot::text from public.capi where nome = 'Jeans dritti'), 'bottom', 'lo slot si deduce dal tipo');

select throws_ok(
  $$ insert into public.capi (nome, tipo, colore_nome, colore_hex, foto_percorso)
     values ('Foto di un altro', 'top', 'Nero', '#000000', '00000000-0000-4000-8000-00000000000b/capi/x.jpg') $$,
  '23514', null,
  'un capo non può indicare una foto nella cartella di un altro'
);
select throws_ok(
  $$ insert into public.capi (nome, tipo, colore_nome, colore_hex, foto_percorso)
     values ('Risalita', 'top', 'Nero', '#000000', '00000000-0000-4000-8000-00000000000a/../00000000-0000-4000-8000-00000000000b/capi/x.jpg') $$,
  '23514', null,
  'né arrivarci risalendo con ..'
);
select throws_ok(
  $$ insert into public.capi (nome, tipo, colore_nome, colore_hex, foto_percorso)
     values ('Doppia barra', 'top', 'Nero', '#000000', '00000000-0000-4000-8000-00000000000a//x.jpg') $$,
  '23514', null,
  'né con una doppia barra'
);
select throws_ok(
  $$ insert into public.capi (nome, tipo, colore_nome, colore_hex, foto_percorso)
     values ('Colore storto', 'top', 'Nero', 'nero', '00000000-0000-4000-8000-00000000000a/capi/x.jpg') $$,
  '23514', null,
  'un colore che non è un esadecimale viene rifiutato'
);
select throws_ok(
  $$ insert into public.capi (nome, tipo, colore_nome, colore_hex, foto_percorso, confidenze)
     values ('Confidenza a 140', 'top', 'Nero', '#000000', '00000000-0000-4000-8000-00000000000a/capi/x.jpg', '{"tipo": 140}') $$,
  '23514', null,
  'una confidenza fuori da 0-100 viene rifiutata'
);
select throws_ok(
  $$ insert into public.capi (nome, tipo, colore_nome, colore_hex, foto_percorso, confidenze)
     values ('Attributo inventato', 'top', 'Nero', '#000000', '00000000-0000-4000-8000-00000000000a/capi/x.jpg', '{"prezzo": 50}') $$,
  '23514', null,
  'una confidenza su un attributo che non esiste viene rifiutata'
);

-- La correzione di un attributo: cambiarlo.
update public.capi set materiale = 'Lino 100%' where nome = 'Camicia in lino';
select is(
  (select (confidenze ->> 'materiale')::integer from public.capi where nome = 'Camicia in lino'),
  100,
  'cambiare un attributo ne porta la confidenza a 100'
);
select ok(
  (select 'materiale' = any (corretti_a_mano::text[]) from public.capi where nome = 'Camicia in lino'),
  'e lo segna fra i corretti a mano'
);
select is(
  (select (confidenze ->> 'tipo')::integer from public.capi where nome = 'Camicia in lino'),
  96,
  'le altre confidenze restano come le ha lette l''analisi'
);
-- …o confermarlo senza cambiarlo: il tocco sulla pillola già accesa.
update public.capi set corretti_a_mano = corretti_a_mano || 'tipo'::public.attributo_capo where nome = 'Jeans dritti';
select is(
  (select (confidenze ->> 'tipo')::integer from public.capi where nome = 'Jeans dritti'),
  100,
  'confermare un valore giusto ne porta la confidenza a 100'
);
update public.capi set corretti_a_mano = '{}' where nome = 'Jeans dritti';
select ok(
  (select 'tipo' = any (corretti_a_mano::text[]) from public.capi where nome = 'Jeans dritti'),
  'e una conferma non si toglie'
);
-- Un capo che nessun modello ha letto non ha confidenze da correggere.
update public.capi set materiale = 'Tela' where nome = 'Sneaker';
select is(
  (select array[confidenze::text, array_length(corretti_a_mano, 1)::text] from public.capi where nome = 'Sneaker'),
  array['{}', null],
  'su un capo senza analisi una correzione non inventa confidenze'
);
-- Le confidenze e la provenienza non si riscrivono con un UPDATE.
update public.capi set confidenze = '{"tipo": 1}', analisi_provider = 'inventato' where nome = 'Camicia in lino';
select is(
  (select (confidenze ->> 'tipo')::integer from public.capi where nome = 'Camicia in lino'),
  96,
  'un client non riscrive le confidenze'
);
select is(
  (select analisi_provider from public.capi where nome = 'Camicia in lino'),
  'anthropic',
  'né la provenienza dell''analisi'
);

update public.capi set tipo = 'abito' where nome = 'Jeans dritti';
select is((select slot::text from public.capi where nome = 'Jeans dritti'), 'dress', 'cambiare il tipo sposta lo slot');
update public.capi set tipo = 'pantaloni' where nome = 'Jeans dritti';

-- «L'ho messo oggi»
select is(
  (select volte_indossato from public.segna_indossato('20000000-0000-4000-8000-00000000000a', '2026-09-25')),
  1,
  'segnare un capo come indossato ne alza il conteggio'
);
select is((select stato::text from public.capi where nome = 'Jeans dritti'), 'da_lavare', 'e lo manda da lavare');
select is(
  (select count(*)::integer from public.usi where giorno = '2026-09-25'),
  1,
  'e registra l''uso, nella stessa transazione'
);

-- Outfit
select throws_ok(
  $$ insert into public.outfit (nome, capo_top) values ('Solo sopra', '10000000-0000-4000-8000-00000000000a') $$,
  '23514', null,
  'un outfit senza sotto e senza abito non è indossabile'
);
insert into public.outfit (id, nome, capo_top, capo_bottom, capo_shoes)
values ('50000000-0000-4000-8000-00000000000a', 'Lino e jeans',
        '10000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a',
        '30000000-0000-4000-8000-00000000000a');
select is((select count(*)::integer from public.outfit), 1, 'un outfit con sopra e sotto si salva');

-- Esiti dell'analisi
insert into public.analisi_esiti (id, stato, capo_id)
values ('60000000-0000-4000-8000-00000000000a', 'completata', '10000000-0000-4000-8000-00000000000a');
update public.analisi_esiti set errore = 'nessuno' where id = '60000000-0000-4000-8000-00000000000a';
select is((select count(*)::integer from public.analisi_esiti), 1, 'A crea e legge i suoi esiti');

-- Chat
insert into public.conversazioni_chat (id, titolo, ultimo_turno_il)
values ('30000000-0000-4000-8000-00000000000a', 'Cosa metto', '2026-09-20');
insert into public.messaggi_chat (conversazione_id, ruolo, testo, creato_il)
values ('30000000-0000-4000-8000-00000000000a', 'utente', 'Cosa metto stasera?', '2026-09-25 18:00+00');
select is(
  (select ultimo_turno_il from public.conversazioni_chat where id = '30000000-0000-4000-8000-00000000000a'),
  '2026-09-25 18:00+00'::timestamptz,
  'un messaggio nuovo sposta in cima la sua conversazione'
);
select is(
  (select array[turni::text, anteprima] from public.conversazioni_elenco),
  array['1', 'Cosa metto stasera?'],
  'l''elenco dello storico conta i turni e mostra l''ultimo testo'
);
update public.conversazioni_chat set titolo = 'Stasera' where id = '30000000-0000-4000-8000-00000000000a';
select is((select titolo from public.conversazioni_chat), 'Stasera', 'A rinomina la sua conversazione');

-- Segnalazioni
select throws_ok(
  $$ insert into public.segnalazioni (testo, stato) values ('già risolta?', 'risolta') $$,
  '42501', null,
  'una segnalazione nasce solo «ricevuta»'
);
insert into public.segnalazioni (id, testo) values ('40000000-0000-4000-8000-00000000000a', 'si chiude caricando una foto');
update public.segnalazioni set stato = 'risolta' where id = '40000000-0000-4000-8000-00000000000a';
select is(
  (select stato::text from public.segnalazioni where id = '40000000-0000-4000-8000-00000000000a'),
  'ricevuta',
  'chi segnala non può cambiarne lo stato'
);
select throws_ok($$ update public.segnalazioni set testo = 'riscritta' $$, '42501', null,
  'e di una segnalazione non si riscrive il testo');
select throws_ok($$ delete from public.segnalazioni $$, '42501', null, 'né la si cancella');

-- Profilo
select throws_ok(
  $$ update public.profili set avatar_foto_percorso = '00000000-0000-4000-8000-00000000000b/avatar.jpg' $$,
  '23514', null,
  'l''avatar non può essere una foto nella cartella di un altro'
);
select throws_ok(
  $$ update public.profili set avatar_foto_percorso = '00000000-0000-4000-8000-00000000000a/../00000000-0000-4000-8000-00000000000b/avatar.jpg' $$,
  '23514', null,
  'nemmeno risalendo con ..'
);
select throws_ok($$ update public.profili set altezza_cm = 1680 $$, '23514', null,
  'un''altezza fuori dai limiti viene rifiutata');
update public.profili set nome = 'Anna';
select is((select nome from public.profili), 'Anna', 'A modifica il suo profilo');

-- Storage
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('foto', '00000000-0000-4000-8000-00000000000a/capi/nuova.jpg') $$,
  'A carica una foto nella sua cartella'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('esportazioni', '00000000-0000-4000-8000-00000000000a/dati.zip') $$,
  'e un''esportazione'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('foto', '00000000-0000-4000-8000-00000000000b/capi/intrusa.jpg') $$,
  '42501', null,
  'ma non nella cartella di B'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('foto', '00000000-0000-4000-8000-00000000000a/../00000000-0000-4000-8000-00000000000b/x.jpg') $$,
  '42501', null,
  'né risalendo con ..'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('altro', '00000000-0000-4000-8000-00000000000a/x.jpg') $$,
  '42501', null,
  'né in un bucket che non è dei nostri'
);

-- ── B: niente di quello che è di A ─────────────────────────────────────────
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}';

select is((select count(*)::integer from public.capi), 0, 'B non vede i capi di A');
select is((select count(*)::integer from public.outfit), 0, 'né i suoi outfit');
select is((select count(*)::integer from public.usi), 0, 'né i suoi usi');
select is((select count(*)::integer from public.analisi_esiti), 0, 'né i suoi esiti');
select is((select count(*)::integer from public.conversazioni_elenco), 0, 'né le sue conversazioni');
select is((select count(*)::integer from public.messaggi_chat), 0, 'né i suoi messaggi');
select is((select count(*)::integer from public.segnalazioni), 0, 'né le sue segnalazioni');
select is((select count(*)::integer from public.profili), 1, 'B vede solo il proprio profilo');
select is((select count(*)::integer from storage.objects), 0, 'né i suoi file');

-- Modifiche e cancellazioni sulle righe di A: nessuna riga toccata. L'esito
-- lo guarda il blocco di A più sotto.
update public.capi set nome = 'rubata';
update public.outfit set nome = 'rubato';
update public.analisi_esiti set errore = 'rubato';
update public.conversazioni_chat set titolo = 'rubata';
update public.profili set nome = 'Rubata' where id = '00000000-0000-4000-8000-00000000000a';
update storage.objects set name = '00000000-0000-4000-8000-00000000000b/presa.jpg';
delete from public.capi;
delete from public.outfit;
delete from public.usi;
delete from public.analisi_esiti;
delete from public.conversazioni_chat;
delete from public.messaggi_chat;
delete from storage.objects;

select throws_ok(
  $$ select public.segna_indossato('20000000-0000-4000-8000-00000000000a', '2026-09-25') $$,
  'PT404', 'capo_non_trovato',
  'B non segna come indossato un capo di A: per B non esiste'
);
select throws_ok(
  $$ insert into public.capi (utente_id, nome, tipo, colore_nome, colore_hex, foto_percorso)
     values ('00000000-0000-4000-8000-00000000000a', 'Regalo', 'top', 'Nero', '#000000',
             '00000000-0000-4000-8000-00000000000a/capi/regalo.jpg') $$,
  '42501', null,
  'B non crea un capo a nome di A'
);
select throws_ok(
  $$ insert into public.capi (id, nome, tipo, colore_nome, colore_hex, foto_percorso)
     values ('10000000-0000-4000-8000-00000000000a', 'Sovrascritta', 'top', 'Nero', '#000000',
             '00000000-0000-4000-8000-00000000000b/capi/x.jpg')
     on conflict (id) do update set nome = excluded.nome $$,
  '42501', null,
  'né sovrascrive un capo di A conoscendone l''id'
);
select throws_ok(
  $$ insert into public.profili (id) values ('00000000-0000-4000-8000-00000000000a')
     on conflict (id) do update set nome = 'Rubato' $$,
  '42501', null,
  'né il profilo di A'
);

insert into public.capi (id, nome, tipo, colore_nome, colore_hex, foto_percorso)
values ('10000000-0000-4000-8000-00000000000b', 'Maglione', 'top', 'Grigio', '#888888',
        '00000000-0000-4000-8000-00000000000b/capi/maglione.jpg');
insert into public.conversazioni_chat (id, titolo) values ('30000000-0000-4000-8000-00000000000b', 'Mia');
-- Due difese indipendenti, e il test guarda l'effetto, non una delle due: il
-- `with check` della policy di modifica, e quella di lettura, perché un UPDATE
-- con un `where` deve poter rileggere la riga nuova, che è di A. Aprire solo
-- la prima (visto il 2026-09-25) non basta a far passare il capo.
select throws_ok(
  $$ update public.capi set utente_id = '00000000-0000-4000-8000-00000000000a' where id = '10000000-0000-4000-8000-00000000000b' $$,
  '42501', null,
  'B non passa un proprio capo ad A'
);
select throws_ok(
  $$ insert into public.outfit (nome, capo_top, capo_bottom)
     values ('Col capo di A', '10000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000a') $$,
  '23503', null,
  'un outfit non può indossare il capo di un altro'
);
select throws_ok(
  $$ insert into public.usi (capo_id, giorno) values ('20000000-0000-4000-8000-00000000000a', '2026-09-25') $$,
  '23503', null,
  'né si registra l''uso del capo di un altro'
);
select throws_ok(
  $$ insert into public.analisi_esiti (stato, capo_id) values ('completata', '10000000-0000-4000-8000-00000000000a') $$,
  '23503', null,
  'né un esito sul capo di un altro'
);
select throws_ok(
  $$ insert into public.messaggi_chat (conversazione_id, ruolo, testo) values ('30000000-0000-4000-8000-00000000000a', 'utente', 'intruso') $$,
  '23503', null,
  'né un messaggio nella conversazione di un altro'
);
insert into public.messaggi_chat (conversazione_id, ruolo, testo) values ('30000000-0000-4000-8000-00000000000b', 'utente', 'ciao');
select is((select count(*)::integer from public.messaggi_chat), 1, 'B scrive nella sua conversazione');

-- Svuotamento
select throws_ok($$ select public.svuota_armadio('svuota') $$, '22023', 'conferma_mancante',
  'svuotare chiede la parola intera');
select is((select (public.svuota_armadio('SVUOTA') ->> 'capi')::integer), 1, 'B svuota il proprio armadio');
select is((select count(*)::integer from public.conversazioni_chat), 0, 'conversazioni e messaggi compresi');

-- ── C, l'amministratore ────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated", "app_metadata": {"ruolo": "amministratore"}}';

select is(
  (select count(*)::integer from public.segnalazioni where utente_id = '00000000-0000-4000-8000-00000000000a'),
  1,
  'l''amministratore vede le segnalazioni degli altri'
);
update public.segnalazioni set stato = 'in_lavorazione' where id = '40000000-0000-4000-8000-00000000000a';
select is(
  (select stato::text from public.segnalazioni where id = '40000000-0000-4000-8000-00000000000a'),
  'in_lavorazione',
  'e ne cambia lo stato'
);
select throws_ok($$ update public.segnalazioni set testo = 'riscritta' $$, '42501', null,
  'ma non ne riscrive il testo');
select is((select count(*)::integer from public.capi), 0, 'e non vede l''armadio di nessuno');

-- Lo stesso ruolo, scritto dove l'utente può scriverlo da sé, non conta.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated", "user_metadata": {"ruolo": "amministratore"}, "ruolo": "amministratore"}';
select is((select count(*)::integer from public.segnalazioni), 0,
  'un amministratore autoproclamato non vede le segnalazioni degli altri');
update public.segnalazioni set stato = 'risolta';
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated", "app_metadata": {"ruolo": "amministratore"}}';
select is(
  (select stato::text from public.segnalazioni where id = '40000000-0000-4000-8000-00000000000a'),
  'in_lavorazione',
  'e non ne cambia lo stato'
);

-- ── A, dopo quello che hanno provato B e C ─────────────────────────────────
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select is((select count(*)::integer from public.capi), 3, 'i capi di A ci sono tutti');
select is((select nome from public.capi where id = '10000000-0000-4000-8000-00000000000a'), 'Camicia in lino',
  'e nessuno li ha modificati');
select is((select count(*)::integer from public.outfit), 1, 'e nemmeno l''outfit');
select is((select count(*)::integer from public.usi), 1, 'né l''uso');
select is((select count(*)::integer from public.analisi_esiti), 1, 'né l''esito');
select is((select count(*)::integer from public.conversazioni_elenco), 1, 'né la conversazione');
select is((select nome from public.profili), 'Anna', 'né il profilo');
select is((select count(*)::integer from storage.objects), 2, 'né i file');

-- Le cancellazioni di A, e quello che si portano dietro.
delete from public.capi where nome = 'Sneaker';
select is(
  (select capo_shoes from public.outfit where id = '50000000-0000-4000-8000-00000000000a'),
  null,
  'togliere le scarpe lascia l''outfit, senza scarpe'
);
select lives_ok(
  $$ delete from public.capi where nome = 'Camicia in lino' $$,
  'un capo con un''analisi completata si cancella'
);
select is((select count(*)::integer from public.analisi_esiti), 0, 'e il suo esito se ne va con lui');
select is((select count(*)::integer from public.outfit), 0, 'e l''outfit che reggeva anche');
delete from public.conversazioni_chat;
select is((select count(*)::integer from public.messaggi_chat), 0, 'cancellare una conversazione ne cancella i messaggi');
delete from public.usi;
select is((select count(*)::integer from public.usi), 0, 'A cancella i suoi usi');
delete from storage.objects where name like '%/dati.zip';
select is((select count(*)::integer from storage.objects), 1, 'e i suoi file');

-- ── anon: niente ───────────────────────────────────────────────────────────
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.capi $$, '42501', null, 'senza accesso non si legge nessuna tabella');
select throws_ok($$ select public.svuota_armadio('SVUOTA') $$, '42501', null, 'né si chiama una funzione');

-- ── gli inviti ─────────────────────────────────────────────────────────────
-- Qui c'è la logica dell'hook, chiamato da `postgres`. **I permessi veri no**:
-- Auth lo chiama come `supabase_auth_admin`, che l'RLS non la scavalca, e da
-- qui non si può assumere quel ruolo. Il 2026-09-25 questi test passavano
-- mentre ogni registrazione vera veniva rifiutata. Da allora: le due righe
-- sotto controllano che quel ruolo possa leggere gli inviti, e il job
-- `database` della CI fa due registrazioni vere, un invitato e un estraneo.
reset role;
select ok(
  has_table_privilege('supabase_auth_admin', 'privato.inviti', 'select'),
  'Auth può leggere gli inviti'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'privato' and tablename = 'inviti' and cmd = 'SELECT'
             and 'supabase_auth_admin' = any (roles)),
  'e ha una policy che glieli mostra'
);
select is(
  privato.accetta_solo_invitati('{"user": {"email": "estraneo.test@esempio.invalid"}}') -> 'error' ->> 'http_code',
  '403',
  'un''email fuori dagli inviti non crea un account'
);
insert into privato.inviti (email) values ('invitato.test@esempio.invalid');
select is(
  privato.accetta_solo_invitati('{"user": {"email": "  Invitato.Test@Esempio.invalid "}}'),
  '{}'::jsonb,
  'un''email invitata sì, scritta come capita'
);

select * from finish();
rollback;
