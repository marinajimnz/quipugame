-- T006: tabla crítica. Aquí viven los números ocultos.
--
-- Protección por ausencia de política: RLS activada y NINGUNA política, de modo que
-- ningún cliente puede leerla. Además se retiran todos los permisos a anon y authenticated
-- (doble cerrojo). El único acceso son funciones SECURITY DEFINER, que corren como
-- postgres, rol con BYPASSRLS, por lo que no hace falta FORCE ROW LEVEL SECURITY.
--
-- NO AÑADIR NUNCA UNA POLÍTICA A ESTA TABLA. Hay un test que lo comprueba.

create table public.game_tiles (
  id       uuid primary key default gen_random_uuid(),
  game_id  uuid not null references public.games (id) on delete cascade,
  number   smallint not null references public.tile_definitions (number),
  place    public.tile_place not null default 'reserve',
  owner_id uuid references public.game_players (id) on delete cascade,
  slot     smallint check (slot between 0 and 4),
  unique (game_id, number),
  unique (game_id, owner_id, slot),
  constraint game_tiles_support_has_owner_and_slot check (
    (place = 'support' and owner_id is not null and slot is not null)
    or
    (place <> 'support' and owner_id is null and slot is null)
  )
);

create index game_tiles_game_place_idx on public.game_tiles (game_id, place);

alter table public.game_tiles enable row level security;

revoke all on public.game_tiles from public, anon, authenticated;
