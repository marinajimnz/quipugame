-- T042: decisiones y turnos del bot. Dificultades:
--   easy   : pista al azar; declara cuando le quedan ≤ 2 candidatos por posición (puede fallar).
--   normal : la pista que más reduce los candidatos en el peor caso; declara solo con certeza.
--   hard   : por ahora juega como normal (T086 lo mejorará).
--
-- Los bots juegan con las MISMAS funciones que un humano (reveal_tile_as, ask_clue_as,
-- declare_code_as) y solo ven lo que ve un humano (state_for_player).

-- Color a revelar.
create function game_internal.bot_choose_color(p_state jsonb, p_difficulty text)
returns smallint
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_reserve jsonb := p_state -> 'game' -> 'reserve_by_color';
  v_avail   int[] := '{}';
  v_cands   jsonb;
  v_best    int;
  v_best_n  int := -1;
  v_slot    int;
  v_color   int;
  v_n       int;
  i         int;
begin
  for i in 0..4 loop
    if (v_reserve ->> i)::int > 0 then v_avail := v_avail || i; end if;
  end loop;
  if coalesce(array_length(v_avail, 1), 0) = 0 then
    return 0; -- reserva vacía: el motor omite la revelación
  end if;

  if p_difficulty <> 'easy' then
    -- Revela el color de la posición con más incertidumbre, si queda de ese color.
    v_cands := game_internal.bot_candidates(p_state);
    if v_cands is not null then
      for v_slot in 0..4 loop
        v_color := (p_state -> 'me' -> 'support' -> v_slot ->> 'color_index')::int;
        v_n := jsonb_array_length(v_cands -> v_slot);
        if v_color = any (v_avail) and v_n > v_best_n then
          v_best := v_color;
          v_best_n := v_n;
        end if;
      end loop;
      if v_best is not null then return v_best; end if;
    end if;
  end if;

  return v_avail[1 + floor(random() * array_length(v_avail, 1))::int];
end;
$$;

