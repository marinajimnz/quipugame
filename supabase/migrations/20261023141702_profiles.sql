-- T004: perfiles públicos y alta automática al crear un usuario.

create extension if not exists citext with schema extensions;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name extensions.citext not null unique
               check (char_length(display_name::text) between 3 and 16),
  avatar_key   text not null default 'default',
  elo          integer not null default 1000 check (elo >= 100),
  ranked_games integer not null default 0 check (ranked_games >= 0),
  ranked_wins  integer not null default 0 check (ranked_wins >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  games_won    integer not null default 0 check (games_won >= 0),
  is_guest     boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- RLS no restringe columnas: eso lo hace el grant. El cliente solo puede cambiar
-- nombre y avatar; ELO, contadores e is_guest los tocan únicamente las funciones.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_key) on public.profiles to authenticated;

-- Alta: todo usuario nuevo (también el anónimo) recibe un nombre provisional Invitado-XXXXX.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  loop
    v_name := 'Invitado-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (
      select 1 from public.profiles where display_name = v_name::extensions.citext
    );
  end loop;

  insert into public.profiles (id, display_name, is_guest)
  values (new.id, v_name, coalesce(new.is_anonymous, false));

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
