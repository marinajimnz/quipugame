-- T023 + T024: acciones del turno. Cada una tiene su función interna *_as (la usan también
-- los bots y las tareas periódicas) y un envoltorio público que resuelve auth.uid().

-- ---------------------------------------------------------------------------------------
-- Acción 1: revelar una ficha de la reserva.
-- ---------------------------------------------------------------------------------------
create function game_internal.reveal_tile_as(p_game_id uuid, p_player_id uuid, p_color smallint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game    public.games;
  v_player  public.game_players;
  v_reserve int;
  v_tile    public.game_tiles;
begin
  v_game := game_internal.lock_game(p_game_id);

  if v_game.status <> 'active' then raise exception 'game_not_active'; end if;

  select * into v_player from public.game_players
   where id = p_player_id and game_id = p_game_id;
  if not found then raise exception 'not_a_player'; end if;
  if v_player.state <> 'active' then raise exception 'player_not_active'; end if;
  if v_game.current_seat <> v_player.seat then raise exception 'not_your_turn'; end if;
  if v_game.phase <> 'reveal' then raise exception 'wrong_phase'; end if;
  if p_color is null or p_color not between 0 and 4 then raise exception 'invalid_color'; end if;

  select count(*) into v_reserve
    from public.game_tiles where game_id = p_game_id and place = 'reserve';

  if v_reserve = 0 then
    -- Reserva vacía: se omite la acción y el mazo visible queda como está.
    update public.games set phase = 'clue', revealed_tile = null where id = p_game_id;
    perform game_internal.emit_event(p_game_id, 'turn_skipped', p_player_id, '{}'::jsonb);
  else
    select gt.* into v_tile
      from public.game_tiles gt
      join public.tile_definitions td on td.number = gt.number
     where gt.game_id = p_game_id
       and gt.place = 'reserve'
       and td.color_index = p_color
     order by random()
     limit 1;
    if not found then raise exception 'no_tiles_of_color'; end if;

    update public.game_tiles set place = 'pool' where id = v_tile.id;
    update public.games set phase = 'clue', revealed_tile = v_tile.number where id = p_game_id;

    perform game_internal.emit_event(
      p_game_id, 'tile_revealed', p_player_id,
      jsonb_build_object('number', v_tile.number, 'color_index', p_color)
    );
  end if;

  update public.game_players set timeouts = 0 where id = p_player_id;
end;
$$;

create function public.reveal_tile(p_game_id uuid, p_color smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform game_internal.reveal_tile_as(
    p_game_id, game_internal.caller_player(p_game_id), p_color
  );
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Acción 2: pedir una pista sobre una ficha del mazo visible.
--   classify: ¿entre qué dos de mis fichas encaja esta por número? (0..5)
--   compare : ¿tiene los mismos puntos que mi ficha de la posición p_slot? (sí/no)
-- La respuesta la calcula el servidor y es pública.
-- ---------------------------------------------------------------------------------------
create function game_internal.ask_clue_as(
  p_game_id   uuid,
  p_player_id uuid,
  p_tile      smallint,
  p_kind      public.clue_kind,
  p_slot      smallint default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game      public.games;
  v_player    public.game_players;
  v_position  smallint;
  v_same      boolean;
  v_tile_pts  smallint;
  v_own_pts   smallint;
begin
  v_game := game_internal.lock_game(p_game_id);

  if v_game.status <> 'active' then raise exception 'game_not_active'; end if;

  select * into v_player from public.game_players
   where id = p_player_id and game_id = p_game_id;
  if not found then raise exception 'not_a_player'; end if;
  if v_player.state <> 'active' then raise exception 'player_not_active'; end if;
  if v_game.current_seat <> v_player.seat then raise exception 'not_your_turn'; end if;
  if v_game.phase <> 'clue' then raise exception 'wrong_phase'; end if;

  if not exists (
    select 1 from public.game_tiles
     where game_id = p_game_id and number = p_tile and place = 'pool'
  ) then
    raise exception 'tile_not_in_pool';
  end if;

  if p_kind = 'classify' then
    if p_slot is not null then raise exception 'invalid_slot'; end if;

    select count(*) into v_position
      from public.game_tiles
     where game_id = p_game_id
       and owner_id = p_player_id
       and place = 'support'
       and number < p_tile;
  else
    if p_slot is null or p_slot not between 0 and 4 then raise exception 'invalid_slot'; end if;

    select points into v_tile_pts from public.tile_definitions where number = p_tile;

    select td.points into v_own_pts
      from public.game_tiles gt
      join public.tile_definitions td on td.number = gt.number
     where gt.game_id = p_game_id
       and gt.owner_id = p_player_id
       and gt.place = 'support'
       and gt.slot = p_slot;

    v_same := (v_tile_pts = v_own_pts);
  end if;

  insert into public.game_clues
    (game_id, asker_id, tile_number, kind, target_slot, answer_position, answer_same)
  values
    (p_game_id, p_player_id, p_tile, p_kind, p_slot, v_position, v_same);

  update public.game_tiles set place = 'spent'
   where game_id = p_game_id and number = p_tile;

  perform game_internal.emit_event(
    p_game_id, 'clue_asked', p_player_id,
    jsonb_build_object(
      'tile_number',     p_tile,
      'kind',            p_kind,
      'target_slot',     p_slot,
      'answer_position', v_position,
      'answer_same',     v_same
    )
  );

  update public.game_players set timeouts = 0 where id = p_player_id;

  perform game_internal.advance_turn(p_game_id);
end;
$$;

create function public.ask_clue(
  p_game_id uuid,
  p_tile    smallint,
  p_kind    public.clue_kind,
  p_slot    smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform game_internal.ask_clue_as(
    p_game_id, game_internal.caller_player(p_game_id), p_tile, p_kind, p_slot
  );
end;
$$;

revoke execute on function public.reveal_tile(uuid, smallint) from public, anon;
grant  execute on function public.reveal_tile(uuid, smallint) to authenticated;

revoke execute on function public.ask_clue(uuid, smallint, public.clue_kind, smallint) from public, anon;
grant  execute on function public.ask_clue(uuid, smallint, public.clue_kind, smallint) to authenticated;
