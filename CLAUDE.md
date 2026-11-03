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

## Sources of truth
- Decisions for this repo (C-D IDs): `docs/decisions/README.md`
- Coach product spec (C- requirement IDs, open questions CQ-): `docs/product/coach-spec.md`
  — v0.3 still describes organisations and direct Supabase access; where it conflicts with C-D3 or
  C-D5, **C-D3 and C-D5 win** until the spec is updated to v0.4.
- Shared database contract: `docs/contracts/shared-database.md` — **read before any migration or any
  query that touches schema `app`.**
- Design system: `docs/design/design-system.md`; locked feature UI docs: `docs/design/CF*.md`
- Feature board: `docs/features/README.md`
- Runbook (setup, configuration names, commands): `docs/operations/runbook.md`
- Always-on invariants: `.claude/rules/project-invariants.md`

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
