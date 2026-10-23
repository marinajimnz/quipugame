-- T060 + T061 + T062 + T064: turnos agotados, salas caducadas, presencia y partida en curso.

-- ---------------------------------------------------------------------------------------
-- T060. Turno agotado: el servidor juega por el jugador (60 s por turno, spec §4.6).
--   fase revelar -> revela un color al azar y clasifica esa ficha;
--   fase pista   -> clasifica la ficha que reveló (o una del mazo si la reserva estaba vacía);
--   al tercer turno agotado seguido, el jugador abandona (queda eliminado).
-- Los bots no se agotan: los juega play_bot_turns. Una acción manual pone timeouts a 0.
-- ---------------------------------------------------------------------------------------
create function game_internal.tick_timeouts()
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
    select id from public.games where status = 'active' and turn_deadline < now()
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

-- ---------------------------------------------------------------------------------------
-- T061. Las salas sin iniciar caducan a los 30 minutos.
-- ---------------------------------------------------------------------------------------
create function game_internal.expire_rooms()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_n int;
begin
  if not pg_try_advisory_xact_lock(hashtext('quipu.expire_rooms')) then
    return 0;
  end if;

  update public.rooms set status = 'expired'
   where status = 'open' and expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- T062. Presencia: el cliente avisa cada 15 s; el resto ve "desconectado" a los 30 s.
-- No cambia el estado de la partida, así que no necesita bloquearla.
-- ---------------------------------------------------------------------------------------
create function public.touch_presence(p_game_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.game_players
     set last_seen_at = now()
   where game_id = p_game_id
     and profile_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------------------
-- T064. La partida en la que sigo jugando, para volver a ella al abrir la app.
-- ---------------------------------------------------------------------------------------
create function public.get_my_active_game()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id
    from public.games g
    join public.game_players gp on gp.game_id = g.id
   where gp.profile_id = (select auth.uid())
     and gp.state = 'active'
     and g.status = 'active'
   order by g.started_at desc nulls last
   limit 1;
$$;

revoke execute on function public.touch_presence(uuid) from public, anon;
grant  execute on function public.touch_presence(uuid) to authenticated;

revoke execute on function public.get_my_active_game() from public, anon;
grant  execute on function public.get_my_active_game() to authenticated;
