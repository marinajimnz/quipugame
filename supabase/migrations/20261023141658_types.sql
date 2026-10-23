-- T002: tipos enumerados del juego y esquema interno.

-- Funciones internas del motor (deal_game, apply_elo, bots, tareas de pg_cron).
-- Este esquema NO está en [api] schemas de config.toml, así que PostgREST no lo expone,
-- y además nadie salvo el propietario puede usarlo ni ejecutar sus funciones.
create schema if not exists game_internal;

revoke all on schema game_internal from public, anon, authenticated;

-- Postgres concede EXECUTE a PUBLIC en toda función nueva. Se revoca por defecto
-- para que una función olvidada en game_internal nunca sea invocable por un cliente.
alter default privileges for role postgres in schema game_internal
  revoke execute on functions from public, anon, authenticated;

create type public.game_mode    as enum ('ranked', 'private', 'practice');
create type public.game_status  as enum ('waiting', 'dealing', 'active', 'finished', 'cancelled');
create type public.player_state as enum ('active', 'eliminated', 'abandoned');
create type public.turn_phase   as enum ('reveal', 'clue');
create type public.tile_place   as enum ('reserve', 'support', 'pool', 'spent');
create type public.clue_kind    as enum ('classify', 'compare');
