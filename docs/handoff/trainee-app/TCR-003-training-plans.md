# TCR-003: Coach training plans in the Training tab

| | |
|---|---|
| Status | **Ready for owner** (CF06 UI approved and the owner's answers are in, 2026-11-11; the coach side is built. Review §12, then send to Developer 1) |
| Written by | Coach team (Developer 2), 2026-11-11 |
| For | Developer 1 — trainee app (`fitsphere`) |
| Coach feature that depends on it | CF06 (workout management, SPEC-002) |
| Coach decisions | C-D13, C-D22, C-D27, C-D28; ADR-0002 (rules 2–4) |
| Trainee-repo items it delivers | New (Developer 1 to assign IDs); relates to REQ-TRN-003/004 and REQ-PLAN-001 |

Design source: `docs/design/CF06-workout-management-ui.md`. **Depends on TCR-001** (a link exists).

## 1. Why
A coach builds a training plan for a trainee in FitSphere Coach. The trainee sees it in the Training tab, starts a plan day with the targets filled in, and logs the workout against it. The trainee cannot edit the plan; coach input wins (REQ-PLAN-001).

## 2. User flow
1. The coach saves a plan as a draft (trainee sees nothing) and then publishes it.
2. On the trainee's next sync the Training tab shows "Plan from {Coach name}" with the plan's days.
3. The trainee taps **Start** on a day; the workout opens with exercises, sets, target reps, target weight, rest and coach notes pre-filled. They log actual values as usual.
4. When the coach publishes a new version, the trainee sees it from the next sync; a workout already in progress keeps the version it started with.
5. When the coach ends the plan, or the link ends (C-D28), the plan stops showing as current; past workouts keep the plan name and version they followed.

## 3. Screens and states
- **Training tab, plan card:** "{Plan name}" · "Set by {Coach name} (C|HC)" · "Week {n} of {m}" (or "Ongoing") · list of days (name; "Rest" for rest days). Lock icon; no edit controls.
- **Plan day:** exercises in order with "3 × 8–10", target weight (user's unit), rest ("Rest 2:00"), RPE if set, supersets grouped with a bracket, coach note. Button **Start**.
- **Workout screen:** as today, fields pre-filled from the day (target shown beside the entry, actual entered by the trainee). Existing free-form workouts keep working with no plan.
- States: loading; no plan (existing screen, unchanged); offline (the last synced plan, usable); plan ended (card removed, history keeps the name).

## 4. Exact copy
- "Plan from {Coach name}" · "Set by {Coach name} (Head coach)" / "(Coach)" · "Your coach built this plan. You can't edit it, but you can change weights when you log." · "Rest day" · "Start" · "Target" · "Week {n} of {m}" · "Ongoing".
- Updated plan toast: "Your coach updated your plan."

## 5. Data (schema `app`; Developer 1 writes the migration)
Follow the sync pattern of `0007_workouts.sql` (`change_seq`, touch trigger, row level security on, no policies, `on delete cascade` from `app.users`).

```sql
-- One row per live or ended plan of a trainee. Written by the coach server only, when the coach
-- publishes. Drafts and unpublished edits never reach this table (they stay in schema `coach`), so
-- the trainee API needs no "hide drafts" rule. Publishing a new version updates the same row.
create table app.training_plans (
  id uuid primary key,                       -- the coach server's plan id
  user_id uuid not null references app.users (id) on delete cascade,  -- the trainee
  version int not null check (version >= 1), -- the published version the trainee sees
  name text not null check (char_length(name) between 1 and 80),
  status text not null check (status in ('active', 'ended')),
  weeks int check (weeks is null or weeks between 1 and 52),          -- null = ongoing
  schedule_mode text not null check (schedule_mode in ('weekdays', 'rotating')),
  weekly_target int check (weekly_target is null or weekly_target between 1 and 7),
  daily_target boolean not null default false,
  start_date date not null,                  -- IST day
  days jsonb not null check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) <= 7),
  set_by_user_id uuid not null references app.users (id),
  set_by_role text not null check (set_by_role in ('head_coach', 'coach')),
  published_at timestamptz not null,
  ended_at timestamptz,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One live plan per trainee.
create unique index training_plans_one_active on app.training_plans (user_id) where status = 'active';
create index training_plans_user_change_seq on app.training_plans (user_id, change_seq);
create trigger training_plans_touch before update on app.training_plans
  for each row execute function app.touch_synced_row();
alter table app.training_plans enable row level security;

-- A logged workout remembers the plan and the published version it followed.
alter table app.workouts
  add column plan_id uuid references app.training_plans (id) on delete set null,
  add column plan_version int,
  add column plan_day int;
```

`days` shape (checked by the coach API; this is exactly what the coach server writes): `[{ "name": "Push", "weekday": 1, "rest": false, "exercises": [{ "exerciseId": "bench-press", "group": null, "sets": 3, "repsMin": 8, "repsMax": 10, "weightG": 40000, "rpe": 8, "restS": 120, "note": "…" }] }]`. `weekday` is 1 (Monday) to 7 (Sunday) when `schedule_mode` is `weekdays`, and null when `rotating` (the trainee picks the next day). `exerciseId` is one of ten fixed ids for now: bench-press, back-squat, deadlift, overhead-press, pull-up, dumbbell-row, lunge, push-up, plank, biceps-curl; the trainee app keeps its own id-to-name list (an unknown id shows the id). A superset is the exercises of one day with the same non-null `group`. Weight is whole grams (invariant 5). Max 12 exercises per day, 1–6 sets, reps 1–100, rest 15–600 s.
- Coach server writes the row **and** its change-log row (in `coach`) in one transaction (ADR-0002 rule 3). It writes only `status`, plan content and the `set_by` columns; it never touches workouts.
- `weekly_target` and `daily_target` are stored for the trainee app to show on the plan card; applying them as the trainee's targets is TCR-002 (coach-set targets).
- Sync: the plan comes down in the trainee's normal pull; `status = 'ended'` rows tell the phone to drop the plan card.
- Offline: the phone stores the active plan and can start a plan day offline; `plan_id`/`plan_day` ride the workout's normal outbox push.

## 6. API changes in the trainee server
- Sync pull includes the trainee's own non-draft plans. No route lets the trainee create, edit or delete a plan (403 `plan_read_only`).
- Workout push accepts optional `plan_id` and `plan_day`; the server checks the plan belongs to the user, else 400 `invalid_plan`.

## 7. Rules and permissions
- Only the coach server's database role writes `app.training_plans` (TCR-005 gives it its own login).
- A trainee sees only their own plans, never drafts, never another trainee's.
- Plans of an ended link stay visible but read-only and not "current" (C-D28).
- Deleting the account cascades.

## 8. Acceptance criteria
- Given a published plan, when the trainee syncs, then the card and days show with the exact copy of §4.
- Given the coach has unpublished edits, then the trainee sees only the last published version (this table only ever holds published content).
- Given a workout in progress, when the coach publishes v2, then the session keeps v1's targets.
- Given the trainee tries to edit or delete a plan, then the server refuses (403) and the UI offers no control.
- Given the link ends, then no new plan appears and the active plan stops being current.
- Given a past workout, then it still shows the plan name and version it followed.
- Given another user's plan id in `plan_id`, then the push is refused (400).
- Offline: the plan and Start work without internet; the log syncs later.

## 9. Tests Developer 1 should add
Migration test (constraints, one-active index, cascade); API tests (read-only, `invalid_plan`, cross-user isolation); sync test (publish, new version, ended); UI test (card, Start pre-fill, locked); phone check with a synthetic plan.

## 10. How the coach side depends on it
The coach server checks that `app.training_plans` exists (ADR-0002 rule 2). If absent, Publish answers "not found" and plans stay drafts. The coach side is built and tested against this exact table, copied into `apps/api/test/fixtures/proposed-app/0010_tcr003_proposed.sql`. If Developer 1 changes the SQL, tell the coach team so the copy and the publish query change too. On publish the coach server writes the row with the plan's own id (insert, or update on a new version) and sets the replaced plan's row to `ended` first, in one transaction.

## 11. Rollout
1. Owner approves CF06 UI, answers §12, sends this to Developer 1.
2. Developer 1 merges and applies the migration; owner tells the coach team.
3. The coach team refreshes the fixture copy, turns Publish on. Either side may ship first safely (drafts only until then).

## 12. Open questions
1. Is the plan JSON in one `days` column acceptable, or does Developer 1 prefer separate day/exercise tables?
2. A plan day holds up to 12 exercises with up to 6 sets each; the trainee's own workouts allow 30 exercises. May a trainee add exercises to a workout started from a plan day, up to the existing 30? (Proposed: yes.)
3. Exercise names are free text in the trainee app today. Does Developer 1 want a shared exercise library table later (see CF06 question 2)?
4. The owner's eight CF06 answers are in `docs/design/CF06-workout-management-ui.md` §5. Still open for the owner: what the trainee sees when the link ends. Proposed: the plan stops being current and history stays.
