-- Match reports: remember what each replay added to the stats, so a result can be
-- edited or cleared later without re-downloading the replay. Safe to run more than once.

alter table replay_imports add column if not exists schedule_match_id text references schedule_matches(id) on delete set null;
alter table replay_imports add column if not exists parsed_payload jsonb;
alter table replay_imports add column if not exists parsed_at timestamptz;

create index if not exists replay_imports_url_idx on replay_imports(replay_url);

-- Only the server reads and writes this table
alter table replay_imports enable row level security;
