# Project Instructions for Claude Code — FitSphere Coach

## Purpose
FitSphere Coach is the coaches' app for FitSphere. Head Coaches manage their Coaches; Coaches manage
their trainees: targets, diet and training plans, and following what trainees log in the FitSphere
app. It is a **separate app in its own repo** (decision C-D1) that shares **one Supabase project**
(the same sign-in accounts and the same PostgreSQL database) with the trainee app.

- Trainee app repo: `pradeepKumawatPalara/fitsphere` (Developer 1). Its rules and requirements
  (REQ-ROLE-001 to 017, owner decisions D-06, D-10, D-11, D-13, D-14) are the accepted coach rules
  this app follows (C-D3).
- This repo: `pradeepKumawatPalara/fitsphere-coach` (Developer 2).

## Current phase (updated 2026-11-03)
Work moved from the Claude chat to Claude Code in VS Code on the coach developer's PC
(`C:\fitsphere-coach`). Screen design and specs may still happen in the Claude chat; building,
running and fixing happen here.

- **CF00 Foundation — done.** Migration C0001 applied to the shared Supabase project.
- **CF01 Coach sign-in — built and merged (PR #3, crash fix PR #4); owner's phone check in progress.**
  Migration C0002 applied. Supabase Redirect URLs `exp://**` and `fitspherecoach://**` added.
  The app runs in **Expo Go** (no `react-native-svg`: Expo Go on the owner's phone lacks it).
  The phone reaches the API on this PC at `http://192.168.1.50:3100` (Wi-Fi, `HOST=0.0.0.0`).
  Next: finish the phone check (runbook §6: sign up → verify link → "You're in" → "Coaching is
  off"; log in errors; forgot/change password; log out). Fix what it finds, one PR per fix.
- **Scope changed on 2026-11-03 (v0.4, `docs/product/coach-scope.md`, C-D10 to C-D15):** gyms are
  onboarded and approved by FitSphere with a 6-digit code emailed to `appbayaipower@gmail.com`;
  Coaches join only by a Head Coach's invitation; Head Coach powers; change log on plans;
  only the person higher up adds or removes (C-D18, 2026-11-04).
- **Next feature: CF02 — gym onboarding and FitSphere approval code.** The owner answered
  coach-scope §11 Q1–Q5. Every account without a coach role, trainee or not, goes to gym onboarding;
  log in never reveals whether an email exists; limits live in a configuration file (C-D17). Do not
  build CF02 until the owner accepts **C-D16** (approval email sent through Gmail with an app
  password), then design its screens and wait for "UI approved".
- **Blocked by C-D7 (owner to decide):** the trainee side of CF03 (a trainee accepting an invite),
  CF04, and coach-set targets and plans (CF05–CF07).

On this PC: install packages with `npm ci` (not `npm install`, which rewrites
`package-lock.json` on Windows). Never commit `.env` files. Before `npm run migrate`, the change
must be merged.

## Sources of truth
- Decisions for this repo (C-D IDs): `docs/decisions/README.md`
- **Scope of record: `docs/product/coach-scope.md` (v0.4)** — roles, gym onboarding, permissions,
  feature plan and the owner's open questions (§11). Read it before any feature work.
- Coach product spec (detailed requirements, IDs CAUTH-, TRNE-, CTGT-, CDIET-, MON- …):
  `docs/product/coach-spec.md` (v0.3). Where it disagrees with the scope or the C-D decisions,
  **the scope and the decisions win**.
- Shared database contract: `docs/contracts/shared-database.md` — **read before any migration or any
  query that touches schema `app`.**
- Design system: `docs/design/design-system.md`; locked feature UI docs: `docs/design/CF*.md`
- Feature board: `docs/features/README.md`
- Runbook (setup, configuration names, commands): `docs/operations/runbook.md`
- Always-on invariants: `.claude/rules/project-invariants.md`

## Organisation standards — follow on every task
The organisation's standards live in `docs/standards/`. Read the ones that apply **before** you
plan, code, test, review or decide, and follow them on every task:

| Standard | File | Read it when |
|---|---|---|
| Generic code practices (CC, VA, ER, SE, DB, AP, PF, DC, LG, UI, CO, CM rules) | `docs/standards/generic-code-practices.md` | **Every code change**, before writing code and again before reporting done (CM-3 diff review) |
| IT testing rules (GOV, REQ, PLAN, DES, TDATA, API, DATA, SEC, UI, AUTO, REG, DEF, CICD, REL …) | `docs/standards/testing-rules.md` | Writing or changing tests, planning a feature's tests, deciding "done", and before any release |
| Architecture decision framework (weighted scoring; security, privacy and legal are pass/fail) | `docs/standards/architecture-decision-framework.md` (Markdown copy of the `.docx`) | Any architecture or technology choice, including adding a framework or a major dependency |
| Decision record format (Proposed → Accepted only by the owner; supersede, never rewrite) | `docs/standards/decision-record-template.md` | Recording a decision. This repo's decisions live in `docs/decisions/README.md` with **C-D** IDs; new entries follow this template's fields and statuses |
| Starting the application with Claude Code (process guide) | `docs/standards/starting-with-claude-code.md` | Setting up tooling and the per-feature "done" checklist |

How to apply them:
- **Precedence when rules conflict:** law and security, then this file's project rules (C-D7, the
  shared database rules, the invariants and Accepted C-D decisions), then the project's existing
  conventions, then these standards. Name any conflict in the pull request instead of choosing
  silently (generic code practices, "How to read this file").
- **Cite the rule IDs** you applied or deviated from in the pull request (for example "SE-3, DB-1,
  AUTO-…"), and state the reason for any **SHOULD** you did not follow.
- **Done means** the standards' checklist too: acceptance criteria including failure and permission
  cases pass; format, lint, type-check, tests and build were run and reported, with what was not
  verified; no test deleted, skipped or weakened; the final diff reviewed (CM-3).
- Claude never marks its own decision **Accepted**; the owner does.
- Known gaps: `generic-code-practices.md` refers to `standards-sources.md`, and the start guide
  refers to a skills zip (`.claude/skills/`); neither is in this repo yet. Say so if a task needs them.

## Approved stack (C-D5, same as the trainee app)
- Phone app: React Native with Expo (expo-router), TypeScript, in `apps/mobile`. Starts on
  **Expo Go**; move to an EAS development build only when a native module needs it, and tell the
  owner before every cloud build.
- Backend: a TypeScript Node.js API (Fastify, `pg`, `jose`) in `apps/api` — **the only path to the
  data**. The phone app never talks to the database. Supabase's Data API stays off.
- Sign-in: Supabase Auth (shared with the trainee app). Every request's token is checked in
  `apps/api/src/auth.ts`, and every route declares an access rule in `apps/api/src/access.ts`.
- Database: the shared Supabase PostgreSQL. This repo owns schema **`coach`** only.

## No impact on the trainee app (C-D7) — highest priority
Never suggest or make a change that affects Developer 1 or the trainee app (`fitsphere` repo,
schema `app`, its migrations, its API or its app). In particular:
- no edits, branches or pull requests in the `fitsphere` repo, and no requests for Developer 1 to
  change anything;
- no change to how existing `app` data looks to the trainee app: the coach API writes to `app`
  only rows the trainee app already ignores, or does not write at all;
- coach work lives only in this repo and schema `coach`.
If a coach feature cannot work without a trainee-app change (for example, a trainee accepting an
invite or seeing coach-set targets), stop and tell the owner; never plan that change yourself.

## Shared database rules (summary — the contract has the full text)
1. This repo creates and changes tables **only in schema `coach`**. Never create, alter or drop
   anything in schema `app`. If a coach feature seems to need an `app` change, stop and tell
   the owner (C-D7).
2. Migrations are `apps/api/migrations/C0001_name.sql`, recorded in `coach.schema_migrations`.
   A file that was applied is never edited; add a new one.
3. The API writes to `app` only what the contract allows and C-D7 permits (rows the trainee app
   ignores); everything else in `app` is read-only, and only through the access rules.
4. Every `coach` table that points at a user cascades on delete, so account deletion keeps working.
5. Tests use a local or CI database, never Supabase. Migrations reach the shared project only after
   the pull request is merged, and only when the owner says so. They add tables in schema `coach`
   only, so they never affect the trainee app.
6. `apps/api/test/fixtures/app-schema/` is a **copy** of the trainee repo's migrations, used only
   to build schema `app` in the test database. Refresh it when the trainee repo adds a migration;
   never apply it to Supabase.

## Working rules
1. One feature at a time, in the order of the board: UI designed → owner approves → build (API,
   database, screens, tests) → owner tries it on the phone → done.
2. Inspect the repository and the contract before changing anything. Do not invent requirements;
   open questions go to `docs/product/coach-spec.md` §16.
3. Treat health, body and meal data as sensitive in code, logs, tests and fixtures. Synthetic data
   only.
4. Add or update tests for behaviour changes. Report exactly which checks passed, failed or were not
   run.
5. One branch and pull request per step; CI must pass before merge.
