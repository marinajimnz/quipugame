-- Los demás jugadores del estado incluyen is_guest (cuenta de invitado o cuenta con correo),
-- para que la partida muestre «Invitado» / «Verificado» junto a cada rival humano.
-- Es un dato que ya ve cualquiera en el perfil público; no revela nada de la partida.

create or replace function game_internal.state_for_player(p_game_id uuid, p_player_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with g as (
    select * from public.games where id = p_game_id
  ),
  me as (
    select * from public.game_players where id = p_player_id and game_id = p_game_id
  )
  select jsonb_build_object(
    'game', jsonb_build_object(
      'status',           g.status,
      'mode',             g.mode,
      'phase',            g.phase,
      'current_seat',     g.current_seat,
      'turn_deadline',    g.turn_deadline,
      'winner_player_id', g.winner_player_id,
      'server_time',      now(),
      'reserve_by_color', (
        select jsonb_agg(
                 (select count(*)
                    from public.game_tiles gt
                    join public.tile_definitions td on td.number = gt.number
                   where gt.game_id = g.id and gt.place = 'reserve' and td.color_index = c.c)
                 order by c.c)
          from generate_series(0, 4) as c(c)
      )
    ),
    'me', jsonb_build_object(
      'player_id',    me.id,
      'seat',         me.seat,
      'state',        me.state,
      'has_declared', me.has_declared,
      'support', (
        select coalesce(jsonb_agg(
                 jsonb_build_object(
                   'slot',            gt.slot,
                   'color_index',     td.color_index,
                   'resolved_number', case when g.status = 'active' and me.state = 'active'
                                           then null else gt.number end
                 ) order by gt.slot), '[]'::jsonb)
          from public.game_tiles gt
          join public.tile_definitions td on td.number = gt.number
         where gt.game_id = g.id and gt.owner_id = me.id and gt.place = 'support'
      )
    ),
    'players', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'player_id',    gp.id,
                 'seat',         gp.seat,
                 'display_name', pr.display_name::text,
                 'avatar_key',   pr.avatar_key,
                 'is_bot',       gp.is_bot,
                 'is_guest',     coalesce(pr.is_guest, false),
                 'state',        gp.state,
                 'has_declared', gp.has_declared,
                 'last_seen_at', gp.last_seen_at,
                 'support', (
                   select coalesce(jsonb_agg(
                            jsonb_build_object(
                              'slot',        gt.slot,
                              'number',      gt.number,
                              'color_index', td.color_index,
                              'points',      td.points
                            ) order by gt.slot), '[]'::jsonb)
                     from public.game_tiles gt
                     join public.tile_definitions td on td.number = gt.number
                    where gt.game_id = g.id and gt.owner_id = gp.id and gt.place = 'support'
                 )
               ) order by gp.seat), '[]'::jsonb)
        from public.game_players gp
        left join public.profiles pr on pr.id = gp.profile_id
       where gp.game_id = g.id and gp.id <> me.id
    ),
    'pool', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'number', gt.number, 'color_index', td.color_index, 'points', td.points
               ) order by gt.number), '[]'::jsonb)
        from public.game_tiles gt
        join public.tile_definitions td on td.number = gt.number
       where gt.game_id = g.id and gt.place = 'pool'
    ),
    'clues', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'id',              c.id,
                 'asker_id',        c.asker_id,
                 'tile_number',     c.tile_number,
                 'kind',            c.kind,
                 'target_slot',     c.target_slot,
                 'answer_position', c.answer_position,
                 'answer_same',     c.answer_same,
                 'created_at',      c.created_at
               ) order by c.created_at, c.id), '[]'::jsonb)
        from public.game_clues c
       where c.game_id = g.id
    ),
    'event_seq', g.event_seq
  )
  from g, me;
$$;
