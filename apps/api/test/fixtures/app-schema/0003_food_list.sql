-- FitSphere's food list (ADR-0006 rule 1; D-25, D-26) and the products found by barcode
-- (ADR-0006 rule 2). Reference data, not personal: no user_id and no change_seq. As in 0001, the
-- tables live in schema `app` with row level security turned on and no policies.

-- Loaded from data/foods/ifct2017-foods.csv by `npm run foods:import` (docs/data/food-list-sources.md).
-- Values are per 100 g edible portion, in grams and kcal, kept as printed.
create table app.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('ifct2017')),
  code text not null,
  name text not null check (name <> ''),
  food_group text not null,
  protein_g numeric(6,2) not null check (protein_g >= 0),
  fibre_g numeric(6,2) not null check (fibre_g >= 0),
  fat_g numeric(6,2) not null check (fat_g >= 0),
  carbs_g numeric(6,2) not null check (carbs_g >= 0),
  kcal numeric(6,2) not null check (kcal >= 0),
  -- 'estimated_fat_factor': IFCT publishes no energy for oils and fats; 9 kcal per g of fat (D-26).
  kcal_source text not null check (kcal_source in ('published', 'estimated_fat_factor')),
  estimated boolean not null,
  needs_review boolean not null,
  -- Left out of search until checked against the IFCT 2017 book.
  hidden boolean not null,
  note text,
  aliases text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (source, code)
);

-- Open Food Facts products, kept apart from app.foods so the ODbL share-alike duty stays with this
-- table (ADR-0006 rule 2; Legal to confirm, Q-049). Only the barcode is ever sent to Open Food
-- Facts. Used from the Barcode step of the slice.
create table app.barcode_products (
  barcode text primary key check (barcode ~ '^[0-9]{8,14}$'),
  found boolean not null,
  name text,
  brand text,
  kcal_100g numeric(7,2),
  protein_100g numeric(7,2),
  carbs_100g numeric(7,2),
  fat_100g numeric(7,2),
  fibre_100g numeric(7,2),
  source_url text,
  fetched_at timestamptz not null default now(),
  check (found or (name is null and kcal_100g is null))
);

alter table app.foods enable row level security;
alter table app.barcode_products enable row level security;
