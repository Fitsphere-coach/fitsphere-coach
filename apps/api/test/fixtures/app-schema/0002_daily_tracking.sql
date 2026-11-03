-- Home and daily tracking (docs/contracts/data-model.md; docs/plans/home-daily-tracking-slice.md).
-- The rules of 0001 apply: schema `app`, row level security on with no policies, and every insert
-- and update of synced data takes a number from `app.change_seq` for the sync pull.

-- Health data (REQ-NFR-002). One value per user per IST day (Q-030); `day` is the day the user
-- chose, never derived from a timestamp (invariant #5).
create table app.step_counts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users (id) on delete cascade,
  day date not null,
  steps integer not null check (steps between 0 and 100000),
  recorded_at timestamptz not null,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index step_counts_user_change_seq on app.step_counts (user_id, change_seq);

create trigger step_counts_touch before update on app.step_counts
  for each row execute function app.touch_synced_row();

-- Health data. Sleep in whole minutes (invariant #6); typed in hours with one decimal (Q-028).
create table app.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users (id) on delete cascade,
  day date not null,
  sleep_minutes integer not null check (sleep_minutes between 0 and 1440),
  recorded_at timestamptz not null,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index sleep_logs_user_change_seq on app.sleep_logs (user_id, change_seq);

create trigger sleep_logs_touch before update on app.sleep_logs
  for each row execute function app.touch_synced_row();

-- Health data. Lengths in whole millimetres (invariant #6), 10–250 cm (Q-028). Both waist values
-- are required (REQ-MEAS-004); the rest are optional (REQ-MEAS-005).
create table app.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users (id) on delete cascade,
  day date not null,
  upper_waist_mm integer not null check (upper_waist_mm between 100 and 2500),
  lower_waist_mm integer not null check (lower_waist_mm between 100 and 2500),
  chest_mm integer check (chest_mm between 100 and 2500),
  hips_mm integer check (hips_mm between 100 and 2500),
  arm_mm integer check (arm_mm between 100 and 2500),
  thigh_mm integer check (thigh_mm between 100 and 2500),
  notes text check (char_length(notes) between 1 and 500),
  recorded_at timestamptz not null,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index measurements_user_change_seq on app.measurements (user_id, change_seq);

create trigger measurements_touch before update on app.measurements
  for each row execute function app.touch_synced_row();

-- The user's targets (REQ-ROLE-007): one current value per kind (Q-014 MVP default, D-23). Each
-- records who set it and when, so coach-set targets can be added later and kept read-only for the
-- trainee (invariant #2, D-20). `set_by_user_id` becomes null only if that person's account is
-- deleted (backlog E-02).
create table app.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users (id) on delete cascade,
  kind text not null check (kind in ('calories', 'protein', 'steps', 'weekly_workouts', 'body_weight')),
  value integer not null,
  set_by_user_id uuid references app.users (id) on delete set null,
  set_at timestamptz not null,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind),
  -- kcal, grams of protein, steps, workouts a week, body weight in grams (D-23).
  check (
    (kind = 'calories' and value between 500 and 10000)
    or (kind = 'protein' and value between 10 and 500)
    or (kind = 'steps' and value between 1 and 100000)
    or (kind = 'weekly_workouts' and value between 1 and 14)
    or (kind = 'body_weight' and value between 20000 and 300000)
  )
);

create index targets_user_change_seq on app.targets (user_id, change_seq);

create trigger targets_touch before update on app.targets
  for each row execute function app.touch_synced_row();

alter table app.step_counts enable row level security;
alter table app.sleep_logs enable row level security;
alter table app.measurements enable row level security;
alter table app.targets enable row level security;
