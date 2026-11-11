-- CF06: workout management (SPEC-002; coach-scope §6; C-D12, C-D13, C-D18). Schema coach only
-- (shared database contract, rule 1). Every table that points at a user cascades on delete (rule 4).
-- Row level security is on with no policies: Supabase's anon and authenticated roles read nothing;
-- the API is the owner.

-- Reusable workout templates. `gym_head_coach_id` names the gym (a gym is its Head Coach). A gym-wide
-- template is usable by every coach of the gym; a personal one only by its author.
create table coach.workout_templates (
  id uuid primary key default gen_random_uuid(),
  gym_head_coach_id uuid not null references app.users (id) on delete cascade,
  created_by uuid not null references app.users (id) on delete cascade,
  visibility text not null check (visibility in ('gym', 'personal')),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  goal text not null check (goal in ('weight_loss', 'muscle_gain', 'strength', 'general_fitness', 'endurance', 'mobility')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  -- weeks, scheduleMode, weeklyTarget, dailyTarget and days; checked by the API (shared schema).
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table coach.workout_templates enable row level security;
create index workout_templates_gym on coach.workout_templates (gym_head_coach_id, active);

-- One plan for one trainee. `content` is the working copy the coach edits; `version` counts its edits
-- and `live_version` is the version the trainee sees (null until first published). The trainee sees
-- a plan only after publish (and only once TCR-003 exists in the trainee app, C-D22).
create table coach.training_plans (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references app.users (id) on delete cascade,
  gym_head_coach_id uuid not null references app.users (id) on delete cascade,
  created_by uuid not null references app.users (id) on delete cascade,
  template_id uuid references coach.workout_templates (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  status text not null check (status in ('draft', 'active', 'ended')),
  -- The India day the plan starts (invariant 4).
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
alter table coach.training_plans enable row level security;
-- One live plan and at most one draft per trainee.
create unique index training_plans_one_active on coach.training_plans (trainee_id) where status = 'active';
create unique index training_plans_one_draft on coach.training_plans (trainee_id) where status = 'draft';
create index training_plans_gym on coach.training_plans (gym_head_coach_id, status);

-- What was published, kept for ever: restoring and "what the trainee saw" read from here.
create table coach.plan_versions (
  plan_id uuid not null references coach.training_plans (id) on delete cascade,
  version integer not null check (version >= 1),
  name text not null,
  content jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references app.users (id) on delete cascade,
  primary key (plan_id, version)
);
alter table coach.plan_versions enable row level security;

-- The change log (C-D13, invariant 13): who (user and role at the time) and when, written in the same
-- transaction as the change.
create table coach.plan_changes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references coach.training_plans (id) on delete cascade,
  action text not null check (action in ('created', 'edited', 'published', 'ended', 'restored', 'reverted')),
  version integer not null check (version >= 1),
  actor_id uuid not null references app.users (id) on delete cascade,
  actor_role text not null check (actor_role in ('head_coach', 'coach')),
  summary text check (summary is null or char_length(summary) <= 200),
  created_at timestamptz not null default now()
);
alter table coach.plan_changes enable row level security;
create index plan_changes_plan on coach.plan_changes (plan_id, created_at desc);
