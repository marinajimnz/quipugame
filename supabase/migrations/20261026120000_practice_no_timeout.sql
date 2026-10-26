-- Las partidas de práctica (contra bots) no tienen límite de tiempo: el servidor no juega por ti
-- ni te abandona por turnos agotados. turn_deadline se sigue rellenando porque play_bot_turns
-- lo usa para espaciar los turnos de los bots, pero la pantalla no lo muestra en práctica.
-- Empezar otra práctica abandona la anterior (start_practice_game), así que no se acumulan.

create or replace function game_internal.tick_timeouts()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_game  record;
  v_g     public.games;
  v_p     public.game_players;
  v_color smallint;
  v_tile  smallint;
  v_prior smallint;
  v_done  int := 0;
begin
  -- Si otra ejecución sigue en marcha, no hacer nada.
  if not pg_try_advisory_xact_lock(hashtext('quipu.tick_timeouts')) then
    return 0;
  end if;

  for v_game in
    select id from public.games
     where status = 'active' and mode <> 'practice' and turn_deadline < now()
  loop
    begin
      v_g := game_internal.lock_game(v_game.id);

      -- Tras el bloqueo, volver a comprobar: puede que el jugador acabe de jugar.
      if v_g.status <> 'active' or v_g.turn_deadline is null or v_g.turn_deadline >= now() then
        continue;
      end if;

      select * into v_p from public.game_players
       where game_id = v_g.id and seat = v_g.current_seat and state = 'active';
      if not found or v_p.is_bot then
        continue;
      end if;

      v_prior := v_p.timeouts;
      perform game_internal.emit_event(
        v_g.id, 'turn_timeout', v_p.id, jsonb_build_object('consecutive', v_prior + 1)
      );

      if v_prior + 1 >= 3 then
        perform game_internal.abandon_as(v_g.id, v_p.id);
      else
        if v_g.phase = 'reveal' then
          select td.color_index into v_color
            from public.game_tiles gt
            join public.tile_definitions td on td.number = gt.number
           where gt.game_id = v_g.id and gt.place = 'reserve'
           group by td.color_index
           order by random()
           limit 1;
          -- Reserva vacía: el motor omite la revelación, el color da igual.
          perform game_internal.reveal_tile_as(v_g.id, v_p.id, coalesce(v_color, 0)::smallint);
          select * into v_g from public.games where id = v_g.id;
        end if;

        v_tile := v_g.revealed_tile;
        if v_tile is null then
          select number into v_tile from public.game_tiles
           where game_id = v_g.id and place = 'pool' order by random() limit 1;
        end if;

        perform game_internal.ask_clue_as(v_g.id, v_p.id, v_tile, 'classify', null);
        update public.game_players set timeouts = v_prior + 1 where id = v_p.id;
      end if;

      v_done := v_done + 1;
    exception when others then
      raise warning 'tick_timeouts: partida %: %', v_game.id, sqlerrm;
    end;
  end loop;

  return v_done;
end;
$$;
