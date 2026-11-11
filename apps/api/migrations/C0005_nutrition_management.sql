-- CF07: nutrition management (SPEC-003; coach-scope §6; C-D12, C-D13, C-D18). Schema coach only
-- (shared database contract, rule 1). Every table that points at a user cascades on delete (rule 4).
-- Row level security is on with no policies. Same shape as the workout tables (C0004); a diet plan's
-- ingredients point at app.foods by id in the stored content, never by a foreign key.

create table coach.diet_templates (
  id uuid primary key default gen_random_uuid(),
  gym_head_coach_id uuid not null references app.users (id) on delete cascade,
  created_by uuid not null references app.users (id) on delete cascade,
  visibility text not null check (visibility in ('gym', 'personal')),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  goal text not null check (goal in ('weight_loss', 'muscle_gain', 'maintenance', 'general_fitness')),
  -- calorieTarget, proteinTarget, note and slots; checked by the API (shared schema).
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table coach.diet_templates enable row level security;
create index diet_templates_gym on coach.diet_templates (gym_head_coach_id, active);

create table coach.diet_plans (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references app.users (id) on delete cascade,
  gym_head_coach_id uuid not null references app.users (id) on delete cascade,
  created_by uuid not null references app.users (id) on delete cascade,
  template_id uuid references coach.diet_templates (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  status text not null check (status in ('draft', 'active', 'ended')),
  start_date date not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  version integer not null default 1 check (version >= 1),
  live_version integer check (live_version is null or live_version >= 1),
  published_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'draft') = (live_version is null)),
  check ((status = 'ended') = (ended_at is not null))
);
alter table coach.diet_plans enable row level security;
create unique index diet_plans_one_active on coach.diet_plans (trainee_id) where status = 'active';
create unique index diet_plans_one_draft on coach.diet_plans (trainee_id) where status = 'draft';
create index diet_plans_gym on coach.diet_plans (gym_head_coach_id, status);

create table coach.diet_plan_versions (
  plan_id uuid not null references coach.diet_plans (id) on delete cascade,
  version integer not null check (version >= 1),
  name text not null,
  content jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references app.users (id) on delete cascade,
  primary key (plan_id, version)
);
alter table coach.diet_plan_versions enable row level security;

-- The change log (C-D13, invariant 13), written in the same transaction as the change.
create table coach.diet_plan_changes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references coach.diet_plans (id) on delete cascade,
  action text not null check (action in ('created', 'edited', 'published', 'ended', 'restored', 'reverted')),
  version integer not null check (version >= 1),
  actor_id uuid not null references app.users (id) on delete cascade,
  actor_role text not null check (actor_role in ('head_coach', 'coach')),
  summary text check (summary is null or char_length(summary) <= 200),
  created_at timestamptz not null default now()
);
alter table coach.diet_plan_changes enable row level security;
create index diet_plan_changes_plan on coach.diet_plan_changes (plan_id, created_at desc);