-- Pista a pedir: devuelve { tile, kind, slot }.
create function game_internal.bot_choose_clue(p_state jsonb, p_difficulty text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_me      text := p_state -> 'me' ->> 'player_id';
  v_tiles   int[];
  v_opts    jsonb := '[]'::jsonb;
  v_tile    int;
  v_slot    int;
  v_kind    text;
  v_answer  int;
  v_cands   jsonb;
  v_worst   int;
  v_valid   boolean;
  v_scored  jsonb := '[]'::jsonb;
  v_best    int := null;
  v_ties    jsonb := '[]'::jsonb;
  v_hypo    jsonb;
  v_ok      boolean;
  v_total   int;
  o         jsonb;
begin
  select array_agg((t ->> 'number')::int) into v_tiles from jsonb_array_elements(p_state -> 'pool') t;
  if v_tiles is null then raise exception 'bot_no_pool'; end if;

  foreach v_tile in array v_tiles loop
    v_opts := v_opts || jsonb_build_object('tile', v_tile, 'kind', 'classify', 'slot', null);
    for v_slot in 0..4 loop
      v_opts := v_opts || jsonb_build_object('tile', v_tile, 'kind', 'compare', 'slot', v_slot);
    end loop;
  end loop;

  if p_difficulty = 'easy' then
    return v_opts -> floor(random() * jsonb_array_length(v_opts))::int;
  end if;

  -- normal / hard: minimizar los candidatos que quedan en el peor caso.
  for o in select * from jsonb_array_elements(v_opts) loop
    v_worst := 0;
    v_valid := false;

    if o ->> 'kind' = 'classify' then
      for v_answer in 0..5 loop
        v_hypo := jsonb_set(p_state, '{clues}', (p_state -> 'clues') || jsonb_build_array(
          jsonb_build_object('asker_id', v_me, 'tile_number', (o ->> 'tile')::int, 'kind', 'classify',
                             'target_slot', null, 'answer_position', v_answer, 'answer_same', null)));
        v_cands := game_internal.bot_candidates(v_hypo);
        -- Una respuesta que deja una posición sin candidatos es imposible: no cuenta.
        select bool_and(jsonb_array_length(l) > 0) into v_ok from jsonb_array_elements(v_cands) l;
        if v_ok then
          v_valid := true;
          v_worst := greatest(v_worst, game_internal.bot_total_candidates(v_cands));
        end if;
      end loop;
    else
      for v_ok in select * from (values (true), (false)) as x(b) loop
        v_hypo := jsonb_set(p_state, '{clues}', (p_state -> 'clues') || jsonb_build_array(
          jsonb_build_object('asker_id', v_me, 'tile_number', (o ->> 'tile')::int, 'kind', 'compare',
                             'target_slot', (o ->> 'slot')::int, 'answer_position', null, 'answer_same', v_ok)));
        v_cands := game_internal.bot_candidates(v_hypo);
        if (select bool_and(jsonb_array_length(l) > 0) from jsonb_array_elements(v_cands) l) then
          v_valid := true;
          v_worst := greatest(v_worst, game_internal.bot_total_candidates(v_cands));
        end if;
      end loop;
    end if;

    if v_valid then
      v_scored := v_scored || jsonb_build_object('opt', o, 'worst', v_worst);
    end if;
  end loop;

  if jsonb_array_length(v_scored) = 0 then
    return v_opts -> floor(random() * jsonb_array_length(v_opts))::int;
  end if;

  select min((s ->> 'worst')::int) into v_best from jsonb_array_elements(v_scored) s;
  select jsonb_agg(s -> 'opt') into v_ties from jsonb_array_elements(v_scored) s where (s ->> 'worst')::int = v_best;
  return v_ties -> floor(random() * jsonb_array_length(v_ties))::int;
end;
$$;

-- ¿Declara ahora? Devuelve los 5 números o null.
create function game_internal.bot_declaration(p_state jsonb, p_difficulty text)
returns smallint[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_cands jsonb;
  v_out   smallint[] := '{}';
  v_prev  int := 0;
  v_opts  int[];
  v_pick  int;
  i       int;
begin
  if p_state is null
     or p_state -> 'game' ->> 'status' <> 'active'
     or p_state -> 'me' ->> 'state' <> 'active'
     or (p_state -> 'me' ->> 'has_declared')::boolean then
    return null;
  end if;

  v_cands := game_internal.bot_candidates(p_state);
  if v_cands is null then return null; end if;

  for i in 0..4 loop
    if jsonb_array_length(v_cands -> i) = 0 then return null; end if;
    if p_difficulty = 'easy' then
      if jsonb_array_length(v_cands -> i) > 2 then return null; end if;
    elsif jsonb_array_length(v_cands -> i) <> 1 then
      return null;
    end if;
  end loop;

  for i in 0..4 loop
    select array_agg(x::int order by x::int) into v_opts
      from jsonb_array_elements_text(v_cands -> i) x
     where x::int > v_prev;
    if v_opts is null then return null; end if;
    v_pick := case when p_difficulty = 'easy'
                   then v_opts[1 + floor(random() * array_length(v_opts, 1))::int]
                   else v_opts[1] end;
    v_out := v_out || v_pick::smallint;
    v_prev := v_pick;
  end loop;
  return v_out;
end;
$$;

-- Si es su turno, el bot lo juega entero (revelar + pista). Devuelve true si jugó.
create function game_internal.bot_take_turn(p_game_id uuid, p_player_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_state jsonb;
  v_diff  text;
  v_color smallint;
  v_clue  jsonb;
begin
  select bot_difficulty into v_diff from public.game_players
   where id = p_player_id and game_id = p_game_id and is_bot;
  if v_diff is null then return false; end if;

  v_state := game_internal.state_for_player(p_game_id, p_player_id);
  if v_state is null
     or v_state -> 'game' ->> 'status' <> 'active'
     or v_state -> 'me' ->> 'state' <> 'active'
     or (v_state -> 'game' ->> 'current_seat')::int <> (v_state -> 'me' ->> 'seat')::int then
    return false;
  end if;

  if v_state -> 'game' ->> 'phase' = 'reveal' then
    v_color := game_internal.bot_choose_color(v_state, v_diff);
    perform game_internal.reveal_tile_as(p_game_id, p_player_id, v_color);
    v_state := game_internal.state_for_player(p_game_id, p_player_id);
  end if;

  v_clue := game_internal.bot_choose_clue(v_state, v_diff);
  perform game_internal.ask_clue_as(
    p_game_id, p_player_id,
    (v_clue ->> 'tile')::smallint,
    (v_clue ->> 'kind')::public.clue_kind,
    (v_clue ->> 'slot')::smallint
  );
  return true;
end;
$$;

-- Declara si el bot quiere. Devuelve null si no declaró, o si acertó.
create function game_internal.bot_try_declare(p_game_id uuid, p_player_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_diff    text;
  v_numbers smallint[];
begin
  select bot_difficulty into v_diff from public.game_players
   where id = p_player_id and game_id = p_game_id and is_bot;
  if v_diff is null then return null; end if;

  v_numbers := game_internal.bot_declaration(game_internal.state_for_player(p_game_id, p_player_id), v_diff);
  if v_numbers is null then return null; end if;

  return game_internal.declare_code_as(p_game_id, p_player_id, v_numbers);
end;
$$;

-- Simula una partida entera entre bots (sin humanos) y la borra al terminar.
-- Sirve para probar el motor y los bots; no la llama ningún cliente.
create function game_internal.simulate_bot_game(p_difficulties text[])
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_game    uuid := gen_random_uuid();
  v_ids     uuid[] := '{}';
  v_id      uuid;
  v_n       int := array_length(p_difficulties, 1);
  v_g       public.games;
  v_turns   int := 0;
  v_guard   int := 0;
  v_res     boolean;
  v_wrong   jsonb := '{}'::jsonb;
  v_diff    text;
  v_winner  text;
  i         int;
begin
  insert into public.games (id, mode, status) values (v_game, 'private', 'waiting');
  for i in 1..v_n loop
    v_id := gen_random_uuid();
    insert into public.game_players (id, game_id, seat, is_bot, bot_difficulty)
    values (v_id, v_game, i - 1, true, p_difficulties[i]);
    v_ids := v_ids || v_id;
  end loop;
  perform game_internal.deal_game(v_game);

  loop
    v_guard := v_guard + 1;
    exit when v_guard > 600;
    select * into v_g from public.games where id = v_game;
    exit when v_g.status <> 'active';

    -- Los bots pueden declarar en cualquier momento.
    for i in 1..v_n loop
      v_res := game_internal.bot_try_declare(v_game, v_ids[i]);
      if v_res is not null and not v_res then
        v_wrong := jsonb_set(v_wrong, array[p_difficulties[i]],
                             to_jsonb(coalesce((v_wrong ->> p_difficulties[i])::int, 0) + 1));
      end if;
      select * into v_g from public.games where id = v_game;
      exit when v_g.status <> 'active';
    end loop;
    exit when v_g.status <> 'active';

    if game_internal.bot_take_turn(v_game, v_ids[v_g.current_seat + 1]) then
      v_turns := v_turns + 1;
    end if;
  end loop;

  select * into v_g from public.games where id = v_game;
  select bot_difficulty into v_diff from public.game_players where id = v_g.winner_player_id;
  v_winner := v_diff;

  delete from public.games where id = v_game;

  return jsonb_build_object(
    'status', v_g.status, 'turns', v_turns, 'winner', v_winner,
    'wrong_declarations', v_wrong, 'guard', v_guard
  );
end;
$$;
