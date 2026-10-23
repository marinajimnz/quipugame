-- T041: candidatos del bot.
--
-- bot_candidates recibe el JSON de game_internal.state_for_player (la vista de un jugador) y
-- NUNCA lee game_tiles: solo usa información pública. Un test comprueba que ninguna función
-- bot_* menciona game_tiles.
--
-- Cada número 1..60 es un bit de un bigint (bit n-1), lo que hace baratas las intersecciones.

create function game_internal.bot_mask_lt(p_n int)
returns bigint language sql immutable set search_path = ''
as $$ select (1::bigint << (p_n - 1)) - 1 $$;               -- números 1 .. n-1

create function game_internal.bot_mask_gt(p_n int)
returns bigint language sql immutable set search_path = ''
as $$ select ((1::bigint << 60) - 1) & ~((1::bigint << p_n) - 1) $$;   -- números n+1 .. 60

create function game_internal.bot_lowest(p_mask bigint)
returns int language plpgsql immutable set search_path = ''
as $$
declare n int;
begin
  for n in 1..60 loop
    if (p_mask >> (n - 1)) & 1 = 1 then return n; end if;
  end loop;
  return null;
end;
$$;

create function game_internal.bot_highest(p_mask bigint)
returns int language plpgsql immutable set search_path = ''
as $$
declare n int;
begin
  for n in reverse 60..1 loop
    if (p_mask >> (n - 1)) & 1 = 1 then return n; end if;
  end loop;
  return null;
end;
$$;

-- Para cada una de mis 5 posiciones: los números que todavía pueden ser. Devuelve
-- [[n, n, …], …] (5 listas ordenadas) o null si el estado no tiene mi soporte.
create function game_internal.bot_candidates(p_state jsonb)
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
  v_tile    int;
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

  -- 3. Las respuestas a MIS pistas.
  for v_clue in
    select c ->> 'kind' as kind,
           (c ->> 'tile_number')::int as tile,
           (c ->> 'target_slot')::int as target_slot,
           (c ->> 'answer_position')::int as answer_position,
           (c ->> 'answer_same')::boolean as answer_same
      from jsonb_array_elements(p_state -> 'clues') c
     where c ->> 'asker_id' = v_me
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

  -- 4. Orden ascendente: propagar hasta que no cambie nada.
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
    exit when not v_changed;
  end loop;

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

-- Total de candidatos (suma de las 5 listas): la medida de incertidumbre del bot.
create function game_internal.bot_total_candidates(p_candidates jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(jsonb_array_length(l)), 0)::int from jsonb_array_elements(p_candidates) l
$$;
