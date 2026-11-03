-- Workouts (REQ-TRN-003, REQ-TRN-004; docs/contracts/data-model.md; docs/plans/training-slice.md).
-- The rules of 0001 apply: schema `app`, row level security on with no policies, and every insert
-- and update takes a number from `app.change_seq` for the sync pull.
--
-- A workout's ID is made on the phone, so workouts can be started, edited and deleted offline. The
-- primary key is (user_id, id): an ID only ever names one user's workout, so no change can reach
-- another user's workout (invariant #1). A deleted workout keeps a row with no content, so other
-- phones learn about the deletion at their next sync.

-- Health data (REQ-NFR-002). `day` is the IST day the user chose (invariant #5). `exercises` holds
-- each exercise's name, sets, reps, weight in whole grams (invariant #6) and note, checked by the
-- API. A day may hold several workouts (MVP default, D-29).
create table app.workouts (
  user_id uuid not null references app.users (id) on delete cascade,
  id uuid not null,
  day date not null,
  exercises jsonb check (
    exercises is null or (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) <= 30)
  ),
  recorded_at timestamptz not null,
  deleted_at timestamptz,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  -- A live workout has its exercises, possibly none (Q-025); a deleted one has none at all.
  check ((deleted_at is null) = (exercises is not null))
);

create index workouts_user_change_seq on app.workouts (user_id, change_seq);
create index workouts_user_day on app.workouts (user_id, day);

create trigger workouts_touch before update on app.workouts
  for each row execute function app.touch_synced_row();

alter table app.workouts enable row level security;
