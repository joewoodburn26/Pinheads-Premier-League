-- ─────────────────────────────────────────────────────────────────────────────
-- Per-season point values (run once). A row here overrides a Pokémon's base
-- points for that season only — e.g. a VGC season with its own values.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists season_point_values (
  season_id text not null references seasons(id) on delete cascade,
  pokemon_id text not null references pokemon(id) on delete cascade,
  point_value integer not null,
  primary key (season_id, pokemon_id)
);

-- If the table already existed without a key, this gives saves something to match on
create unique index if not exists season_point_values_season_pokemon_idx
  on season_point_values (season_id, pokemon_id);

-- Only the server (service role) reads or writes season points.
alter table season_point_values enable row level security;
