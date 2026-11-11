-- TCR-003 as proposed (docs/handoff/trainee-app/TCR-003-training-plans.md), so publishing a training
-- plan can be tested before Developer 1 delivers the real table. Test database only: never applied
-- to Supabase. Replace it with the trainee repo's real migration when TCR-003 is done.
create table app.training_plans (
  id uuid primary key,
  user_id uuid not null references app.users (id) on delete cascade,
  version int not null check (version >= 1),
  name text not null check (char_length(name) between 1 and 80),
  status text not null check (status in ('active', 'ended')),
  weeks int check (weeks is null or weeks between 1 and 52),
  schedule_mode text not null check (schedule_mode in ('weekdays', 'rotating')),
  weekly_target int check (weekly_target is null or weekly_target between 1 and 7),
  daily_target boolean not null default false,
  start_date date not null,
  days jsonb not null check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) <= 7),
  set_by_user_id uuid not null references app.users (id),
  set_by_role text not null check (set_by_role in ('head_coach', 'coach')),
  published_at timestamptz not null,
  ended_at timestamptz,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index training_plans_one_active on app.training_plans (user_id) where status = 'active';
create index training_plans_user_change_seq on app.training_plans (user_id, change_seq);
create trigger training_plans_touch before update on app.training_plans
  for each row execute function app.touch_synced_row();
alter table app.training_plans enable row level security;
