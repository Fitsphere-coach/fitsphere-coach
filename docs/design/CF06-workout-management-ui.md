# CF06 — Workout management (SPEC-002): UI design (DRAFT, owner review)

| | |
|---|---|
| **App** | FitSphere Coach (Expo, iOS + Android) |
| **Status** | **UI approved by the owner, 2026-11-11.** Screens are in the "FitSphere Coach Screens" canvas (rows "SPEC-002 · Workout management", dark and light: templates, plans, editor, exercise picker, assign, plan detail, publish, history). **Built: the coach API** (migration C0004, templates, plans, versions, change log, publish into the trainee table) **and the phone screens** (2.1 to 2.7), with tests. Publish stays off until TCR-003 exists. Owner's phone check pending (`docs/operations/runbook.md` §8). |
| **Source spec** | `spec/SPEC-002-workout-management.md` (business draft) and `docs/product/coach-spec.md` CTRN-001…004, EXL-001…002, TPL-001…003. Where they disagree with `docs/product/coach-scope.md` v0.4 or a C-D decision, the scope and the decisions win (CLAUDE.md). |
| **Depends on** | CF04 (clients exist), **TCR-003** (training plans in the trainee app; Developer 1, C-D22; drafted in `docs/handoff/trainee-app/TCR-003-training-plans.md`) |
| **Scope/decisions** | coach-scope §3, §6; C-D12, C-D13, C-D15, C-D18, C-D22, C-D27, C-D28; ADR-0002 |

All visual values come from `docs/design/design-system.md`. UPPERCASE text is rendered by the style.

## 1. How SPEC-002 maps to the scope

| SPEC-002 says | What the product does | Why |
|---|---|---|
| "Gym Owner" manages templates and plans | The owner **is** the Head Coach (owner answer, 2026-11-11) | coach-scope §2 |
| Coach may create shared templates — to be confirmed | **Open question Q1** below. Proposed: Head Coach makes gym-wide templates; a Coach makes personal ones and can use gym-wide ones | CQ-10 |
| Plan statuses Draft / Active / Completed / Inactive | **Draft, Active, Ended.** A new published plan ends the previous one (one active plan per trainee). Completed vs discontinued is not separate until the owner asks | CTRN-004 AC1 |
| Assigned plan keeps the content assigned, template edits do not change it | Same: assigning **copies** the template into a draft plan (TPL-002 AC1) | SPEC-002 §5.5 |
| "Make plans available for scheduling in the Calendar Dashboard" | Out of CF06. A published plan is stored so CF09 / SPEC-004 can schedule it later | CF09 |
| "Client views assigned plan" | The trainee sees it in the Training tab — **TCR-003** | C-D22 |
| Change history | Every edit and publish logs who (name, role) and when (C-D13) | invariant 13 |
| Exercise library | The trainee app has **no exercise table**; workouts hold free-text exercise names. CF06 builds the library on the coach side (seed list + custom exercises) | `0007_workouts.sql`; Q2 |

## 2. Screens

### 2.1 Workouts home (new bottom-tab "WORKOUTS")
Title "WORKOUTS" · segmented control **Templates / Plans** · search · filter chips by goal (Weight loss, Muscle gain, Strength, General fitness, Endurance, Mobility) and difficulty (Beginner, Intermediate, Advanced) · rows (name, goal, difficulty, "{n} days · {m} exercises", "Gym" or "Mine" tag, last edited) · primary "NEW TEMPLATE".
- **Plans** tab: the plans of the viewer's trainees (Head Coach: all, with a coach filter). Row: trainee, plan name, status chip (Draft / Active / Ended), "Week {n} of {m}".
- States: loading, empty ("NO TEMPLATES / YET" with "NEW TEMPLATE"), no results ("Nothing matches."), offline (cached, read-only), error.

