-- ─────────────────────────────────────────────────────────────────────────────
-- Draft Plans: saved team-builder lists, private to each team (run once)
-- ─────────────────────────────────────────────────────────────────────────────
-- picks: [{ "id": "<pokemon id>", "note": "<coach note>" }, ...]

create table if not exists draft_plans (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references teams(id) on delete cascade,
  name text not null,
  picks jsonb not null default '[]'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists draft_plans_team_idx on draft_plans(team_id);

-- Only the server (service role) reads or writes plans.
alter table draft_plans enable row level security;
