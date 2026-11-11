-- PROPOSED, NOT REAL: the schema `app` changes that TCR-001 asks Developer 1 to build
-- (docs/handoff/trainee-app/TCR-001-joining-a-gym.md, section 5). Used only by the integration tests, on
-- the local or CI test database, so the coach side of inviting a trainee can be tested before
-- Developer 1 delivers it. Never apply to Supabase. When TCR-001 is merged in the trainee repo, replace
-- this file with the trainee repo's real migration (in ../app-schema/) and delete it.

alter table app.users
  add column full_name text
  check (full_name is null or (char_length(full_name) between 2 and 60 and full_name = btrim(full_name)));

create table app.coach_invitations (
  id uuid primary key default gen_random_uuid(),
  gym_head_coach_id uuid not null references app.users (id) on delete cascade,
  assigned_coach_id uuid not null references app.users (id) on delete cascade,
  invited_by_id uuid not null references app.users (id) on delete cascade,
  invitee_email text not null check (invitee_email = lower(invitee_email)),
  invitee_user_id uuid references app.users (id) on delete cascade,
  token_hash text,
  gym_name text not null,
  assigned_coach_name text not null,
  head_coach_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz
);
create unique index coach_invitations_one_pending
  on app.coach_invitations (gym_head_coach_id, invitee_email) where status = 'pending';
create index coach_invitations_invitee on app.coach_invitations (invitee_user_id) where status = 'pending';
create index coach_invitations_email on app.coach_invitations (invitee_email) where status = 'pending';
alter table app.coach_invitations enable row level security;

create table app.coach_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references app.users (id) on delete cascade,
  invitation_id uuid not null references app.coach_invitations (id) on delete cascade,
  consented boolean not null,
  text_version text not null check (char_length(text_version) between 1 and 32),
  recorded_at timestamptz not null
);
alter table app.coach_consents enable row level security;
