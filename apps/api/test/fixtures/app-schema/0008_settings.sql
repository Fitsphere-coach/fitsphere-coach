-- Settings and the AI meal-reading consent record (REQ-ACC-001…004; docs/contracts/data-model.md;
-- docs/plans/settings-slice.md). The rules of 0001 apply: schema `app`, row level security on with
-- no policies, and every insert and update of synced data takes a number from `app.change_seq` for
-- the sync pull.

-- The user's own settings, one current value per name, synced like targets (MVP default, D-S1).
-- Personal data, never seen by a coach or Head Coach (REQ-NFR-001, D-13). The units are display
-- settings: weights stay stored in grams (invariant #6).
create table app.settings (
  user_id uuid not null references app.users (id) on delete cascade,
  name text not null,
  value text not null,
  set_at timestamptz not null,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, name),
  check (
    (name = 'theme' and value in ('system', 'light', 'dark'))
    or (name in ('body_weight_unit', 'lifting_weight_unit') and value in ('kg', 'lb'))
  )
);

create index settings_user_change_seq on app.settings (user_id, change_seq);

create trigger settings_touch before update on app.settings
  for each row execute function app.touch_synced_row();

-- Each change of AI meal-reading consent, kept as its own row (REQ-ACC-004; Q-065 MVP default):
-- on or off, the server's time and the version of the consent text shown. The latest row is the
-- user's current choice; with no row, AI is off (A-007). Not synced: changes go through
-- PUT /v1/me/ai-consent, online only. Deleted with the account (REQ-ACC-009; Legal confirms, Q-049).
create table app.ai_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references app.users (id) on delete cascade,
  consented boolean not null,
  text_version text not null check (length(text_version) between 1 and 32),
  recorded_at timestamptz not null
);

create index ai_consents_user_recorded on app.ai_consents (user_id, recorded_at desc, id desc);

alter table app.settings enable row level security;
alter table app.ai_consents enable row level security;
