-- T008: cola de emparejamiento e historial de ELO.

create table public.matchmaking_queue (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  elo        integer not null check (elo >= 100),
  joined_at  timestamptz not null default now()
);

create index matchmaking_queue_joined_idx on public.matchmaking_queue (joined_at);

create table public.elo_history (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  elo_before integer not null,
  elo_after  integer not null check (elo_after >= 100),
  delta      integer not null,
  k_factor   smallint not null,
  created_at timestamptz not null default now(),
  unique (game_id, profile_id)
);

create index elo_history_profile_idx on public.elo_history (profile_id, created_at desc);

alter table public.matchmaking_queue enable row level security;
alter table public.elo_history       enable row level security;

revoke all on public.matchmaking_queue, public.elo_history from anon, authenticated;
grant select on public.matchmaking_queue to authenticated;
grant select on public.elo_history to anon, authenticated;
