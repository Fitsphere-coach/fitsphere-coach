-- Skeleton schema (docs/contracts/data-model.md; ADR-0003).
-- Everything lives in schema `app`, not `public`, and every table has row level security turned
-- on with no policies, so Supabase's anon and authenticated roles can read nothing (ADR-0002).
-- The API connects as the tables' owner.

create schema if not exists app;

-- Every insert and update of synced data takes a number from this sequence (sync pull).
create sequence app.change_seq;

create function app.touch_synced_row() returns trigger
language plpgsql as $$
begin
  new.change_seq := nextval('app.change_seq');
  new.updated_at := now();
  return new;
end;
$$;

create table app.users (
  id uuid primary key default gen_random_uuid(),
  auth_subject text not null unique,
  email text not null unique check (email = lower(email)),
  age_confirmed_at timestamptz not null,
  age_confirmation_text_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.user_roles (
  user_id uuid not null references app.users (id) on delete cascade,
  role text not null check (role in ('personal', 'coach', 'head_coach')),
  turned_on_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Post-MVP (D-20, backlog B-19): created now so links can be added without rework. In the MVP
-- only the database tests write it.
create table app.links (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('coach_trainee', 'head_coach_coach')),
  upper_user_id uuid not null references app.users (id),
  lower_user_id uuid not null references app.users (id),
  status text not null check (status in ('active', 'ended')),
  started_at timestamptz not null,
  ended_at timestamptz,
  end_reason text check (end_reason in ('removed', 'left', 'switched', 'account_deleted')),
  created_at timestamptz not null default now(),
  check (upper_user_id <> lower_user_id),
  check (
    (status = 'active' and ended_at is null and end_reason is null)
    or (status = 'ended' and ended_at is not null and end_reason is not null)
  )
);

-- A trainee has at most one coach, and a coach at most one Head Coach (D-11).
create unique index links_one_active_per_lower on app.links (kind, lower_user_id)
  where status = 'active';

-- Post-MVP (D-20, backlog B-20): the table only. Append-only; the latest row is the answer.
create table app.head_coach_permission_answers (
  id uuid primary key default gen_random_uuid(),
  coach_trainee_link_id uuid not null references app.links (id),
  head_coach_link_id uuid not null references app.links (id),
  answer text not null check (answer in ('allowed', 'declined')),
  answered_at timestamptz not null
);

create index head_coach_permission_answers_latest
  on app.head_coach_permission_answers (coach_trainee_link_id, head_coach_link_id, answered_at desc);

-- Health data (REQ-NFR-002). One value per user per IST day; `day` is the day the user chose,
-- never derived from a timestamp (invariant #5). Body weight in whole grams (invariant #6).
create table app.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users (id) on delete cascade,
  day date not null,
  weight_grams integer not null check (weight_grams between 20000 and 300000),
  recorded_at timestamptz not null,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index weigh_ins_user_change_seq on app.weigh_ins (user_id, change_seq);

create trigger weigh_ins_touch before update on app.weigh_ins
  for each row execute function app.touch_synced_row();

-- Sync bookkeeping (ADR-0007): each phone change is applied once. Holds no health values.
create table app.applied_changes (
  user_id uuid not null references app.users (id) on delete cascade,
  change_id uuid not null,
  change_type text not null,
  status text not null check (status in ('accepted', 'rejected')),
  error_code text,
  applied_at timestamptz not null default now(),
  primary key (user_id, change_id),
  check ((status = 'accepted') = (error_code is null))
);

alter table app.users enable row level security;
alter table app.user_roles enable row level security;
alter table app.links enable row level security;
alter table app.head_coach_permission_answers enable row level security;
alter table app.weigh_ins enable row level security;
alter table app.applied_changes enable row level security;
