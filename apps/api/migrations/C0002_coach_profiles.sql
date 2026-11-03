-- CF01: the coach's name and their acceptance of the coach terms (CAUTH-006). Schema coach only
-- (shared database contract, rule 1). Both tables point at app.users with `on delete cascade`, so
-- deleting an account in the trainee app keeps working (contract rule 5). Row level security is on
-- with no policies: Supabase's anon and authenticated roles read nothing; the API is the owner.

-- The name trainees see on plans and targets ("Set by Asha Rao"). One row per coach account.
create table coach.profiles (
  user_id uuid primary key references app.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 60 and full_name = btrim(full_name)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table coach.profiles enable row level security;

-- Terms, Privacy Policy and Coach data terms, accepted together at coach sign-up. Append-only:
-- a new version of the text is a new row.
create table coach.terms_acceptances (
  user_id uuid not null references app.users (id) on delete cascade,
  terms_version text not null check (char_length(terms_version) between 1 and 32),
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version)
);
alter table coach.terms_acceptances enable row level security;
