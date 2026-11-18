-- ─────────────────────────────────────────────────────────────────────────────
-- Point lists (run once in the Supabase SQL editor, BEFORE pushing the code).
--
-- A point list is a named set of point values + bans ("Default", "VGC Default",
-- "Season 2026" …). Every season uses one list; editing a list changes every
-- season that uses it. Safe to re-run: nothing already set up is overwritten.
--
-- What it sets up the first time:
--   • "Default" and "VGC Default": copies of the ACTIVE season's current points
--     and bans. The active season (26/27) is switched to "Default".
--   • Every other season gets its own list, named after the season, frozen at
--     the points it uses today, so its history never changes.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists point_lists (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists point_list_values (
  list_id text not null references point_lists(id) on delete cascade,
  pokemon_id text not null references pokemon(id) on delete cascade,
  point_value integer not null,
  banned boolean not null default false,
  primary key (list_id, pokemon_id)
);

-- Columns the site already uses (no-ops on the live database)
alter table pokemon add column if not exists banned boolean not null default false;
alter table pokemon add column if not exists ultra_beast boolean not null default false;

alter table seasons add column if not exists point_list_id text references point_lists(id) on delete set null;

-- Only the server (service role) reads or writes these.
alter table point_lists enable row level security;
alter table point_list_values enable row level security;

-- Makes sure the old per-season table exists so the copy below works on any database
create table if not exists season_point_values (
  season_id text not null references seasons(id) on delete cascade,
  pokemon_id text not null references pokemon(id) on delete cascade,
  point_value integer not null,
  primary key (season_id, pokemon_id)
);

-- ── 1. Default + VGC Default from the active season ─────────────────────────
do $$
declare
  active_id text := (select id from seasons where active_season order by created_at desc limit 1);
begin
  if exists (select 1 from point_lists where name = 'Default') then
    return; -- already set up
  end if;

  insert into point_lists (name) values ('Default'), ('VGC Default');

  insert into point_list_values (list_id, pokemon_id, point_value, banned)
  select l.id, p.id, coalesce(spv.point_value, p.point_value), coalesce(p.banned, false)
  from point_lists l
  cross join pokemon p
  left join season_point_values spv on spv.pokemon_id = p.id and spv.season_id = active_id
  where l.name in ('Default', 'VGC Default');

  if active_id is not null then
    update seasons set point_list_id = (select id from point_lists where name = 'Default') where id = active_id;
  end if;
end $$;

-- ── 2. Every other season: its own frozen list ──────────────────────────────
insert into point_lists (name)
select s.name from seasons s
where s.point_list_id is null
on conflict (name) do nothing;

insert into point_list_values (list_id, pokemon_id, point_value, banned)
select l.id, p.id, coalesce(spv.point_value, p.point_value), coalesce(p.banned, false)
from seasons s
join point_lists l on l.name = s.name
cross join pokemon p
left join season_point_values spv on spv.pokemon_id = p.id and spv.season_id = s.id
where s.point_list_id is null
on conflict (list_id, pokemon_id) do nothing;

update seasons s set point_list_id = l.id
from point_lists l
where l.name = s.name and s.point_list_id is null;
