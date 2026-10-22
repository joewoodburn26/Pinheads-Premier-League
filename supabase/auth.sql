-- ─────────────────────────────────────────────────────────────────────────────
-- Sign-ins: one profile per league member (run once in the Supabase SQL editor)
-- ─────────────────────────────────────────────────────────────────────────────
-- role:      owner | admin | coach   (what they're allowed to change)
-- coach_id:  which coach (and therefore which team) they run; separate from role
-- must_change_password: true until they replace the starting password

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'coach' check (role in ('owner', 'admin', 'coach')),
  coach_id text references coaches(id) on delete set null,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Only the server (service role) reads or writes profiles.
alter table profiles enable row level security;
