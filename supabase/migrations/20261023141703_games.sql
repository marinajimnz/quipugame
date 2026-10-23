-- T005: partidas, jugadores, pistas y eventos. Todo se escribe solo desde funciones.

create table public.games (
  id                     uuid primary key default gen_random_uuid(),
  mode                   public.game_mode not null,
  status                 public.game_status not null default 'waiting',
  current_seat           smallint check (current_seat between 0 and 3),
  phase                  public.turn_phase not null default 'reveal',
  turn_deadline          timestamptz,
  winner_player_id       uuid,
  event_seq              bigint not null default 0,
  revealed_tile          smallint references public.tile_definitions (number),
  final_round_until_seat smallint check (final_round_until_seat between 0 and 3),
  elo_applied_at         timestamptz,
  created_at             timestamptz not null default now(),
  started_at             timestamptz,
  finished_at            timestamptz
);

create index games_status_idx on public.games (status) where status in ('waiting', 'dealing', 'active');

create table public.game_players (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references public.games (id) on delete cascade,
  profile_id     uuid references public.profiles (id) on delete set null,
  seat           smallint not null check (seat between 0 and 3),
  is_bot         boolean not null default false,
  bot_difficulty text check (bot_difficulty in ('easy', 'normal', 'hard')),
  state          public.player_state not null default 'active',
  has_declared   boolean not null default false,
  timeouts       smallint not null default 0 check (timeouts >= 0),
  last_seen_at   timestamptz not null default now(),
  unique (game_id, seat),
  unique (game_id, profile_id),
  constraint game_players_bot_has_difficulty check (not is_bot or bot_difficulty is not null)
);

create index game_players_profile_idx on public.game_players (profile_id);

alter table public.games
  add constraint games_winner_fk
  foreign key (winner_player_id) references public.game_players (id) on delete set null;

create table public.game_clues (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games (id) on delete cascade,
  asker_id        uuid not null references public.game_players (id) on delete cascade,
  tile_number     smallint not null references public.tile_definitions (number),
  kind            public.clue_kind not null,
  target_slot     smallint check (target_slot between 0 and 4),
  answer_position smallint check (answer_position between 0 and 5),
  answer_same     boolean,
  created_at      timestamptz not null default now(),
  constraint game_clues_shape check (
    (kind = 'classify' and target_slot is null     and answer_position is not null and answer_same is null)
    or
    (kind = 'compare'  and target_slot is not null and answer_position is null     and answer_same is not null)
  )
);

create index game_clues_game_idx on public.game_clues (game_id);

create table public.game_events (
  id         bigint generated always as identity primary key,
  game_id    uuid not null references public.games (id) on delete cascade,
  seq        bigint not null,
  kind       text not null check (kind in (
               'game_started', 'tile_revealed', 'turn_skipped', 'clue_asked',
               'declared', 'eliminated', 'game_ended', 'turn_timeout')),
  actor_id   uuid references public.game_players (id) on delete set null,
  -- Regla de oro: solo información pública. Si no lo puede ver todo el mundo, no entra aquí.
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, seq)
);

alter table public.games        enable row level security;
alter table public.game_players enable row level security;
alter table public.game_clues   enable row level security;
alter table public.game_events  enable row level security;

revoke all on public.games, public.game_players, public.game_clues, public.game_events
  from anon, authenticated;
grant select on public.games, public.game_players, public.game_clues, public.game_events
  to authenticated;
