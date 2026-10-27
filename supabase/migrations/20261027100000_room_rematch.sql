-- Revancha en salas privadas. Al acabar una partida de sala, cada miembro elige «Jugar otra vez»
-- o «Volver al inicio» (que le saca de la sala). Cuando todos los que siguen en la sala han
-- pedido otra, empieza una partida nueva en la misma sala, con las mismas plazas y bots.
-- Hacen falta al menos 2 personas: si te quedas solo, se acaba (aunque la sala tenga bots).
-- Si sale el anfitrión, la sala sigue y pasa a ser anfitrión quien entró antes.

-- De qué sala viene cada partida: al empezar la siguiente, rooms.game_id deja de apuntar a la
-- anterior y sin esto no habría forma de volver de ella a la sala.
alter table public.games
  add column room_id uuid references public.rooms (id) on delete set null;

-- La partida tras la que este miembro ha pedido otra. Vale solo mientras coincida con
-- rooms.game_id: al empezar la nueva, los votos anteriores dejan de contar solos.
alter table public.room_members
  add column rematch_game_id uuid references public.games (id) on delete set null;

-- ---------------------------------------------------------------------------------------
-- Saca a alguien de la sala. Si era el anfitrión, lo pasa a quien entró antes; si no queda
-- nadie, la sala se cierra. La sala tiene que venir ya bloqueada.
-- ---------------------------------------------------------------------------------------
create function game_internal.drop_room_member(p_room_id uuid, p_profile_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_next uuid;
begin
  delete from public.room_members where room_id = p_room_id and profile_id = p_profile_id;

  if exists (select 1 from public.rooms where id = p_room_id and host_id = p_profile_id) then
    select profile_id into v_next from public.room_members
     where room_id = p_room_id order by joined_at limit 1;
    if v_next is null then
      update public.rooms set status = 'expired' where id = p_room_id;
    else
      update public.rooms set host_id = v_next where id = p_room_id;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Crea y reparte una partida para la sala con estas personas (los bots cubren las plazas
-- libres si la sala lo pide). Los asientos se sortean. La sala tiene que venir ya bloqueada.
-- ---------------------------------------------------------------------------------------
create function game_internal.create_room_game(p_room_id uuid, p_humans uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_room   public.rooms;
  v_humans uuid[];
  v_seats  int[];
  v_n      int;
  v_total  int;
  v_game   uuid := gen_random_uuid();
  i        int;
begin
  select * into v_room from public.rooms where id = p_room_id;

  select array_agg(h order by random()) into v_humans from unnest(p_humans) h;
  v_n := coalesce(array_length(v_humans, 1), 0);
  v_total := case when v_room.fill_with_bots then v_room.seats else v_n end;
  if v_total < 2 then raise exception 'not_enough_players'; end if;

  select array_agg(s order by random()) into v_seats from generate_series(0, v_total - 1) s;

  insert into public.games (id, mode, status, room_id) values (v_game, 'private', 'waiting', p_room_id);
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

-- Iniciar la partida de la sala: igual que antes, ahora a través de create_room_game para que
-- la partida sepa de qué sala viene.
create or replace function public.start_game(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_room   public.rooms;
  v_humans uuid[];
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.host_id <> v_user then raise exception 'not_host'; end if;
  if v_room.status <> 'open' then raise exception 'room_not_open'; end if;
  if v_room.expires_at < now() then raise exception 'room_expired'; end if;

  select array_agg(profile_id) into v_humans from public.room_members where room_id = p_room_id;
  return game_internal.create_room_game(p_room_id, v_humans);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Sala de una partida terminada, bloqueada, con quien llama dentro. Quien abandonó esa partida
-- ya no cuenta como miembro: se le saca aquí. Devuelve null si la partida no es de sala.
-- ---------------------------------------------------------------------------------------
create function game_internal.finished_room(p_game_id uuid)
returns public.rooms
language plpgsql
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_room    public.rooms;
  v_gone    uuid;
begin
  select room_id into v_room_id from public.games where id = p_game_id;
  if v_room_id is null then return null; end if;

  select * into v_room from public.rooms where id = v_room_id for update;

  for v_gone in
    select gp.profile_id from public.game_players gp
      join public.room_members rm on rm.room_id = v_room_id and rm.profile_id = gp.profile_id
     where gp.game_id = p_game_id and gp.state = 'abandoned'
  loop
    perform game_internal.drop_room_member(v_room_id, v_gone);
  end loop;

  select * into v_room from public.rooms where id = v_room_id;
  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- «Jugar otra vez». Apunta el voto y, si con él ya han votado todos los que siguen en la sala
-- (y son al menos 2), empieza la nueva partida. Devuelve su id, o null si aún falta alguien.
-- Si la nueva ya había empezado, la devuelve sin más.
-- ---------------------------------------------------------------------------------------
create function public.rematch_room(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_room    public.rooms;
  v_humans  uuid[];
  v_pending int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  v_room := game_internal.finished_room(p_game_id);
  if v_room.id is null then raise exception 'not_a_room_game'; end if;
  if not exists (select 1 from public.room_members where room_id = v_room.id and profile_id = v_user) then
    raise exception 'not_a_member';
  end if;
  if v_room.game_id is distinct from p_game_id then return v_room.game_id; end if;
  if (select status from public.games where id = p_game_id) <> 'finished' then
    raise exception 'game_not_finished';
  end if;

  update public.room_members set rematch_game_id = p_game_id
   where room_id = v_room.id and profile_id = v_user;

  select array_agg(profile_id),
         count(*) filter (where rematch_game_id is distinct from p_game_id)
    into v_humans, v_pending
    from public.room_members where room_id = v_room.id;

  if v_pending > 0 or coalesce(array_length(v_humans, 1), 0) < 2 then return null; end if;
  return game_internal.create_room_game(v_room.id, v_humans);
end;
$$;

-- «Volver al inicio» tras una partida de sala: salir de la sala.
create function public.leave_room_game(p_game_id uuid)
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

  v_room := game_internal.finished_room(p_game_id);
  if v_room.id is null then return; end if;
  perform game_internal.drop_room_member(v_room.id, v_user);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Estado de la revancha para quien sigue en la sala: quién sigue (con su id en la partida),
-- quién ha pedido otra y, si ya ha empezado, la partida nueva. Null si no es de sala o ya no
-- estás en ella.
-- ---------------------------------------------------------------------------------------
create function public.get_room_rematch(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'room_id', r.id,
           'next_game_id', case when r.game_id is distinct from p_game_id then r.game_id end,
           'members', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'profile_id', rm.profile_id,
                      -- su id en la partida, para que el cliente lo cruce con get_game_state
                      'player_id', (select gp.id from public.game_players gp
                                     where gp.game_id = p_game_id and gp.profile_id = rm.profile_id),
                      'ready', rm.rematch_game_id is not distinct from p_game_id
                    ) order by rm.joined_at)
               from public.room_members rm
              where rm.room_id = r.id
                -- quien abandonó la partida ya no cuenta, aunque aún no se le haya sacado
                and not exists (
                  select 1 from public.game_players gp
                   where gp.game_id = p_game_id and gp.profile_id = rm.profile_id
                     and gp.state = 'abandoned'
                )
           ), '[]'::jsonb)
         )
    from public.games g
    join public.rooms r on r.id = g.room_id
   where g.id = p_game_id
     and exists (
       select 1 from public.room_members rm
        where rm.room_id = r.id and rm.profile_id = (select auth.uid())
     );
$$;

revoke execute on function public.rematch_room(uuid), public.leave_room_game(uuid), public.get_room_rematch(uuid)
  from public, anon;
grant  execute on function public.rematch_room(uuid), public.leave_room_game(uuid), public.get_room_rematch(uuid)
  to authenticated;
