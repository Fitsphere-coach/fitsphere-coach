-- CF02: gym onboarding requests and approved gyms (coach-scope §4 and §9; ADR-0004; C-D10, C-D25).
-- Schema coach only (shared database contract, rule 1). Both tables point at app.users with
-- `on delete cascade` (rule 5). Row level security is on with no policies: Supabase's anon and
-- authenticated roles read nothing; the API is the owner.

-- One row per request a person sends. The approval code is never stored: only its keyed hash
-- (HMAC-SHA256, ADR-0004). Expiry is worked out when the row is read; there is no background job.
create table coach.gym_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references app.users (id) on delete cascade,
  gym_name text not null check (char_length(gym_name) between 2 and 100 and gym_name = btrim(gym_name)),
  address text not null check (char_length(address) between 2 and 200),
  city text not null check (char_length(city) between 2 and 60),
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  owner_phone text not null check (char_length(owner_phone) between 7 and 20),
  total_trainees integer not null check (total_trainees between 1 and 100000),
  -- Open key-value set for fields added later (for example website_or_instagram, gst_number), so a
  -- new field needs no migration.
  extra_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_fields) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'expired', 'locked', 'replaced', 'not_sent')),
  code_hash text not null,
  wrong_tries integer not null default 0 check (wrong_tries >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz
);
alter table coach.gym_onboarding_requests enable row level security;

-- A person has at most one Pending request; a new request replaces it (ADR-0004).
create unique index gym_onboarding_one_pending_per_person
  on coach.gym_onboarding_requests (applicant_id) where status = 'pending';

-- The daily-limit count and the "latest request" lookup.
create index gym_onboarding_applicant_created
  on coach.gym_onboarding_requests (applicant_id, created_at desc);

-- An approved gym and its Head Coach. One gym per email (C-D25).
create table coach.gyms (
  id uuid primary key default gen_random_uuid(),
  head_coach_id uuid not null unique references app.users (id) on delete cascade,
  request_id uuid unique references coach.gym_onboarding_requests (id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  address text not null,
  city text not null,
  pincode text not null,
  owner_phone text not null,
  total_trainees integer not null check (total_trainees >= 1),
  extra_fields jsonb not null default '{}'::jsonb,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table coach.gyms enable row level security;
