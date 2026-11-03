-- FitSphere's dishes (D-26 answer 3, amended 2026-10-30; D-28): the approved rows of
-- docs/data/standard-recipe-sheet.csv, loaded by `npm run foods:import` with the food list.
-- Reference data, not personal: no user_id and no change_seq. As in 0001, the table lives in schema
-- `app` with row level security turned on and no policies.

-- Values are for one portion (one piece, or one 200 ml katori), worked out from IFCT values × the
-- sheet's measured grams, so they are always estimated. The recipe's ingredients and grams are not
-- stored: GET /v1/foods serves only these values. A row exists only while its recipe is approved
-- and complete.
create table app.dishes (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (name <> ''),
  portion_unit text not null check (portion_unit in ('piece', 'katori')),
  kcal numeric(7,2) not null check (kcal >= 0),
  protein_g numeric(6,2) not null check (protein_g >= 0),
  carbs_g numeric(6,2) not null check (carbs_g >= 0),
  fat_g numeric(6,2) not null check (fat_g >= 0),
  fibre_g numeric(6,2) not null check (fibre_g >= 0),
  updated_at timestamptz not null default now()
);

alter table app.dishes enable row level security;
