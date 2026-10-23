-- T025 + T026: declarar el código y abandonar.

-- ---------------------------------------------------------------------------------------
-- Declarar: cualquier momento, incluso fuera de turno; una sola oportunidad.
-- Devuelve solo si acertó. Nunca devuelve ni registra los números reales (R2): quien queda
-- eliminado los recibe después por get_game_state.
-- ---------------------------------------------------------------------------------------
create function game_internal.declare_code_as(
  p_game_id   uuid,
  p_player_id uuid,
  p_numbers   smallint[]
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_game        public.games;
  v_player      public.game_players;
  v_actual      smallint[];
  v_correct     boolean;
  v_was_current boolean;
  v_i           int;
begin
  v_game := game_internal.lock_game(p_game_id);

  if v_game.status <> 'active' then raise exception 'game_not_active'; end if;

  select * into v_player from public.game_players
   where id = p_player_id and game_id = p_game_id;
  if not found then raise exception 'not_a_player'; end if;
  if v_player.state <> 'active' then raise exception 'player_not_active'; end if;
  if v_player.has_declared then raise exception 'already_declared'; end if;

  -- Una declaración mal formada se rechaza sin gastar la oportunidad.
  if p_numbers is null or coalesce(array_length(p_numbers, 1), 0) <> 5 then
    raise exception 'invalid_declaration';
  end if;
  for v_i in 1..5 loop
    if p_numbers[v_i] is null or p_numbers[v_i] not between 1 and 60
       or (v_i > 1 and p_numbers[v_i] <= p_numbers[v_i - 1]) then
      raise exception 'invalid_declaration';
    end if;
  end loop;

  -- La oportunidad se gasta pase lo que pase.
  update public.game_players set has_declared = true where id = p_player_id;

  select array_agg(number order by slot) into v_actual
    from public.game_tiles
   where game_id = p_game_id and owner_id = p_player_id and place = 'support';

  v_correct := (v_actual = p_numbers);

  perform game_internal.emit_event(
    p_game_id, 'declared', p_player_id, jsonb_build_object('correct', v_correct)
  );

  if v_correct then
    perform game_internal.finish_game(p_game_id, p_player_id);
    return true;
  end if;

  v_was_current := (v_game.current_seat = v_player.seat);

  update public.game_players set state = 'eliminated' where id = p_player_id;
  perform game_internal.emit_event(
    p_game_id, 'eliminated', p_player_id, jsonb_build_object('reason', 'wrong_declaration')
  );

  if game_internal.check_last_standing(p_game_id) then
    return false;
  end if;
  if v_was_current then
    perform game_internal.advance_turn(p_game_id);
  end if;
  return false;
end;
$$;

create function public.declare_code(p_game_id uuid, p_numbers smallint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'correct',
    game_internal.declare_code_as(p_game_id, game_internal.caller_player(p_game_id), p_numbers)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Abandonar. Cuenta como derrota a efectos de ELO (lo resuelve apply_elo al cerrar).
-- ---------------------------------------------------------------------------------------
create function game_internal.abandon_as(p_game_id uuid, p_player_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game        public.games;
  v_player      public.game_players;
  v_was_current boolean;
begin
  v_game := game_internal.lock_game(p_game_id);

  if v_game.status <> 'active' then raise exception 'game_not_active'; end if;

  select * into v_player from public.game_players
   where id = p_player_id and game_id = p_game_id;
  if not found then raise exception 'not_a_player'; end if;
  if v_player.state <> 'active' then raise exception 'player_not_active'; end if;

  v_was_current := (v_game.current_seat = v_player.seat);

  update public.game_players set state = 'abandoned' where id = p_player_id;
  perform game_internal.emit_event(
    p_game_id, 'eliminated', p_player_id, jsonb_build_object('reason', 'abandoned')
  );

  if game_internal.check_last_standing(p_game_id) then
    return;
  end if;
  if v_was_current then
    perform game_internal.advance_turn(p_game_id);
  end if;
end;
$$;

create function public.abandon_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform game_internal.abandon_as(p_game_id, game_internal.caller_player(p_game_id));
end;
$$;

revoke execute on function public.declare_code(uuid, smallint[]) from public, anon;
grant  execute on function public.declare_code(uuid, smallint[]) to authenticated;

revoke execute on function public.abandon_game(uuid) from public, anon;
grant  execute on function public.abandon_game(uuid) to authenticated;
