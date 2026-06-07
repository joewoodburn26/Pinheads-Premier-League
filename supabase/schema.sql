create extension if not exists "pgcrypto";

create table if not exists seasons (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  draft_budget integer not null default 105,
  active_season boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists coaches (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  image_url text,
  bio text
);

create table if not exists teams (
  id text primary key default gen_random_uuid()::text,
  season_id text not null references seasons(id) on delete cascade,
  coach_id text not null references coaches(id) on delete cascade,
  team_name text not null,
  logo_url text,
  wins integer not null default 0,
  losses integer not null default 0
);

create table if not exists pokemon (
  id text primary key default gen_random_uuid()::text,
  dex_number integer not null,
  name text not null,
  sprite_url text not null,
  primary_type text not null,
  secondary_type text,
  hp integer not null,
  attack integer not null,
  defense integer not null,
  special_attack integer not null,
  special_defense integer not null,
  speed integer not null,
  bst integer not null,
  point_value integer not null,
  legendary boolean not null default false,
  mythical boolean not null default false,
  paradox boolean not null default false,
  unique(dex_number, name)
);

create table if not exists team_pokemon (
  id text primary key default gen_random_uuid()::text,
  season_id text not null references seasons(id) on delete cascade,
  team_id text not null references teams(id) on delete cascade,
  pokemon_id text not null references pokemon(id) on delete cascade,
  unique(season_id, team_id, pokemon_id)
);

create table if not exists schedule_matches (
  id text primary key default gen_random_uuid()::text,
  season_id text not null references seasons(id) on delete cascade,
  week integer not null,
  home_team text not null references teams(id) on delete cascade,
  away_team text not null references teams(id) on delete cascade,
  winner text references teams(id) on delete set null,
  replay_1 text,
  replay_2 text,
  replay_3 text
);

create table if not exists pokemon_stats (
  id text primary key default gen_random_uuid()::text,
  season_id text not null references seasons(id) on delete cascade,
  pokemon_id text not null references pokemon(id) on delete cascade,
  team_id text references teams(id) on delete set null,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  kos integer not null default 0,
  deaths integer not null default 0,
  unique(season_id, pokemon_id, team_id)
);

create table if not exists league_rules (
  id text primary key default 'default',
  content text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists replay_imports (
  id text primary key default gen_random_uuid()::text,
  season_id text not null references seasons(id) on delete cascade,
  schedule_match_id text references schedule_matches(id) on delete set null,
  replay_url text not null,
  parser_status text not null default 'pending',
  parsed_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists teams_season_idx on teams(season_id);
create index if not exists team_pokemon_team_idx on team_pokemon(team_id);
create index if not exists schedule_matches_week_idx on schedule_matches(season_id, week);
create index if not exists pokemon_stats_season_idx on pokemon_stats(season_id);
