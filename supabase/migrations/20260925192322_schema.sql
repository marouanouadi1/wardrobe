-- Lo schema di Wardrobe su Supabase (ADR 0010).
--
-- L'app legge e scrive queste tabelle direttamente, e il backend dell'IA lo fa
-- con il token dell'utente: quindi **ogni regola che protegge i dati sta qui**,
-- non in un handler. Tre strumenti, in quest'ordine di preferenza:
--
--   1. vincoli — enum, CHECK, chiavi esterne composte (un riferimento resta
--      dentro lo stesso utente per costruzione);
--   2. trigger — quello che una scrittura deve fare insieme a sé stessa
--      (la correzione di un attributo, le date di aggiornamento);
--   3. funzioni `security invoker` — le operazioni su più righe, atomiche.
--
-- E sopra tutto, RLS su ogni tabella: policy `to authenticated` con la
-- proprietà della riga, e sulle UPDATE sia `using` sia `with check`.
--
-- **Cosa protegge e cosa no.** Queste regole separano un utente dall'altro, e
-- tengono validi i dati. Non proteggono l'utente da sé stesso: chi possiede un
-- capo può inventarne le confidenze all'inserimento, o i propri turni di chat,
-- come potrebbe l'IA che agisce con il suo token. Sono dati suoi, e nessun
-- altro li vede.
--
-- Nessuna funzione `security definer` in `public`, e nessuna funzione di
-- `public` eseguibile da `anon`: lo verificano i test in supabase/tests/.

-- ── i permessi di default, prima di tutto ──────────────────────────────────
-- Supabase dà a `anon` e `authenticated` ogni permesso su ogni tabella nuova
-- di `public` — TRUNCATE compreso, che l'RLS non la guarda — e l'esecuzione di
-- ogni funzione nuova a chiunque. Qui si parte da nessun permesso, e ogni
-- tabella e funzione sotto dichiara i suoi. `service_role` resta com'è: è la
-- chiave che serve una volta sola, per migrare i dati dal VPS (ADR 0010).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- ── schema privato ─────────────────────────────────────────────────────────
-- Non è fra gli schemi esposti (config.toml, [api].schemas): da HTTP non si
-- raggiunge niente di quello che c'è dentro. Le policy e i vincoli che ne
-- chiamano le funzioni le hanno già risolte quando sono stati creati, quindi
-- a `authenticated` non serve nemmeno entrarci.
create schema privato;
revoke all on schema privato from public, anon, authenticated;

-- ── enum ───────────────────────────────────────────────────────────────────
-- I valori e il loro ordine sono quelli degli `StrEnum` di
-- services/api/src/domain/models.py: il gate `verifica_database.py` li
-- confronta a ogni PR, perché due copie senza un confronto divergono.
create type public.tipo_capo as enum ('top', 'pantaloni', 'scarpe', 'capospalla', 'abito', 'accessorio');
create type public.slot_avatar as enum ('top', 'bottom', 'outer', 'shoes', 'dress');
create type public.stagione as enum ('primavera', 'estate', 'autunno', 'inverno', 'mezza_stagione', 'tutto_lanno');
create type public.stato_capo as enum ('pulito', 'da_lavare', 'in_lavaggio');
create type public.attributo_capo as enum ('tipo', 'colore', 'materiale', 'fantasia', 'stagione', 'vestibilita', 'lavaggio');
create type public.origine_outfit as enum ('manuale', 'ia', 'suggerito_modificato');
create type public.ruolo_chat as enum ('utente', 'wardrobe');
create type public.stato_segnalazione as enum ('ricevuta', 'in_lavorazione', 'risolta');
create type public.stato_analisi as enum ('in_corso', 'completata', 'fallita');
create type public.sistema_taglie as enum ('donna', 'uomo', 'unisex');
create type public.taglia as enum ('xs', 's', 'm', 'l', 'xl');
create type public.corporatura as enum ('minuta', 'media', 'robusta');
create type public.unita_lunghezza as enum ('cm', 'pollici');

-- ── funzioni di supporto ───────────────────────────────────────────────────

