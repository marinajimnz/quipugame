-- Hito 7: cola de emparejamiento (T070, T071), ELO (T072) y clasificación (T075).
-- En el MVP las clasificatorias son de 2 jugadores (spec HU-3).

-- Ventana de ELO según la espera: ±50, +25 cada 10 s, como mucho ±400 (spec §8).
create function game_internal.queue_window(p_wait_seconds numeric)
returns int
language sql
immutable
set search_path = ''
as $$
  select least(400, 50 + 25 * floor(greatest(p_wait_seconds, 0) / 10))::int
$$;

-- ---------------------------------------------------------------------------------------
-- T070. Entrar y salir de la cola. Los invitados no juegan clasificatorias (spec HU-1).
-- ---------------------------------------------------------------------------------------
create function public.join_queue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_profile public.profiles;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'no_profile'; end if;
  if v_profile.is_guest then raise exception 'guest_not_allowed'; end if;

  if exists (select 1 from public.matchmaking_queue where profile_id = v_user) then
    raise exception 'already_in_queue';
  end if;
  if exists (
    select 1 from public.game_players gp join public.games g on g.id = gp.game_id
     where gp.profile_id = v_user and gp.state = 'active' and g.status = 'active'
  ) then
    raise exception 'already_in_game';
  end if;

  insert into public.matchmaking_queue (profile_id, elo) values (v_user, v_profile.elo);
end;
$$;

create function public.leave_queue()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.matchmaking_queue where profile_id = (select auth.uid());
$$;

-- Lo que la pantalla de cola necesita: si estoy, desde cuándo y qué rango se busca.
create function public.get_queue_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'in_queue',    q.profile_id is not null,
    'joined_at',   q.joined_at,
    'elo',         q.elo,
    'window',      case when q.profile_id is null then null
                        else game_internal.queue_window(extract(epoch from now() - q.joined_at)) end,
    'server_time', now()
  )
  from (select 1) as x
  left join public.matchmaking_queue q on q.profile_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------------------
-- T071. Emparejamiento (pg_cron cada 3 s). Recorre la cola por antigüedad y empareja al más
-- antiguo con el rival de ELO más cercano dentro de SU ventana actual.
-- ---------------------------------------------------------------------------------------
create function game_internal.resolve_matchmaking()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_a      record;
  v_b      record;
  v_window int;
  v_paired uuid[] := '{}';
  v_game   uuid;
  v_first  int;
  v_n      int := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('quipu.resolve_matchmaking')) then
    return 0;
  end if;

  -- Limpieza: quien ya está en una partida activa no puede seguir en la cola.
  delete from public.matchmaking_queue q
   where exists (
     select 1 from public.game_players gp join public.games g on g.id = gp.game_id
      where gp.profile_id = q.profile_id and gp.state = 'active' and g.status = 'active'
   );

  for v_a in
    select * from public.matchmaking_queue order by joined_at for update
  loop
    continue when v_a.profile_id = any (v_paired);

    v_window := game_internal.queue_window(extract(epoch from now() - v_a.joined_at));

    select * into v_b
      from public.matchmaking_queue q
     where q.profile_id <> v_a.profile_id
       and not (q.profile_id = any (v_paired))
       and abs(q.elo - v_a.elo) <= v_window
     order by abs(q.elo - v_a.elo), q.joined_at
     limit 1;
    continue when not found;

    v_game := gen_random_uuid();
    v_first := floor(random() * 2)::int; -- quién empieza, al azar
    insert into public.games (id, mode, status) values (v_game, 'ranked', 'waiting');
    insert into public.game_players (game_id, profile_id, seat)
    values (v_game, v_a.profile_id, v_first), (v_game, v_b.profile_id, 1 - v_first);
    perform game_internal.deal_game(v_game);

    delete from public.matchmaking_queue where profile_id in (v_a.profile_id, v_b.profile_id);
    v_paired := v_paired || v_a.profile_id || v_b.profile_id;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- T072. ELO (spec §10). Lo llama finish_game al cerrar una clasificatoria, con la partida
