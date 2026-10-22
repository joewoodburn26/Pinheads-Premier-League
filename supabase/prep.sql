-- ─────────────────────────────────────────────────────────────────────────────
-- Prep tab: private matchup notes, one per (your team, opponent) (run once)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists matchup_notes (
  team_id text not null references teams(id) on delete cascade,
  opponent_team_id text not null references teams(id) on delete cascade,
  notes text not null default '',
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_id, opponent_team_id)
);

-- Only the server (service role) reads or writes notes.
alter table matchup_notes enable row level security;
