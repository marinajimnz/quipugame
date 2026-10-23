-- T022: reparto. Interna: la llaman start_game, start_practice_game y el emparejamiento.
-- La partida ya tiene sus game_players con asientos 0..n-1 y estado waiting/dealing.

create function game_internal.deal_game(p_game_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game   public.games;
  v_n      int;
  v_max    int;
  v_player record;
  v_color  int;
  v_num    smallint;
  v_picked smallint[];
  v_i      int;
begin
  v_game := game_internal.lock_game(p_game_id);

  if v_game.status not in ('waiting', 'dealing') then
    raise exception 'invalid_state';
  end if;

  select count(*), max(seat) into v_n, v_max
    from public.game_players where game_id = p_game_id;
  if v_n < 2 or v_n > 4 or v_max <> v_n - 1 then
    raise exception 'invalid_players';
  end if;

  update public.games set status = 'dealing' where id = p_game_id;

  -- 1. Las 60 fichas, boca abajo, en la reserva.
  insert into public.game_tiles (game_id, number, place)
  select p_game_id, td.number, 'reserve' from public.tile_definitions td;

  -- 2. Cada jugador recibe una ficha de cada color, al azar y sin repetir entre jugadores.
  --    Las fichas elegidas pasan a su soporte, ordenadas de menor a mayor número.
  for v_player in
    select id from public.game_players where game_id = p_game_id order by seat
  loop
    v_picked := '{}';
    for v_color in 0..4 loop
      select gt.number into v_num
        from public.game_tiles gt
        join public.tile_definitions td on td.number = gt.number
       where gt.game_id = p_game_id
         and gt.place = 'reserve'
         and td.color_index = v_color
       order by random()
       limit 1;
      v_picked := v_picked || v_num;
    end loop;

    select array_agg(x order by x) into v_picked from unnest(v_picked) as x;

    for v_i in 1..5 loop
      update public.game_tiles
         set place = 'support', owner_id = v_player.id, slot = v_i - 1
       where game_id = p_game_id and number = v_picked[v_i];
    end loop;
  end loop;

  -- 3. Mazo visible: una ficha de la reserva de cada color.
  for v_color in 0..4 loop
    update public.game_tiles
       set place = 'pool'
     where id = (
       select gt.id
         from public.game_tiles gt
         join public.tile_definitions td on td.number = gt.number
        where gt.game_id = p_game_id
          and gt.place = 'reserve'
          and td.color_index = v_color
        order by random()
        limit 1
     );
  end loop;

  -- 4. Arranca la partida.
  update public.games
     set status        = 'active',
         current_seat  = 0,
         phase         = 'reveal',
         revealed_tile = null,
         turn_deadline = now() + interval '60 seconds',
         started_at    = now()
   where id = p_game_id;

  -- 5. Evento público: solo cuántos jugadores hay.
  perform game_internal.emit_event(
    p_game_id, 'game_started', null, jsonb_build_object('players', v_n)
  );
end;
$$;