-- Lo slot dell'avatar si deduce dal tipo: è la colonna generata di `capi`, così
-- cambiare il tipo sposta lo slot senza che nessun client se ne ricordi.
-- Stessa tabella di `_SLOT_PER_TIPO` in services/api/src/domain/wardrobe.py.
-- In `privato`: nessuno la chiama da fuori, la usa solo la colonna.
create function privato.slot_da_tipo(tipo public.tipo_capo)
returns public.slot_avatar
language sql
immutable
set search_path = ''
as $$
  select case tipo
    when 'top' then 'top'
    when 'pantaloni' then 'bottom'
    when 'scarpe' then 'shoes'
    when 'capospalla' then 'outer'
    when 'abito' then 'dress'
    when 'accessorio' then 'top'
  end::public.slot_avatar
$$;
grant execute on function privato.slot_da_tipo(public.tipo_capo) to authenticated;

-- Le confidenze della lettura: un oggetto `attributo → intero 0-100`. Dichiarata
-- `immutable` anche se legge `enum_range`, che è `stable`: l'elenco degli
-- attributi cambia solo con una migrazione, e un CHECK vuole una funzione pura.
create function privato.confidenze_valide(confidenze jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(confidenze) = 'object'
     and not exists (
       select 1
         from jsonb_each(confidenze) as voce
        where not (voce.key = any (enum_range(null::public.attributo_capo)::text[]))
           or jsonb_typeof(voce.value) <> 'number'
           or voce.value::numeric <> trunc(voce.value::numeric)
           or voce.value::numeric not between 0 and 100
     )
$$;
grant execute on function privato.confidenze_valide(jsonb) to authenticated;

-- Un percorso nello Storage che sta davvero nella cartella del suo utente: il
-- primo segmento è l'utente, e nessun segmento `.` o `..` né una doppia barra.
-- Senza l'ultima parte, `<A>/../<B>/x.jpg` passerebbe il controllo sul primo
-- segmento pur indicando la foto di B — innocuo finché Storage legge i nomi
-- alla lettera, un furto il giorno che qualcosa li normalizza.
create function privato.percorso_di(utente uuid, percorso text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select split_part(percorso, '/', 1) = utente::text
     and percorso !~ '(^|/)\.\.?(/|$)'
     and position('//' in percorso) = 0
$$;
grant execute on function privato.percorso_di(uuid, text) to authenticated;

-- L'amministratore sta in `app_metadata`, che solo il server può scrivere —
-- mai in `user_metadata`, che l'utente modifica da sé.
create function privato.e_amministratore()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'ruolo', '') = 'amministratore'
$$;
grant execute on function privato.e_amministratore() to authenticated;

-- ── profili ────────────────────────────────────────────────────────────────
-- `foto_url` del modello Pydantic non c'è: non lo scriveva nessuno, né il
-- backend né l'app. Le schermate che lo leggono lo perdono nella fase 3.
create table public.profili (
  id                  uuid primary key references auth.users (id) on delete cascade,
  nome                text not null default '',
  citta               text,
  stili               text[] not null default '{}',
  palette             text[] not null default '{}',
  evita               text[] not null default '{}',
  sistema_taglie      public.sistema_taglie,
  taglia              public.taglia,
  -- Gli estremi sono `LIMITI_MISURE_CM` di models.py, confrontati dal gate.
  altezza_cm          integer check (altezza_cm between 120 and 230),
  corporatura         public.corporatura,
  spalle_cm           integer check (spalle_cm between 30 and 70),
  lunghezza_gamba_cm  integer check (lunghezza_gamba_cm between 50 and 120),
  unita_lunghezza     public.unita_lunghezza not null default 'cm',
  -- Il percorso nello Storage, dentro la cartella di chi lo possiede: senza, un
  -- profilo potrebbe indicare la foto di un altro, e l'esportazione ne
  -- metterebbe i byte nel proprio zip.
  avatar_foto_percorso text check (privato.percorso_di(id, avatar_foto_percorso)),
  creato_il           timestamptz not null default now()
);

-- Il profilo nasce con l'account: prima lo creava `GET /profilo` al primo
-- accesso. `security definer` perché il trigger gira come l'utente di Auth,
-- che su `public.profili` non ha permessi; sta in `privato`, e fa una cosa sola.
create function privato.crea_profilo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profili (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger crea_profilo_alla_registrazione
  after insert on auth.users
  for each row execute function privato.crea_profilo();

-- ── capi ───────────────────────────────────────────────────────────────────
create table public.capi (
  id                         uuid primary key default gen_random_uuid(),
  utente_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome                       text not null check (length(btrim(nome)) > 0),
  tipo                       public.tipo_capo not null,
  slot                       public.slot_avatar not null generated always as (privato.slot_da_tipo(tipo)) stored,
  colore_nome                text not null,
  colore_hex                 text not null check (colore_hex ~ '^#[0-9A-Fa-f]{6}$'),
  foto_percorso              text not null check (privato.percorso_di(utente_id, foto_percorso)),
  foto_larghezza             integer check (foto_larghezza > 0),
  foto_altezza               integer check (foto_altezza > 0),
  foto_scontornata_percorso  text check (privato.percorso_di(utente_id, foto_scontornata_percorso)),
  brand                      text,
  sottotipo                  text,
  materiale                  text,
  fantasia                   text,
  stagione                   public.stagione,
  vestibilita                text,
  lavaggio                   text,
  stato                      public.stato_capo not null default 'pulito',
  preferito                  boolean not null default false,
  ultimo_uso                 date,
  volte_indossato            integer not null default 0 check (volte_indossato >= 0),
  analisi_provider           text,
  analisi_modello            text,
  analisi_eseguita_il        timestamptz,
  analisi_note               text,
  confidenze                 jsonb not null default '{}' check (privato.confidenze_valide(confidenze)),
  corretti_a_mano            public.attributo_capo[] not null default '{}',
  etichette                  text[] not null default '{}',
  appunti                    text,
  creato_il                  timestamptz not null default now(),
  aggiornato_il              timestamptz not null default now(),
  -- Il bersaglio delle chiavi esterne composte: un outfit, un uso, un esito
  -- d'analisi puntano a `(utente_id, id)`, quindi non possono indicare il
  -- capo di un altro nemmeno conoscendone l'id.
  unique (utente_id, id)
);
create index capi_utente_creato_idx on public.capi (utente_id, creato_il desc);

-- Quello che una modifica a un capo deve fare insieme a sé stessa: è la
-- `correggi_attributo` di domain/wardrobe.py, portata dove vale per ogni client.
--
-- Un attributo è **corretto a mano** quando l'utente ne cambia il valore, o
-- quando lo conferma senza cambiarlo, aggiungendolo a `corretti_a_mano`: è il
-- tocco sulla pillola già accesa, «è giusto così». In entrambi i casi la sua
-- confidenza va a 100 — ma solo se il capo ha un'analisi, come in Python: su
-- un capo che nessun modello ha letto non c'è una confidenza da correggere.
--
-- Il resto della lettura (le altre confidenze, la provenienza) su un UPDATE
-- non cambia, qualunque cosa mandi il client, e da `corretti_a_mano` non si
-- toglie niente. È una difesa contro una sovrascrittura, non contro il
-- proprietario: all'inserimento chi crea il capo scrive quello che vuole.
--
-- I sette attributi sono scritti qui a mano: se `attributo_capo` cresce, un
-- test in supabase/tests/ diventa rosso finché questo trigger non lo conosce.
create function privato.capi_prima_di_aggiornare()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  corretti public.attributo_capo[];
  attributo public.attributo_capo;
begin
  new.creato_il := old.creato_il;
  new.aggiornato_il := now();
  new.analisi_provider := old.analisi_provider;
  new.analisi_modello := old.analisi_modello;
  new.analisi_eseguita_il := old.analisi_eseguita_il;
  new.analisi_note := old.analisi_note;

  -- Confermati: ciò che il client aggiunge a `corretti_a_mano`.
  corretti := array(select unnest(new.corretti_a_mano) except select unnest(old.corretti_a_mano));
  -- Cambiati: ciò di cui cambia il valore.
  if new.tipo is distinct from old.tipo then corretti := corretti || 'tipo'::public.attributo_capo; end if;
  if new.colore_nome is distinct from old.colore_nome or new.colore_hex is distinct from old.colore_hex then
    corretti := corretti || 'colore'::public.attributo_capo;
  end if;
  if new.materiale is distinct from old.materiale then corretti := corretti || 'materiale'::public.attributo_capo; end if;
  if new.fantasia is distinct from old.fantasia then corretti := corretti || 'fantasia'::public.attributo_capo; end if;
  if new.stagione is distinct from old.stagione then corretti := corretti || 'stagione'::public.attributo_capo; end if;
  if new.vestibilita is distinct from old.vestibilita then corretti := corretti || 'vestibilita'::public.attributo_capo; end if;
  if new.lavaggio is distinct from old.lavaggio then corretti := corretti || 'lavaggio'::public.attributo_capo; end if;

  new.confidenze := old.confidenze;
  new.corretti_a_mano := old.corretti_a_mano;
  if old.analisi_eseguita_il is null then
    return new;
  end if;

  foreach attributo in array corretti loop
    new.confidenze := new.confidenze || jsonb_build_object(attributo::text, 100);
    if not (attributo = any (new.corretti_a_mano)) then
      new.corretti_a_mano := new.corretti_a_mano || attributo;
    end if;
  end loop;
  return new;
end;
$$;

create trigger capi_prima_di_aggiornare
  before update on public.capi
  for each row execute function privato.capi_prima_di_aggiornare();

-- ── outfit ─────────────────────────────────────────────────────────────────
create table public.outfit (
  id               uuid primary key default gen_random_uuid(),
  utente_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome             text not null check (length(btrim(nome)) > 0),
  -- Le chiavi sono quelle di `Vestizione`, cioè di `mannequin.setOutfit()`.
  capo_top         uuid,
  capo_bottom      uuid,
  capo_outer       uuid,
  capo_shoes       uuid,
  capo_dress       uuid,
  occasione        text,
  origine          public.origine_outfit not null default 'manuale',
  volte_indossato  integer not null default 0 check (volte_indossato >= 0),
  ultimo_uso       date,
  creato_il        timestamptz not null default now(),
  -- Indossabile: un abito, oppure sopra e sotto (`vestizione_indossabile`).
  constraint outfit_indossabile check (capo_dress is not null or (capo_top is not null and capo_bottom is not null)),
  -- Ogni capo dell'outfit è dello stesso utente. Se sparisce un capo che lo
  -- regge — sopra, sotto, l'abito — sparisce l'outfit: senza, non sarebbe più
  -- indossabile e il vincolo qui sopra rifiuterebbe la cancellazione del capo.
  -- Se sparisce il capospalla o le scarpe, l'outfit resta, senza quel capo.
  foreign key (utente_id, capo_top) references public.capi (utente_id, id) on delete cascade,
  foreign key (utente_id, capo_bottom) references public.capi (utente_id, id) on delete cascade,
  foreign key (utente_id, capo_dress) references public.capi (utente_id, id) on delete cascade,
  foreign key (utente_id, capo_outer) references public.capi (utente_id, id) on delete set null (capo_outer),
  foreign key (utente_id, capo_shoes) references public.capi (utente_id, id) on delete set null (capo_shoes)
);
create index outfit_utente_creato_idx on public.outfit (utente_id, creato_il desc);
create index outfit_capo_top_idx on public.outfit (utente_id, capo_top);
create index outfit_capo_bottom_idx on public.outfit (utente_id, capo_bottom);
create index outfit_capo_outer_idx on public.outfit (utente_id, capo_outer);
create index outfit_capo_shoes_idx on public.outfit (utente_id, capo_shoes);
create index outfit_capo_dress_idx on public.outfit (utente_id, capo_dress);

-- ── usi ────────────────────────────────────────────────────────────────────
create table public.usi (
  utente_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  capo_id    uuid not null,
  giorno     date not null,
  primary key (utente_id, capo_id, giorno),
  foreign key (utente_id, capo_id) references public.capi (utente_id, id) on delete cascade
);
create index usi_utente_giorno_idx on public.usi (utente_id, giorno desc);

-- «L'ho messo oggi» — era `segna_indossato` più `registra_uso`, due scritture
-- senza transazione. Qui sono una: il capo e la riga dell'uso insieme, o
-- nessuno dei due. Il giorno lo manda chi chiama, perché «oggi» è quello di
-- chi si veste, non quello del server in UTC.
create function public.segna_indossato(capo uuid, giorno date)
returns public.capi
language plpgsql
security invoker
set search_path = ''
as $$
declare
  aggiornato public.capi;
begin
  update public.capi
     set ultimo_uso = segna_indossato.giorno,
         volte_indossato = volte_indossato + 1,
         stato = 'da_lavare'
   where id = segna_indossato.capo
  returning * into aggiornato;

  if not found then
    -- `PT404` e non `P0002`: PostgREST traduce ogni `P0…` in un 500, e un 500
    -- non è un canale di comunicazione. Questo è un 404, come `CapoNonTrovato`.
    raise exception using errcode = 'PT404', message = 'capo_non_trovato';
  end if;

  insert into public.usi (utente_id, capo_id, giorno)
  values (aggiornato.utente_id, aggiornato.id, segna_indossato.giorno)
  on conflict do nothing;

  return aggiornato;
end;
$$;
grant execute on function public.segna_indossato(uuid, date) to authenticated;

-- ── chat ───────────────────────────────────────────────────────────────────
create table public.conversazioni_chat (
  id               uuid primary key default gen_random_uuid(),
  utente_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titolo           text not null,
  creata_il        timestamptz not null default now(),
  ultimo_turno_il  timestamptz not null default now(),
  unique (utente_id, id)
);
create index conversazioni_chat_utente_idx on public.conversazioni_chat (utente_id, ultimo_turno_il desc);

create table public.messaggi_chat (
  id                uuid primary key default gen_random_uuid(),
  utente_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversazione_id  uuid not null,
  ruolo             public.ruolo_chat not null,
  testo             text not null,
  -- Gli outfit proposti in quel turno, come `Suggerimento` di models.py:
  -- nessun client li filtra, quindi restano un documento.
  suggerimenti      jsonb not null default '[]' check (jsonb_typeof(suggerimenti) = 'array'),
  creato_il         timestamptz not null default now(),
  -- Cancellare una conversazione cancella i suoi messaggi, nella stessa
  -- istruzione: prima serviva una transazione scritta a mano.
  foreign key (utente_id, conversazione_id) references public.conversazioni_chat (utente_id, id) on delete cascade
);
create index messaggi_chat_conversazione_idx on public.messaggi_chat (utente_id, conversazione_id, creato_il);

-- Un messaggio nuovo sposta in cima la sua conversazione.
create function privato.messaggio_aggiorna_conversazione()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversazioni_chat
     set ultimo_turno_il = greatest(ultimo_turno_il, new.creato_il)
   where id = new.conversazione_id and utente_id = new.utente_id;
  return new;
end;
$$;

create trigger messaggio_aggiorna_conversazione
  after insert on public.messaggi_chat
  for each row execute function privato.messaggio_aggiorna_conversazione();

-- L'elenco dello storico: ogni conversazione con quanti turni ha e l'ultimo
-- testo. `security_invoker`, altrimenti una vista scavalca l'RLS delle tabelle
-- che legge.
create view public.conversazioni_elenco
with (security_invoker = true)
as
select c.id,
       c.utente_id,
       c.titolo,
       c.creata_il,
       c.ultimo_turno_il,
       coalesce(m.turni, 0) as turni,
       coalesce(m.anteprima, '') as anteprima
  from public.conversazioni_chat c
  left join lateral (
    select count(*)::integer as turni,
           (array_agg(testo order by creato_il desc))[1] as anteprima
      from public.messaggi_chat
     where conversazione_id = c.id
  ) m on true;

-- ── segnalazioni ───────────────────────────────────────────────────────────
create table public.segnalazioni (
  id             uuid primary key default gen_random_uuid(),
  utente_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  testo          text not null check (length(btrim(testo)) > 0),
  stato          public.stato_segnalazione not null default 'ricevuta',
  creata_il      timestamptz not null default now(),
  aggiornata_il  timestamptz not null default now()
);
create index segnalazioni_utente_idx on public.segnalazioni (utente_id, creata_il desc);

create function privato.segnalazioni_prima_di_aggiornare()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aggiornata_il := now();
  return new;
end;
$$;

create trigger segnalazioni_prima_di_aggiornare
  before update on public.segnalazioni
  for each row execute function privato.segnalazioni_prima_di_aggiornare();

-- ── esiti dell'analisi ─────────────────────────────────────────────────────
-- Prima non avevano un utente, e `GET /capi/analisi/{id}` li dava a chiunque
-- conoscesse l'id. Ora sono dell'utente, e l'app li legge da sé. Un esito
-- racconta come è nato un capo: se il capo sparisce, sparisce anche lui.
create table public.analisi_esiti (
  id             uuid primary key default gen_random_uuid(),
  utente_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stato          public.stato_analisi not null default 'in_corso',
  capo_id        uuid,
  errore         text,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  constraint analisi_completata_ha_un_capo check (stato <> 'completata' or capo_id is not null),
  foreign key (utente_id, capo_id) references public.capi (utente_id, id) on delete cascade
);
create index analisi_esiti_utente_idx on public.analisi_esiti (utente_id, creato_il desc);
create index analisi_esiti_capo_idx on public.analisi_esiti (utente_id, capo_id);

create function privato.esiti_prima_di_aggiornare()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.creato_il := old.creato_il;
  new.aggiornato_il := now();
  return new;
end;
$$;

create trigger esiti_prima_di_aggiornare
  before update on public.analisi_esiti
  for each row execute function privato.esiti_prima_di_aggiornare();

-- ── svuotamento ────────────────────────────────────────────────────────────
-- Le righe in una transazione, e ognuna solo dell'utente che chiama. Le foto
-- nello Storage le toglie dopo il modulo dati dell'app: sono un altro servizio,
-- e non entrano in una transazione del database.
create function public.svuota_armadio(conferma text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  utente uuid := (select auth.uid());
  capi integer;
  outfit integer;
  conversazioni integer;
  usi integer;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'non_autenticato';
  end if;
  -- La parola da scrivere per intero: la stessa difesa del `Literal["SVUOTA"]`
  -- che aveva `RichiestaSvuotamento`.
  if conferma is distinct from 'SVUOTA' then
    raise exception using errcode = '22023', message = 'conferma_mancante';
  end if;

  delete from public.conversazioni_chat c where c.utente_id = utente;
  get diagnostics conversazioni = row_count;
  delete from public.usi u where u.utente_id = utente;
  get diagnostics usi = row_count;
  delete from public.outfit o where o.utente_id = utente;
  get diagnostics outfit = row_count;
  -- Gli esiti di un capo spariscono con lui; questi sono quelli senza capo,
  -- le analisi fallite o ancora in corso.
  delete from public.analisi_esiti a where a.utente_id = utente;
  delete from public.capi k where k.utente_id = utente;
  get diagnostics capi = row_count;

  return jsonb_build_object(
    'capi', capi, 'outfit', outfit, 'conversazioni', conversazioni, 'usi_registrati', usi
  );
end;
$$;
grant execute on function public.svuota_armadio(text) to authenticated;

-- ── inviti ─────────────────────────────────────────────────────────────────
-- Chi può creare un account: era `EMAIL_AMMESSE`. Vuota, nessuno si registra —
-- fail-closed come prima. Si riempie a mano (pannello o SQL), e vale anche per
-- chi entra con Google, perché l'hook guarda ogni utente che nasce.
--
-- **Vale solo se l'hook è acceso sul progetto vero** (Authentication → Hooks):
-- `config.toml` accende quello locale, non l'altro. Spento, la registrazione è
-- aperta a chiunque abbia la chiave pubblica dell'app — e sta nell'APK.
create table privato.inviti (
  email        text primary key check (email = lower(btrim(email))),
  aggiunto_il  timestamptz not null default now()
);

create function privato.accetta_solo_invitati(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  indirizzo text := lower(btrim(event -> 'user' ->> 'email'));
begin
  if indirizzo is not null and exists (select 1 from privato.inviti i where i.email = indirizzo) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Questa email non è nella lista degli inviti: chiedi a chi gestisce Aura.'
    )
  );
end;
$$;
grant usage on schema privato to supabase_auth_admin;
grant select on privato.inviti to supabase_auth_admin;
grant execute on function privato.accetta_solo_invitati(jsonb) to supabase_auth_admin;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Ogni tabella: attiva, e nessun accesso per `anon`. Le policy sono per
-- `authenticated` con la proprietà della riga; `(select auth.uid())` e non
-- `auth.uid()`, perché la sotto-select si valuta una volta per query invece
-- che una per riga.

alter table public.profili enable row level security;
alter table public.capi enable row level security;
alter table public.outfit enable row level security;
alter table public.usi enable row level security;
alter table public.conversazioni_chat enable row level security;
alter table public.messaggi_chat enable row level security;
alter table public.segnalazioni enable row level security;
alter table public.analisi_esiti enable row level security;
alter table privato.inviti enable row level security;

-- Solo i verbi che l'API conosce. Niente TRUNCATE, TRIGGER, REFERENCES:
-- TRUNCATE in particolare l'RLS non la guarda, e svuoterebbe la tabella di tutti.
grant select, insert, update, delete on public.profili, public.capi, public.outfit, public.usi,
  public.conversazioni_chat, public.messaggi_chat, public.analisi_esiti to authenticated;
grant select on public.conversazioni_elenco to authenticated;
-- Le segnalazioni non si cancellano, e di una si cambia solo lo stato.
grant select, insert on public.segnalazioni to authenticated;
grant update (stato) on public.segnalazioni to authenticated;

-- L'hook gira come `supabase_auth_admin`, che l'RLS non la scavalca: senza
-- questa policy non vede nessun invito e rifiuta tutti (visto il 2026-09-25,
-- con una registrazione vera sullo stack locale). Nessun altro la legge.
create policy "gli inviti: li legge solo Auth" on privato.inviti
  for select to supabase_auth_admin using (true);

-- profili: la riga è l'utente stesso.
create policy "il proprio profilo: lettura" on public.profili
  for select to authenticated using ((select auth.uid()) = id);
create policy "il proprio profilo: creazione" on public.profili
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "il proprio profilo: modifica" on public.profili
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- capi, outfit, usi, conversazioni, messaggi, esiti: tutto e solo il proprio.
create policy "i propri capi: lettura" on public.capi
  for select to authenticated using ((select auth.uid()) = utente_id);
create policy "i propri capi: creazione" on public.capi
  for insert to authenticated with check ((select auth.uid()) = utente_id);
create policy "i propri capi: modifica" on public.capi
  for update to authenticated using ((select auth.uid()) = utente_id) with check ((select auth.uid()) = utente_id);
create policy "i propri capi: cancellazione" on public.capi
  for delete to authenticated using ((select auth.uid()) = utente_id);

create policy "i propri outfit: lettura" on public.outfit
  for select to authenticated using ((select auth.uid()) = utente_id);
create policy "i propri outfit: creazione" on public.outfit
  for insert to authenticated with check ((select auth.uid()) = utente_id);
create policy "i propri outfit: modifica" on public.outfit
  for update to authenticated using ((select auth.uid()) = utente_id) with check ((select auth.uid()) = utente_id);
create policy "i propri outfit: cancellazione" on public.outfit
  for delete to authenticated using ((select auth.uid()) = utente_id);

create policy "i propri usi: lettura" on public.usi
  for select to authenticated using ((select auth.uid()) = utente_id);
create policy "i propri usi: creazione" on public.usi
  for insert to authenticated with check ((select auth.uid()) = utente_id);
create policy "i propri usi: cancellazione" on public.usi
  for delete to authenticated using ((select auth.uid()) = utente_id);

create policy "le proprie conversazioni: lettura" on public.conversazioni_chat
  for select to authenticated using ((select auth.uid()) = utente_id);
create policy "le proprie conversazioni: creazione" on public.conversazioni_chat
  for insert to authenticated with check ((select auth.uid()) = utente_id);
create policy "le proprie conversazioni: modifica" on public.conversazioni_chat
  for update to authenticated using ((select auth.uid()) = utente_id) with check ((select auth.uid()) = utente_id);
create policy "le proprie conversazioni: cancellazione" on public.conversazioni_chat
  for delete to authenticated using ((select auth.uid()) = utente_id);

create policy "i propri messaggi: lettura" on public.messaggi_chat
  for select to authenticated using ((select auth.uid()) = utente_id);
create policy "i propri messaggi: creazione" on public.messaggi_chat
  for insert to authenticated with check ((select auth.uid()) = utente_id);
create policy "i propri messaggi: cancellazione" on public.messaggi_chat
  for delete to authenticated using ((select auth.uid()) = utente_id);

create policy "i propri esiti: lettura" on public.analisi_esiti
  for select to authenticated using ((select auth.uid()) = utente_id);
create policy "i propri esiti: creazione" on public.analisi_esiti
  for insert to authenticated with check ((select auth.uid()) = utente_id);
create policy "i propri esiti: modifica" on public.analisi_esiti
  for update to authenticated using ((select auth.uid()) = utente_id) with check ((select auth.uid()) = utente_id);
create policy "i propri esiti: cancellazione" on public.analisi_esiti
  for delete to authenticated using ((select auth.uid()) = utente_id);

-- segnalazioni: ognuno crea e legge le proprie, nate «ricevute»;
-- l'amministratore le legge tutte ed è l'unico che ne cambia lo stato.
create policy "le segnalazioni: lettura" on public.segnalazioni
  for select to authenticated
  using ((select auth.uid()) = utente_id or (select privato.e_amministratore()));
create policy "le segnalazioni: creazione" on public.segnalazioni
  for insert to authenticated
  with check ((select auth.uid()) = utente_id and stato = 'ricevuta');
create policy "le segnalazioni: stato, solo l'amministratore" on public.segnalazioni
  for update to authenticated
  using ((select privato.e_amministratore()))
  with check ((select privato.e_amministratore()));

-- ── Storage ────────────────────────────────────────────────────────────────
-- Due bucket privati, una cartella per utente: `{utente_id}/…`. Le foto dei
-- capi (e l'avatar) in `foto`; gli zip di «Scarica i tuoi dati» in
-- `esportazioni`. Il percorso lo controlla `privato.percorso_di`, la stessa
-- funzione dei CHECK sulle tabelle.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('foto', 'foto', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('esportazioni', 'esportazioni', false, 52428800, array['application/zip']);

-- Tutte e quattro le operazioni: l'upsert di un file ne chiede tre (INSERT,
-- SELECT, UPDATE), e lo svuotamento la cancellazione.
create policy "i propri file: lettura" on storage.objects
  for select to authenticated
  using (bucket_id in ('foto', 'esportazioni') and privato.percorso_di((select auth.uid()), name));
create policy "i propri file: caricamento" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('foto', 'esportazioni') and privato.percorso_di((select auth.uid()), name));
create policy "i propri file: sostituzione" on storage.objects
  for update to authenticated
  using (bucket_id in ('foto', 'esportazioni') and privato.percorso_di((select auth.uid()), name))
  with check (bucket_id in ('foto', 'esportazioni') and privato.percorso_di((select auth.uid()), name));
create policy "i propri file: cancellazione" on storage.objects
  for delete to authenticated
  using (bucket_id in ('foto', 'esportazioni') and privato.percorso_di((select auth.uid()), name));
