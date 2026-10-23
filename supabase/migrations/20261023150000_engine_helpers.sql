-- T020 + T021: ayudantes del motor de juego. Todo vive en game_internal (sin acceso para clientes).
--
-- Convención del motor:
--   * Toda función que MUTA una partida empieza llamando a game_internal.lock_game(),
--     que toma `select ... for update` sobre la fila de games (restricción R3).
--   * Las funciones *_as reciben el id del jugador de la partida (no auth.uid()), así que
--     humanos, bots y tareas periódicas ejecutan exactamente el mismo código.

-- Bloquea la partida y devuelve su fila.
create function game_internal.lock_game(p_game_id uuid)
returns public.games
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game_not_found';
  end if;
  return v_game;
end;
$$;

-- Registra un evento con número de secuencia correlativo. El update de event_seq toma el
-- bloqueo de la fila de games, así que los números no se repiten ni dejan huecos aunque
-- alguien se olvide de bloquear antes.
create function game_internal.emit_event(
  p_game_id uuid,
  p_kind    text,
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_seq bigint;
begin
  update public.games
     set event_seq = event_seq + 1
   where id = p_game_id
  returning event_seq into v_seq;

  insert into public.game_events (game_id, seq, kind, actor_id, payload)
  values (p_game_id, v_seq, p_kind, p_actor_id, p_payload);

  return v_seq;
end;
$$;

-- auth.uid() -> id del jugador dentro de la partida.
create function game_internal.caller_player(p_game_id uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_player uuid;
begin
  select id into v_player
    from public.game_players
   where game_id = p_game_id
     and profile_id = (select auth.uid());
  if v_player is null then
    raise exception 'not_a_player';
  end if;
  return v_player;
end;
$$;

-- Cierra la partida. Idempotente. Requiere la partida bloqueada por quien llama.
create function game_internal.finish_game(p_game_id uuid, p_winner uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id;
  if v_game.status = 'finished' then
    return;
  end if;

  update public.games
     set status = 'finished',
         winner_player_id = p_winner,
         finished_at = now(),
         turn_deadline = null
   where id = p_game_id;

  perform game_internal.emit_event(
    p_game_id, 'game_ended', p_winner,
    jsonb_build_object('winner_player_id', p_winner)
  );

  -- Contadores de perfil: todas las partidas, solo jugadores humanos.
  update public.profiles p
     set games_played = p.games_played + 1,
         games_won    = p.games_won + (case when gp.id = p_winner then 1 else 0 end)
    from public.game_players gp
   where gp.game_id = p_game_id
     and gp.profile_id = p.id;

  -- apply_elo se crea en el hito 7 (T072); las partidas clasificatorias no existen antes.
  if v_game.mode = 'ranked' then
    perform game_internal.apply_elo(p_game_id);
  end if;
end;
$$;

-- Si queda un solo jugador activo (o ninguno), la partida termina. Devuelve true si terminó.
create function game_internal.check_last_standing(p_game_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_active int;
  v_winner uuid;
begin
  select count(*), (array_agg(id))[1]
    into v_active, v_winner
    from public.game_players
   where game_id = p_game_id and state = 'active';

  if v_active <= 1 then
    perform game_internal.finish_game(p_game_id, case when v_active = 1 then v_winner end);
    return true;
  end if;
  return false;
end;
$$;

-- Pasa el turno al siguiente jugador activo. Requiere la partida bloqueada por quien llama.
-- Termina la partida si solo queda un jugador, o si se agotó la reserva y se completó la
-- ronda final (empate técnico).
create function game_internal.advance_turn(p_game_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game    public.games;
  v_n       int;
  v_reserve int;
  v_fr      smallint;
  v_k       int;
  v_seat    int;
begin
  if game_internal.check_last_standing(p_game_id) then
    return;
  end if;

  select * into v_game from public.games where id = p_game_id;
  select count(*) into v_n from public.game_players where game_id = p_game_id;
  select count(*) into v_reserve
    from public.game_tiles where game_id = p_game_id and place = 'reserve';

  v_fr := v_game.final_round_until_seat;
  if v_reserve = 0 and v_fr is null then
    -- La ronda final empieza en el turno que acaba de terminar y acaba al volver a su asiento.
    v_fr := v_game.current_seat;
    update public.games set final_round_until_seat = v_fr where id = p_game_id;
  end if;

  for v_k in 1..v_n loop
    v_seat := (v_game.current_seat + v_k) % v_n;

    if v_fr is not null and v_seat = v_fr then
      perform game_internal.finish_game(p_game_id, null);
      return;
    end if;

    if exists (
      select 1 from public.game_players
       where game_id = p_game_id and seat = v_seat and state = 'active'
    ) then
      update public.games
         set current_seat  = v_seat,
             phase         = 'reveal',
             revealed_tile = null,
             turn_deadline = now() + interval '60 seconds'
       where id = p_game_id;
      return;
    end if;
  end loop;

  perform game_internal.finish_game(p_game_id, null);
end;
$$;
