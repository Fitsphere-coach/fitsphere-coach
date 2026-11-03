-- Meal photos and public image links (REQ-LOG-006, REQ-LOG-010; ADR-0002 rules 1–5 and 8;
-- docs/contracts/data-model.md). The rules of 0001 apply: schema `app`, row level security on with
-- no policies.

-- A meal has at most one photo or one public link (MVP default, D-26): `{"kind": "photo",
-- "mediaId": …}` or `{"kind": "link", "url": "https://…"}`, checked by the API. A deleted meal has
-- none.
alter table app.meals
  add column photo jsonb check (photo is null or jsonb_typeof(photo) = 'object'),
  add constraint meals_deleted_has_no_photo check (deleted_at is null or photo is null);

-- Health data. One row per meal photo; the files themselves (a viewing copy and a thumbnail) are
-- in a private storage bucket, never in the database (ADR-0002 rule 1). The ID is made on the
-- phone, and the row is created when the meal that names it is synced. When the photo is removed,
-- or its meal deleted, the row is marked deleted at once, so no link can be issued for it; the
-- files are then removed from storage, and `files_removed_at` is set once no upload link issued
-- before the deletion can still work.
create table app.media (
  user_id uuid not null references app.users (id) on delete cascade,
  id uuid not null,
  meal_id uuid not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  files_removed_at timestamptz,
  primary key (user_id, id),
  check (files_removed_at is null or deleted_at is not null)
);

create index media_user_meal on app.media (user_id, meal_id);
create index media_files_to_remove on app.media (user_id) where deleted_at is not null and files_removed_at is null;

alter table app.media enable row level security;
