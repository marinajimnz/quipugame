-- T003: las 60 fichas del juego. Los datos llegan en la migración siguiente,
-- generada por scripts/generate_points_table.py.

create table public.tile_definitions (
  number      smallint primary key check (number between 1 and 60),
  color_index smallint not null check (color_index between 0 and 4),
  points      smallint not null check (points between 1 and 3),
  constraint tile_definitions_color_matches_number check (color_index = (number - 1) % 5)
);

create index tile_definitions_color_idx on public.tile_definitions (color_index);

alter table public.tile_definitions enable row level security;

revoke all on public.tile_definitions from anon, authenticated;
grant select on public.tile_definitions to anon, authenticated;
