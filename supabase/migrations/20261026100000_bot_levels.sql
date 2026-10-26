-- Balance de los niveles del bot. Antes los tres niveles compartían un solucionador perfecto
-- (hard era idéntico a normal) y normal declaraba en el mismo instante en que tenía certeza.
--
-- Ahora la dificultad degrada al bot como a una persona, sin volverlo aleatorio:
--
--                     easy                    normal                      hard
--   deducción         una pasada del orden;   completa; ignora ~12 %     completa
--                     ignora el 20 % de       de sus pistas
--                     sus pistas
--   pista             al azar                 una de las 4 mejores        la mejor (peor caso,
--                                                                         luego caso medio)
--   declarar          solo con certeza total, tras una espera aleatoria (se tira un dado en
--                     cada ejecución de la tarea, que corre cada segundo)
--                     2 %/s (≈50 s)           6 %/s (≈17 s)               al instante
--
--   Turnos propios hasta ganar (simulación, bots entre sí): easy ≈17, normal ≈9, hard ≈5.
--
-- Ignorar una pista solo ensancha los candidatos, así que ningún nivel declara mal: los fallos
-- vienen de saber menos y de tardar más, no de apostar.

-- Número 1..99 estable para (jugador, ficha de la pista): la misma pista se ignora siempre o
-- nunca, así el bot no "recuerda" una pista en una ejecución y la olvida en la siguiente.
create or replace function game_internal.bot_ignores_clue(p_player text, p_tile int, p_difficulty text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (abs(hashtext(p_player || ':' || p_tile::text)) % 100) <
         case p_difficulty when 'easy' then 20 when 'normal' then 12 else 0 end
$$;

-- Probabilidad de declarar en cada ejecución de la tarea cuando ya tiene certeza.
create or replace function game_internal.bot_declare_chance(p_difficulty text)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case p_difficulty when 'easy' then 0.02 when 'normal' then 0.06 else 1.0 end
$$;

drop function if exists game_internal.bot_candidates(jsonb);

create or replace function game_internal.bot_candidates(p_state jsonb, p_difficulty text default 'hard')
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_masks   bigint[] := array[0, 0, 0, 0, 0]::bigint[];
  v_known   bigint := 0;
  v_me      text := p_state -> 'me' ->> 'player_id';
  v_slot    record;
  v_clue    record;
  v_n       int;
  v_m       bigint;
  v_pm      bigint;
  v_pts     int;
  v_changed boolean;
  v_new     bigint;
  v_lo      int;
  v_hi      int;
  i         int;
  v_out     jsonb := '[]'::jsonb;
  v_list    jsonb;
begin
  if jsonb_array_length(p_state -> 'me' -> 'support') <> 5 then
    return null;
  end if;

  -- 1. El color de cada posición es público: solo valen los números de ese color.
  for v_slot in
    select (s ->> 'slot')::int as slot, (s ->> 'color_index')::int as color
      from jsonb_array_elements(p_state -> 'me' -> 'support') s
  loop
    v_m := 0;
    for v_n in 1..60 loop
      if (v_n - 1) % 5 = v_slot.color then v_m := v_m | (1::bigint << (v_n - 1)); end if;
    end loop;
    v_masks[v_slot.slot + 1] := v_m;
  end loop;

  -- 2. Los números que se ven en otro sitio no son míos: soportes ajenos, mazo y fichas gastadas.
  for v_n in
    select (t ->> 'number')::int
      from jsonb_array_elements(p_state -> 'players') p,
           jsonb_array_elements(p -> 'support') t
  loop v_known := v_known | (1::bigint << (v_n - 1)); end loop;

  for v_n in select (t ->> 'number')::int from jsonb_array_elements(p_state -> 'pool') t
  loop v_known := v_known | (1::bigint << (v_n - 1)); end loop;

  for v_n in select (c ->> 'tile_number')::int from jsonb_array_elements(p_state -> 'clues') c
  loop v_known := v_known | (1::bigint << (v_n - 1)); end loop;

  for i in 1..5 loop v_masks[i] := v_masks[i] & ~v_known; end loop;

  -- 3. Las respuestas a MIS pistas (salvo las que este nivel "olvida").
  for v_clue in
    select c ->> 'kind' as kind,
           (c ->> 'tile_number')::int as tile,
           (c ->> 'target_slot')::int as target_slot,
           (c ->> 'answer_position')::int as answer_position,
           (c ->> 'answer_same')::boolean as answer_same
      from jsonb_array_elements(p_state -> 'clues') c
     where c ->> 'asker_id' = v_me
       and not game_internal.bot_ignores_clue(v_me, (c ->> 'tile_number')::int, p_difficulty)
  loop
    if v_clue.kind = 'classify' then
      -- Exactamente answer_position de mis fichas son menores que la de la pista.
      for i in 1..5 loop
        if i - 1 < v_clue.answer_position then
          v_masks[i] := v_masks[i] & game_internal.bot_mask_lt(v_clue.tile);
        else
          v_masks[i] := v_masks[i] & game_internal.bot_mask_gt(v_clue.tile);
        end if;
      end loop;
    else
      select points into v_pts from public.tile_definitions where number = v_clue.tile;
      select coalesce(bit_or(1::bigint << (number - 1)), 0) into v_pm
        from public.tile_definitions where points = v_pts;
      i := v_clue.target_slot + 1;
      if v_clue.answer_same then
        v_masks[i] := v_masks[i] & v_pm;
      else
        v_masks[i] := v_masks[i] & ~v_pm;
      end if;
    end if;
  end loop;

  -- 4. Orden ascendente: easy hace una sola pasada; normal y hard propagan hasta el final.
  if true then
    loop
      v_changed := false;
      for i in 2..5 loop
        v_lo := game_internal.bot_lowest(v_masks[i - 1]);
        if v_lo is not null then
          v_new := v_masks[i] & game_internal.bot_mask_gt(v_lo);
          if v_new <> v_masks[i] then v_masks[i] := v_new; v_changed := true; end if;
        end if;
      end loop;
      for i in 1..4 loop
        v_hi := game_internal.bot_highest(v_masks[i + 1]);
        if v_hi is not null then
          v_new := v_masks[i] & game_internal.bot_mask_lt(v_hi);
          if v_new <> v_masks[i] then v_masks[i] := v_new; v_changed := true; end if;
        end if;
      end loop;
      exit when not v_changed or p_difficulty = 'easy';
    end loop;
  end if;

  for i in 1..5 loop
    v_list := '[]'::jsonb;
    for v_n in 1..60 loop
      if (v_masks[i] >> (v_n - 1)) & 1 = 1 then v_list := v_list || to_jsonb(v_n); end if;
    end loop;
    v_out := v_out || jsonb_build_array(v_list);
  end loop;
  return v_out;
end;
$$;

-- Color a revelar: easy al azar; normal y hard, el de la posición con más incertidumbre.
create or replace function game_internal.bot_choose_color(p_state jsonb, p_difficulty text)
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
    v_cands := game_internal.bot_candidates(p_state, p_difficulty);
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

-- Pista a pedir: devuelve { tile, kind, slot }. Las opciones se puntúan con la deducción
-- completa ('hard'); lo que cambia por nivel es cuánto se esfuerza en elegir la mejor.
create or replace function game_internal.bot_choose_clue(p_state jsonb, p_difficulty text)
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
  v_answer  int;
  v_cands   jsonb;
  v_worst   int;
  v_sum     int;
  v_count   int;
  v_valid   boolean;
  v_scored  jsonb := '[]'::jsonb;
  v_ties    jsonb;
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

  for o in select * from jsonb_array_elements(v_opts) loop
    v_worst := 0;
    v_sum := 0;
    v_count := 0;
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
          v_total := game_internal.bot_total_candidates(v_cands);
          v_worst := greatest(v_worst, v_total);
          v_sum := v_sum + v_total;
          v_count := v_count + 1;
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
          v_total := game_internal.bot_total_candidates(v_cands);
          v_worst := greatest(v_worst, v_total);
          v_sum := v_sum + v_total;
          v_count := v_count + 1;
        end if;
      end loop;
    end if;

    if v_valid then
      v_scored := v_scored || jsonb_build_object('opt', o, 'worst', v_worst, 'avg', v_sum::numeric / v_count);
    end if;
  end loop;

  if jsonb_array_length(v_scored) = 0 then
    return v_opts -> floor(random() * jsonb_array_length(v_opts))::int;
  end if;

  -- hard: la mejor (empates exactos al azar). normal: una de las 4 mejores.
  select jsonb_agg(opt) into v_ties
    from (
      select s -> 'opt' as opt,
             rank() over (order by (s ->> 'worst')::int, (s ->> 'avg')::numeric) as r
        from jsonb_array_elements(v_scored) s
    ) ranked
   where r <= case when p_difficulty = 'hard' then 1 else 4 end;
  return v_ties -> floor(random() * jsonb_array_length(v_ties))::int;
end;
$$;

-- ¿Declara ahora? Devuelve los 5 números o null. Solo con certeza total, y después de tirar el
-- dado de espera de su nivel.
create or replace function game_internal.bot_declaration(p_state jsonb, p_difficulty text)
returns smallint[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_cands jsonb;
  v_out   smallint[] := '{}';
  i       int;
begin
  if p_state is null
     or p_state -> 'game' ->> 'status' <> 'active'
     or p_state -> 'me' ->> 'state' <> 'active'
     or (p_state -> 'me' ->> 'has_declared')::boolean then
    return null;
  end if;

  v_cands := game_internal.bot_candidates(p_state, p_difficulty);
  if v_cands is null then return null; end if;

  for i in 0..4 loop
    if jsonb_array_length(v_cands -> i) <> 1 then return null; end if;
  end loop;

  if random() >= game_internal.bot_declare_chance(p_difficulty) then return null; end if;

  for i in 0..4 loop
    v_out := v_out || (v_cands -> i ->> 0)::smallint;
  end loop;
  return v_out;
end;
$$;

-- La simulación llama a bot_try_declare varias veces por turno para imitar a la tarea real,
-- que corre cada segundo mientras un bot espera 2–6 s para jugar.
create or replace function game_internal.simulate_bot_game(p_difficulties text[])
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
  t         int;
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
      for t in 1..5 loop
        v_res := game_internal.bot_try_declare(v_game, v_ids[i]);
        if v_res is not null and not v_res then
          v_wrong := jsonb_set(v_wrong, array[p_difficulties[i]],
                               to_jsonb(coalesce((v_wrong ->> p_difficulties[i])::int, 0) + 1));
        end if;
        exit when v_res is not null;
      end loop;
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
