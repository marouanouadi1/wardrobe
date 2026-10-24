-- L'avatar a cursori di MakeHuman (ADR 0012, ADR 0013): da quale corpo parte e quanto ha
-- mosso ogni cursore. L'altezza non è qui: è `altezza_cm`, che l'avatar legge.
--
-- I valori delle tre enum e i limiti dei cursori sono quelli di `services/api/src/domain/
-- models.py` (`CorpoBase`, `TonoPelle`, `ColoreCapelli`, `LIMITI_CURSORI_AVATAR`): il gate
-- `verifica_database.py` li confronta, come per le altre.

create type public.corpo_base as enum ('donna', 'uomo');
create type public.tono_pelle as enum ('chiarissima', 'chiara', 'dorata', 'olivastra', 'scura', 'molto_scura');
create type public.colore_capelli as enum ('neri', 'castano_scuro', 'castani', 'biondo_scuro', 'biondi', 'rossi', 'grigi');

-- I cursori sono un oggetto `{nome di MakeHuman: valore}`, non una colonna ciascuno: l'elenco
-- è in revisione, e una colonna per cursore vorrebbe una migrazione a ogni cambio. L'app li
-- scrive da sé, quindi è qui che si ferma un oggetto che non ha quella forma — e che farebbe
-- fallire `Profilo` quando il backend lo legge. Il limite è −1…+1 per tutti: che una macro
-- vada da 0 a 1 lo sa il motore dell'app (`statoDi`), che ferma lì i valori fuori.
-- Il `case` esterno non è uno stile: `jsonb_each` su qualcosa che non è un oggetto solleva
-- un errore, e in un `and` Postgres non promette l'ordine in cui valuta i due lati.
create function privato.cursori_validi(cursori jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(cursori) <> 'object' then false
    else (select count(*) from jsonb_object_keys(cursori)) <= 64
     and not exists (
       select 1
         from jsonb_each(cursori) as voce(nome, valore)
        where nome !~ '^[a-z0-9-]{1,64}$'
           or case
                when jsonb_typeof(valore) = 'number' then (valore::text)::numeric not between -1 and 1
                else true
              end
     )
  end
$$;
grant execute on function privato.cursori_validi(jsonb) to authenticated;

-- Nullable o con un default: `profili` ha già righe sul progetto vero.
alter table public.profili
  add column avatar_corpo_base public.corpo_base,
  add column avatar_cursori    jsonb not null default '{}' check (privato.cursori_validi(avatar_cursori)),
  add column avatar_pelle      public.tono_pelle,
  add column avatar_capelli    public.colore_capelli;
