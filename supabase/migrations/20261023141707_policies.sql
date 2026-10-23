-- T009: funciones auxiliares y políticas RLS (tabla 2.3 del plan).
-- game_tiles NO aparece aquí a propósito: no tiene política.

-- Supabase concede EXECUTE a anon y authenticated en toda función nueva de public.
-- Se revoca por defecto: cada función invocable por RPC debe concederse explícitamente.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- ¿Participa el usuario actual en esta partida? SECURITY DEFINER para no recursar en RLS.
create function public.is_participant(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.profile_id = (select auth.uid())
  );
$$;

create function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_participant(uuid), public.is_room_member(uuid) from public, anon;
grant  execute on function public.is_participant(uuid), public.is_room_member(uuid) to authenticated;

-- Buscar una sala por su código exacto (sin ser miembro). No expone la lista de salas.
create function public.get_room_by_code(p_code text)
returns table (
  id         uuid,
  code       text,
  host_id    uuid,
  seats      smallint,
  status     text,
  expires_at timestamptz,
  members    bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.code, r.host_id, r.seats, r.status, r.expires_at,
         (select count(*) from public.room_members rm where rm.room_id = r.id)
  from public.rooms r
  where r.code = upper(p_code);
$$;

revoke execute on function public.get_room_by_code(text) from public, anon;
grant  execute on function public.get_room_by_code(text) to authenticated;

-- tile_definitions: lectura pública, sin escritura.
create policy tile_definitions_select on public.tile_definitions
  for select to anon, authenticated using (true);

-- profiles: lectura pública; solo el propio usuario actualiza (y solo nombre y avatar, por grant).
create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Partida: la ven sus participantes.
create policy games_select on public.games
  for select to authenticated using (public.is_participant(id));

create policy game_players_select on public.game_players
  for select to authenticated using (public.is_participant(game_id));

create policy game_clues_select on public.game_clues
  for select to authenticated using (public.is_participant(game_id));

create policy game_events_select on public.game_events
  for select to authenticated using (public.is_participant(game_id));

-- Salas: las ve su anfitrión o sus miembros. Por código exacto, vía get_room_by_code.
create policy rooms_select on public.rooms
  for select to authenticated
  using (host_id = (select auth.uid()) or public.is_room_member(id));

create policy room_members_select on public.room_members
  for select to authenticated using (public.is_room_member(room_id));

-- Cola: solo tu propia fila.
create policy matchmaking_queue_select on public.matchmaking_queue
  for select to authenticated using (profile_id = (select auth.uid()));

-- ELO: público.
create policy elo_history_select on public.elo_history
  for select to anon, authenticated using (true);