### 2.2 Template or plan editor
Back · name field · **Goal**, **Category**, **Difficulty** pickers · Duration (min) · **Weeks** (a number, or "Ongoing") · notes · **Days** list (reorder, add): each day has a name ("Day 1 · Push"), type **Training / Rest**, and exercises in order.
- **Exercise row:** name, "3 × 8–10 · Rest 2:00", optional weight, optional RPE, note, drag handle, remove. "ADD EXERCISE" opens the library picker (2.3). Superset: select two or more rows → "GROUP AS SUPERSET".
- Rest time default 2:00 per exercise (CTRN-002 AC3).
- Autosaves as a draft. Top-right "…": Copy, Deactivate (templates), Save as template (plans), History (2.6).
- Limits: up to 7 days, 12 exercises per day, 6 sets per exercise (matches the trainee app's 30-exercise workout check). Weights are shown in the viewer's unit and stored in whole grams (invariant 5).
- Validation (inline, under the field): name required, ≥ 1 training day, every training day has ≥ 1 exercise, sets 1–6, reps 1–100, rest 0:15–10:00.

### 2.3 Exercise library picker
Search by name · filter chips by muscle (Chest, Back, Shoulders, Arms, Legs, Core, Full body) and equipment (Bodyweight, Dumbbell, Barbell, Machine, Cable, Band, Other) · rows (name, muscle · equipment, "Custom" tag) · tap opens a detail sheet (steps, target muscles, equipment, video link) · "ADD". A coach can add a **custom exercise** (name, muscle, equipment, steps, optional video link); it shows to the gym (EXL-002).
- Editing a custom exercise changes its library entry only; plans keep the name they were saved with.

### 2.4 Assign a plan to a client
From a template ("ASSIGN") or a client profile ("Training plan" row on CF04's Plans card): pick one or more clients (a Coach sees their own; the Head Coach sees all) · start date (today or later, Asia/Kolkata, invariant 4) · "CREATE DRAFTS".
- Each client gets their own **draft copy**. Later template edits never change it (TPL-002 AC1). Bulk assign makes drafts only; nothing goes live without a publish (Q4).
- Client already has an active plan: info banner "This replaces {Plan} from {date}." shown at publish.

### 2.5 Plan detail and publish
Header: trainee, plan name, status chip, version · days list with exercises · change-log line "Last changed by Ravi (Coach), 11 Nov 2026, 4:12 pm" · "PUBLISH" (primary), "DISCARD DRAFT".
- **Publish** sheet: "PUBLISH TO {NAME}?" · "{Name} sees this plan in their Training tab straight away. It replaces {Old plan}, which ends on {date}. Workouts they already logged keep the plan they followed." · "PUBLISH", "NOT YET".
- A published plan opens as a **new draft version** when edited; the trainee keeps seeing the live version until the next publish. A workout in progress is never altered (CTRN-004 AC2).
- "END PLAN" (sheet, confirm): status becomes Ended; the trainee's Training tab returns to their own logging.
- Until TCR-003 is built, "PUBLISH" is hidden; plans stay drafts ("Waiting for the FitSphere app update.") — same pattern as CF04's switched-off invite.

### 2.6 History
List newest first: "Published v3", "Edited Day 2", who (name and role), when. Any earlier version can be viewed and **restored as a new draft** (CDIET-006 AC3 pattern). A Coach sees only plans they may open; the Head Coach sees all of the gym's plans.

### 2.7 Deactivate template (sheet)
"DEACTIVATE {NAME}?" · "It stays out of the list. Plans already made from it are not changed." · "DEACTIVATE", "KEEP". Deactivated templates are under a "Show inactive" toggle and can be restored.

## 3. Rules the server enforces (not the screens)
- A Coach opens, edits and publishes plans only for **their own trainees**; the Head Coach for every trainee of the gym (C-D12). Never a Coach's own personal training (C-D15).
- Plans need an **accepted, active link**. A plan for a trainee whose link ended is read-only (C-D28).
- Templates: a gym-wide template is created, edited and deactivated by the Head Coach only (proposal, Q1); personal templates by their author.
- One active plan per trainee; publishing ends the previous one, in the same transaction.
- Every create, edit, publish, end and restore writes a change-log row (who, role, when) in the same transaction as the plan change (ADR-0002 rule 3, C-D13).
- A trainee **cannot edit** a coach's plan; coach input wins (invariant 2).
- Content limits as in 2.2; health-adjacent notes are never logged (invariant 6).
- Write to `app` only through the new plan tables from TCR-003; stays off until the server finds them at startup (ADR-0002 rule 2).

## 4. Not in CF06
Calendar scheduling (CF09 / SPEC-004); week-by-week progression (CTRN-005, later, CQ-27); nutrition (CF07); a Gym Owner role; videos uploaded to FitSphere (links only); trainees rating plans.

## 5. Owner's answers (2026-11-11)
1. **Templates:** a Coach **can** create gym-wide templates. Its author and the Head Coach edit or deactivate it; a personal template is private to its author.
2. **Exercise library:** **ten fixed exercises kept in the code for now** (Bench press, Back squat, Deadlift, Overhead press, Pull-up, Dumbbell row, Lunge, Push-up, Plank, Biceps curl); a bigger library and custom exercises come later.
3. **Statuses:** Draft, Active, Ended are enough. The status is shown **first** on the plan screen.
4. **Bulk assign:** creates drafts for review, never a live plan.
5. **Set targets:** reps range, optional weight, optional RPE and supersets are enough for the first release.
6. **Schedule:** **both**, weekdays pinned or a rotating sequence.
7. **Targets:** the coach chooses a **weekly** workout target, a **daily** goal on training days, both or neither (two switches in the editor).
8. **Editing a live plan:** edits make an unpublished new version; the client keeps the live one until the coach publishes.

Still open (not blocking): what the trainee sees when the link ends. Built as: the plan stops showing in the coach app (like other ended links); the trainee-side rule is in TCR-003.

## 6. What was built (coach side, 2026-11-11)
- Migration `C0004_workout_management.sql` (schema `coach`): `workout_templates`, `training_plans` (the working copy, one active and at most one draft per client), `plan_versions` (what was published, with the name), `plan_changes` (the change log, C-D13).
- Shared schemas and the ten exercises: `packages/shared/src/workouts.ts`.
- API: `apps/api/src/workouts.ts`, `plans.ts`, `routes/workouts.ts` (routes listed at the top of that file). Publish writes the trainee's row in `app.training_plans` in the same transaction; it answers "not found" while that table does not exist (ADR-0002 rule 2).
- Tests: `apps/api/test/integration/workouts.test.ts` (22 cases: access, validation, drafts, versions, log, publish, rollback) and `packages/shared/src/workouts.test.ts`. The test copy of TCR-003's table is `apps/api/test/fixtures/proposed-app/0010_tcr003_proposed.sql`.
- Phone screens (`apps/mobile/src/app/`): `workouts.tsx` (templates and plans), `workout-template.tsx` (editor, copy, deactivate), `workout-assign.tsx`, `workout-plan.tsx` (status first, publish, end, discard), `workout-plan-edit.tsx`, `workout-history.tsx`; shared editor in `src/workouts/ContentEditor.tsx`. Tests: `apps/mobile/src/workouts.test.tsx`.
- Differences from the Canva screens, for the owner to confirm: exercises are reordered with Up and Down buttons (no drag); the start date uses earlier and later day buttons (no calendar); weights are shown in kg; "Edit plan" is its own screen; a plan's Training row on the client profile opens the Plans tab.
- Next: the owner's phone check, then apply C0004 once the pull request is merged.
