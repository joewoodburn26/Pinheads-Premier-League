-- Playoffs: per-season playoff size, seeds on bracket matches, and playoff stats.
-- Safe to run more than once.

alter table seasons add column if not exists playoff_teams integer;

create table if not exists playoff_matches (
  id text primary key default gen_random_uuid()::text,
  season_id text not null references seasons(id) on delete cascade,
  round integer not null,
  round_name text,
  slot_index integer not null,
  team1_id text references teams(id) on delete set null,
  team2_id text references teams(id) on delete set null,
  winner text references teams(id) on delete set null,
  bo3_score text,
  team1_diff integer not null default 0,
  team2_diff integer not null default 0,
  replay_1 text,
  replay_2 text,
  replay_3 text
);
alter table playoff_matches add column if not exists team1_seed integer;
alter table playoff_matches add column if not exists team2_seed integer;
create index if not exists playoff_matches_season_idx on playoff_matches(season_id, round, slot_index);
alter table playoff_matches enable row level security;

-- Which replays were playoff games (for the Stats page filter)
alter table replay_imports add column if not exists stage text;
alter table replay_imports add column if not exists playoff_match_id text references playoff_matches(id) on delete set null;
