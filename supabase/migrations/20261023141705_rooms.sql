-- T007: salas privadas.

create table public.rooms (
  id             uuid primary key default gen_random_uuid(),
  -- Alfabeto sin 0, O, 1, I.
  code           text not null unique check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$'),
  host_id        uuid not null references public.profiles (id) on delete cascade,
  seats          smallint not null check (seats between 2 and 4),
  fill_with_bots boolean not null default false,
  game_id        uuid references public.games (id) on delete set null,
  status         text not null default 'open' check (status in ('open', 'started', 'expired')),
  expires_at     timestamptz not null default now() + interval '30 minutes',
  created_at     timestamptz not null default now()
);

create index rooms_open_expiry_idx on public.rooms (expires_at) where status = 'open';

create table public.room_members (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (room_id, profile_id)
);

create index room_members_profile_idx on public.room_members (profile_id);

alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;

revoke all on public.rooms, public.room_members from anon, authenticated;
grant select on public.rooms, public.room_members to authenticated;
