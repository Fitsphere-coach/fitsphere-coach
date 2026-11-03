-- Meals and saved meals (REQ-LOG-*, REQ-NUT-*, REQ-SAVED-*; docs/contracts/data-model.md). The
-- rules of 0001 apply: schema `app`, row level security on with no policies, and every insert and
-- update takes a number from `app.change_seq` for the sync pull.
--
-- A meal's ID is made on the phone, so meals can be created, edited and deleted offline. The
-- primary key is (user_id, id): an ID only ever names one user's meal, so no change can reach
-- another user's meal (invariant #1). A deleted meal keeps a row with no content, so other phones
-- learn about the deletion at their next sync.

-- Health data (REQ-NFR-002). `day` is the IST day the user chose (invariant #5). `items` holds the
-- foods with their values for the amount eaten, checked by the API; the totals are computed by the
-- API from the items (null when no item has that value).
create table app.meals (
  user_id uuid not null references app.users (id) on delete cascade,
  id uuid not null,
  day date not null,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'snack', 'dinner')),
  tags text[] not null default '{}' check (tags <@ array['before_training', 'dessert']::text[]),
  items jsonb check (items is null or jsonb_typeof(items) = 'array'),
  kcal numeric(8,2) check (kcal >= 0),
  protein_g numeric(8,2) check (protein_g >= 0),
  carbs_g numeric(8,2) check (carbs_g >= 0),
  fat_g numeric(8,2) check (fat_g >= 0),
  fibre_g numeric(8,2) check (fibre_g >= 0),
  recorded_at timestamptz not null,
  deleted_at timestamptz,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  -- A live meal has its content and totals; a deleted one has none.
  check (
    (deleted_at is null and meal_type is not null and items is not null and kcal is not null and protein_g is not null)
    or (deleted_at is not null and meal_type is null and items is null and kcal is null and protein_g is null
        and carbs_g is null and fat_g is null and fibre_g is null and tags = '{}')
  )
);

create index meals_user_change_seq on app.meals (user_id, change_seq);
create index meals_user_day on app.meals (user_id, day);

create trigger meals_touch before update on app.meals
  for each row execute function app.touch_synced_row();

-- Health data. A copy of a meal kept for re-logging (REQ-SAVED-001): no day and no photo.
create table app.saved_meals (
  user_id uuid not null references app.users (id) on delete cascade,
  id uuid not null,
  name text check (char_length(name) between 1 and 60),
  meal_type text check (meal_type in ('breakfast', 'lunch', 'snack', 'dinner')),
  tags text[] not null default '{}' check (tags <@ array['before_training', 'dessert']::text[]),
  items jsonb check (items is null or jsonb_typeof(items) = 'array'),
  kcal numeric(8,2) check (kcal >= 0),
  protein_g numeric(8,2) check (protein_g >= 0),
  carbs_g numeric(8,2) check (carbs_g >= 0),
  fat_g numeric(8,2) check (fat_g >= 0),
  fibre_g numeric(8,2) check (fibre_g >= 0),
  saved_at timestamptz not null,
  deleted_at timestamptz,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (
    (deleted_at is null and name is not null and meal_type is not null and items is not null and kcal is not null
      and protein_g is not null)
    or (deleted_at is not null and name is null and meal_type is null and items is null and kcal is null
        and protein_g is null and carbs_g is null and fat_g is null and fibre_g is null and tags = '{}')
  )
);

create index saved_meals_user_change_seq on app.saved_meals (user_id, change_seq);

create trigger saved_meals_touch before update on app.saved_meals
  for each row execute function app.touch_synced_row();

alter table app.meals enable row level security;
alter table app.saved_meals enable row level security;