-- bloqueada. Idempotente por games.elo_applied_at.
--   E = 1 / (1 + 10^((elo_rival − elo) / 400))
--   K = 32 con menos de 20 clasificatorias; si no, 24 por debajo de 2000 y 16 desde 2000
--   Δ = round(K × (S − E)); el ELO nunca baja de 100. Empate técnico: S = 0,5.
--   Abandonar cuenta como derrota: el otro queda como ganador.
-- ---------------------------------------------------------------------------------------
create function game_internal.apply_elo(p_game_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game     public.games;
  v_ids      uuid[];
  v_profiles uuid[];
  v_elo      int[] := '{}';
  v_games    int[] := '{}';
  v_s        numeric;
  v_e        numeric;
  v_k        int;
  v_after    int;
  v_rival    int;
  v_tmp      record;
  i          int;
begin
  select * into v_game from public.games where id = p_game_id;
  if v_game.mode <> 'ranked' or v_game.elo_applied_at is not null then
    return;
  end if;

  select array_agg(gp.id order by gp.seat), array_agg(gp.profile_id order by gp.seat)
    into v_ids, v_profiles
    from public.game_players gp
   where gp.game_id = p_game_id and gp.profile_id is not null;

  if coalesce(array_length(v_profiles, 1), 0) <> 2 then
    update public.games set elo_applied_at = now() where id = p_game_id;
    return;
  end if;

  -- ELO de antes de la partida, para los dos cálculos.
  for i in 1..2 loop
    select elo, ranked_games into v_tmp from public.profiles where id = v_profiles[i] for update;
    v_elo := v_elo || v_tmp.elo;
    v_games := v_games || v_tmp.ranked_games;
  end loop;

  for i in 1..2 loop
    v_rival := v_elo[3 - i];
    v_s := case
             when v_game.winner_player_id is null then 0.5
             when v_game.winner_player_id = v_ids[i] then 1
             else 0
           end;
    v_e := 1 / (1 + power(10::numeric, (v_rival - v_elo[i]) / 400.0));
    v_k := case when v_games[i] < 20 then 32 when v_elo[i] < 2000 then 24 else 16 end;
    v_after := greatest(100, v_elo[i] + round(v_k * (v_s - v_e))::int);

    insert into public.elo_history (game_id, profile_id, elo_before, elo_after, delta, k_factor)
    values (p_game_id, v_profiles[i], v_elo[i], v_after, v_after - v_elo[i], v_k);

    update public.profiles
       set elo = v_after,
           ranked_games = ranked_games + 1,
           ranked_wins = ranked_wins + (case when v_s = 1 then 1 else 0 end)
     where id = v_profiles[i];
  end loop;

  update public.games set elo_applied_at = now() where id = p_game_id;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- T075. Clasificación: los 100 mejores por ELO con al menos 5 clasificatorias, y mi posición.
-- ---------------------------------------------------------------------------------------
create function public.get_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select p.id, p.display_name::text as display_name, p.avatar_key, p.elo, p.ranked_games,
           rank() over (order by p.elo desc) as rank
      from public.profiles p
     where p.ranked_games >= 5
  )
  select jsonb_build_object(
    'top', coalesce(
      (select jsonb_agg(to_jsonb(r) order by r.rank, r.ranked_games desc, r.id)
         from (select * from ranked order by rank, ranked_games desc, id limit 100) r),
      '[]'::jsonb),
    'me', (select to_jsonb(r) from ranked r where r.id = (select auth.uid()))
  );
$$;

revoke execute on function public.join_queue() from public, anon;
revoke execute on function public.leave_queue() from public, anon;
revoke execute on function public.get_queue_status() from public, anon;
revoke execute on function public.get_leaderboard() from public, anon;
grant  execute on function public.join_queue() to authenticated;
grant  execute on function public.leave_queue() to authenticated;
grant  execute on function public.get_queue_status() to authenticated;
grant  execute on function public.get_leaderboard() to authenticated;
