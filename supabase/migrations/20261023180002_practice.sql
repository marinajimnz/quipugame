-- T040 + T043: partida de práctica contra bots y la tarea que los hace jugar.

-- Una partida con al menos un humano termina cuando no queda ningún humano activo: los bots
-- no siguen jugando entre ellos. (Una partida solo de bots, como las simulaciones, no se corta.)
create or replace function game_internal.check_last_standing(p_game_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_active        int;
  v_winner        uuid;
  v_active_humans int;
  v_has_human     boolean;
begin
  select count(*), (array_agg(id))[1], count(*) filter (where not is_bot)
    into v_active, v_winner, v_active_humans
    from public.game_players
   where game_id = p_game_id and state = 'active';

  if v_active <= 1 then
    perform game_internal.finish_game(p_game_id, case when v_active = 1 then v_winner end);
    return true;
  end if;

  select exists (select 1 from public.game_players where game_id = p_game_id and not is_bot)
    into v_has_human;
  if v_has_human and v_active_humans = 0 then
    perform game_internal.finish_game(p_game_id, null);
    return true;
  end if;
  return false;
end;
$$;

-- Crea una partida de práctica: tú contra 1–3 bots. No afecta al ELO. Los invitados pueden jugar.
-- Empezar una nueva abandona tus partidas de práctica anteriores, para que nunca te quedes
-- bloqueado por una partida olvidada. Tu asiento es aleatorio.
create function public.start_practice_game(p_bots smallint, p_difficulty text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_game   uuid := gen_random_uuid();
  v_n      int;
  v_human  int;
  v_old    record;
  i        int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_bots is null or p_bots not between 1 and 3 then raise exception 'invalid_bots'; end if;
  if p_difficulty is null or p_difficulty not in ('easy', 'normal', 'hard') then
    raise exception 'invalid_difficulty';
  end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'no_profile';
  end if;

  for v_old in
    select gp.game_id, gp.id as player_id
      from public.game_players gp
      join public.games g on g.id = gp.game_id
     where gp.profile_id = v_user and gp.state = 'active'
       and g.mode = 'practice' and g.status = 'active'
  loop
    perform game_internal.abandon_as(v_old.game_id, v_old.player_id);
  end loop;

  v_n := p_bots + 1;
  v_human := floor(random() * v_n)::int;

  insert into public.games (id, mode, status) values (v_game, 'practice', 'waiting');
  for i in 0..v_n - 1 loop
    if i = v_human then
      insert into public.game_players (game_id, profile_id, seat) values (v_game, v_user, i);
    else
      insert into public.game_players (game_id, seat, is_bot, bot_difficulty)
      values (v_game, i, true, p_difficulty);
    end if;
  end loop;

  perform game_internal.deal_game(v_game);
  return v_game;
end;
$$;

revoke execute on function public.start_practice_game(smallint, text) from public, anon;
grant  execute on function public.start_practice_game(smallint, text) to authenticated;

-- Tarea periódica: los bots declaran en cuanto pueden y juegan su turno tras una espera de
-- 2–6 s (determinista por turno, para que los bots no se pisen entre ejecuciones).
create function game_internal.play_bot_turns()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_game  record;
  v_bot   record;
  v_g     public.games;
  v_acted int := 0;
  v_delay int;
begin
  -- Si otra ejecución sigue en marcha, no hacer nada.
  if not pg_try_advisory_xact_lock(hashtext('quipu.play_bot_turns')) then
    return 0;
  end if;

  for v_game in
    select g.id
      from public.games g
     where g.status = 'active'
       and exists (select 1 from public.game_players gp
                    where gp.game_id = g.id and gp.is_bot and gp.state = 'active')
  loop
    begin
      -- 1. Declarar (en cualquier momento).
      for v_bot in
        select id from public.game_players
         where game_id = v_game.id and is_bot and state = 'active'
      loop
        if game_internal.bot_try_declare(v_game.id, v_bot.id) is not null then
          v_acted := v_acted + 1;
        end if;
        select * into v_g from public.games where id = v_game.id;
        exit when v_g.status <> 'active';
      end loop;

      -- 2. Jugar el turno si le toca a un bot y ya esperó lo suyo.
      select * into v_g from public.games where id = v_game.id;
      if v_g.status = 'active' then
        v_delay := 2 + (abs(hashtext(v_g.id::text || ':' || v_g.event_seq::text)) % 5);
        if now() >= (v_g.turn_deadline - interval '60 seconds') + make_interval(secs => v_delay) then
          select gp.id into v_bot
            from public.game_players gp
           where gp.game_id = v_g.id and gp.seat = v_g.current_seat and gp.is_bot and gp.state = 'active';
          if found then
            if game_internal.bot_take_turn(v_g.id, v_bot.id) then
              v_acted := v_acted + 1;
            end if;
          end if;
        end if;
      end if;
    exception when others then
      -- Un fallo en una partida no debe parar las demás.
      raise warning 'play_bot_turns: partida %: %', v_game.id, sqlerrm;
    end;
  end loop;

  return v_acted;
end;
$$;
