-- T051: salas privadas. Código de 6 caracteres sin ambigüedades (sin 0, O, 1, I), 2–4 plazas,
-- caducidad a los 30 minutos (la aplica expire_rooms) y partida privada: no afecta al ELO.
-- Las salas se bloquean (select ... for update) para que dos personas no cojan la última plaza.

-- Crea una sala y mete al anfitrión. Cada anfitrión tiene una sola sala abierta: crear otra
-- cierra la anterior. Devuelve el código.
create function public.create_room(p_seats smallint, p_fill_bots boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code     text;
  v_room     uuid;
  v_attempt  int := 0;
  i          int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_seats is null or p_seats not between 2 and 4 then raise exception 'invalid_seats'; end if;
  if not exists (select 1 from public.profiles where id = v_user) then raise exception 'no_profile'; end if;

  update public.rooms set status = 'expired' where host_id = v_user and status = 'open';

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 20 then raise exception 'code_generation_failed'; end if;

    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;

    begin
      insert into public.rooms (code, host_id, seats, fill_with_bots)
      values (v_code, v_user, p_seats, coalesce(p_fill_bots, false))
      returning id into v_room;
      exit;
    exception when unique_violation then
      continue; -- colisión de código: otro intento
    end;
  end loop;

  insert into public.room_members (room_id, profile_id) values (v_room, v_user);
  return v_code;
end;
$$;

-- Unirse por código (admite minúsculas). Idempotente: si ya eres miembro, devuelve la sala.
create function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_room  public.rooms;
  v_count int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_user) then raise exception 'no_profile'; end if;

  select * into v_room from public.rooms where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'room_not_found'; end if;

  if exists (select 1 from public.room_members where room_id = v_room.id and profile_id = v_user) then
    return v_room.id;
  end if;

  if v_room.status = 'started' then raise exception 'room_not_open'; end if;
  if v_room.status = 'expired' or v_room.expires_at < now() then raise exception 'room_expired'; end if;

  select count(*) into v_count from public.room_members where room_id = v_room.id;
  if v_count >= v_room.seats then raise exception 'room_full'; end if;

  insert into public.room_members (room_id, profile_id) values (v_room.id, v_user);
  return v_room.id;
end;
$$;

-- Salir de la sala. Si sale el anfitrión, la sala se cierra.
create function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_room public.rooms;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and profile_id = v_user) then
    raise exception 'not_a_member';
  end if;
  if v_room.status <> 'open' then raise exception 'room_not_open'; end if;

  if v_room.host_id = v_user then
    update public.rooms set status = 'expired' where id = p_room_id;
  else
    delete from public.room_members where room_id = p_room_id and profile_id = v_user;
  end if;
end;
$$;

-- Iniciar la partida: solo el anfitrión. Con "rellenar con bots", las plazas libres se cubren
-- con bots normales y basta con el anfitrión; sin bots hacen falta al menos 2 personas.
-- Los asientos se sortean entre personas y bots.
create function public.start_game(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_room   public.rooms;
  v_humans uuid[];
  v_seats  int[];
  v_n      int;
  v_total  int;
  v_game   uuid := gen_random_uuid();
  i        int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.host_id <> v_user then raise exception 'not_host'; end if;
  if v_room.status <> 'open' then raise exception 'room_not_open'; end if;
  if v_room.expires_at < now() then raise exception 'room_expired'; end if;

  select array_agg(profile_id order by random()) into v_humans
    from public.room_members where room_id = p_room_id;
  v_n := coalesce(array_length(v_humans, 1), 0);
  v_total := case when v_room.fill_with_bots then v_room.seats else v_n end;
  if v_total < 2 then raise exception 'not_enough_players'; end if;

  select array_agg(s order by random()) into v_seats from generate_series(0, v_total - 1) s;

  insert into public.games (id, mode, status) values (v_game, 'private', 'waiting');
  for i in 1..v_total loop
    if i <= v_n then
      insert into public.game_players (game_id, profile_id, seat) values (v_game, v_humans[i], v_seats[i]);
    else
      insert into public.game_players (game_id, seat, is_bot, bot_difficulty)
      values (v_game, v_seats[i], true, 'normal');
    end if;
  end loop;

  perform game_internal.deal_game(v_game);
  update public.rooms set status = 'started', game_id = v_game where id = p_room_id;
  return v_game;
end;
$$;

revoke execute on function public.create_room(smallint, boolean) from public, anon;
revoke execute on function public.join_room(text) from public, anon;
revoke execute on function public.leave_room(uuid) from public, anon;
revoke execute on function public.start_game(uuid) from public, anon;
grant  execute on function public.create_room(smallint, boolean) to authenticated;
grant  execute on function public.join_room(text) to authenticated;
grant  execute on function public.leave_room(uuid) to authenticated;
grant  execute on function public.start_game(uuid) to authenticated;
