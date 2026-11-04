# ADR-0002: Shared database ownership, migrations and where coach data lives

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | Every table the coach server reads or writes, and how database changes reach the shared Supabase project |
| **Related decisions** | ADR-0001, C-D2, C-D13, C-D22 |
| **Supersedes** | None |

## Context
- Both apps use one PostgreSQL database. The trainee app owns schema **`app`**; the coach app owns
  schema **`coach`** (ADR-0001).
- Coaches create data the **trainee app must show and sync** (targets, training plans, diet plans,
  the coach link) and data **only the coach app uses** (gyms, onboarding requests, invitations, the
  full change history, notes).
- The trainee app works offline and pulls changes through its own sync, which relies on a change
  counter on its `app` tables.
- The coach team never edits the trainee app or schema `app`; changes there are built by Developer 1
  from change requests (C-D22).
- Question decided here: where coach-created data that trainees see lives.

## Decision criteria
**Pass/fail gates:**
1. **Security:** only the two servers reach the data; phones never do.
2. **Ownership (C-D22):** nothing the coach team does alone can break the trainee app.
3. **Trainee sees coach data:** the trainee app can show and sync coach-created data, offline too.

**Weighted criteria:** security 20%, maintainability 20%, reliability 15%, performance 15%,
scalability 10%, cost 10%, integration 10%.

## Options considered

| Option | Description | Gate 1 | Gate 2 | Gate 3 |
|---|---|---|---|---|
| **A** | **Split by who reads it:** data the trainee app shows lives in `app` (tables created by Developer 1 from change requests; the coach server writes into them); coach-only data lives in `coach` | Pass | Pass | Pass |
| B | Everything coaches create lives in `coach`; the trainee server reads `coach` tables | Pass | **Fail**: a coach migration could break the trainee app | Pass, but outside the trainee sync |
| C | Everything, even coach-only data, lives in `app`, created by Developer 1 | Pass | Pass | Pass |

| Criterion (weight) | A | C |
|---|---|---|
| Security (20%) | 4 | 4 |
| Maintainability (20%) | 4 — each team owns what it uses | 2 — every coach-only change waits for Developer 1 |
| Reliability (15%) | 4 | 4 |
| Performance (15%) | 4 | 4 |
| Scalability (10%) | 4 | 4 |
| Cost (10%) | 4 | 2 — Developer 1's time on coach-only tables |
| Integration (10%) | 4 — trainee data uses the trainee sync as it is | 3 |
| **Weighted score** | **80 / 100** | **66 / 100** |

## Decision
**Option A: data lives where the app that shows it lives.**

| Data | Lives in | Created by | Written by | Read by |
|---|---|---|---|---|
| Accounts and roles (`app.users`, `app.user_roles`) | `app` (exists) | Trainee repo | Both servers, as the shared database contract allows | Both |
| Coach ↔ trainee links (`app.links`) | `app` (exists) | Trainee repo | Coach server, after TCR-001 | Both |
| Targets (`app.targets`, has a "set by" column) | `app` (exists) | Trainee repo | Coach server, after TCR-002 locks them | Both |
| Training plans | `app` (new) | Developer 1, from TCR-003 | Coach server | Both |
| Diet plans | `app` (new) | Developer 1, from TCR-004 | Coach server | Both |
| Trainee logs: meals, workouts, weight, steps, sleep, measurements | `app` (exists) | Trainee repo | Trainee only | Both (coach: read only) |
| Gyms, onboarding requests, gym memberships, coach and trainee invitations | `coach` | Coach repo | Coach server | Coach server |
| Coach names and terms | `coach` (exists) | Coach repo | Coach server | Coach server |
| Full change history of targets and plans (C-D13) | `coach` | Coach repo | Coach server, in the same transaction as the change | Coach server |
| Private coach notes, flags, check-in reviews | `coach` | Coach repo | Coach server | Coach server |

### Rules
1. **Migrations:** the coach repo migrates only `coach`, through its runner and guard. New `app`
   tables are written as SQL in a change request and applied by Developer 1.
2. **Order of release:** a coach feature that writes to a new `app` table stays off until the coach
   server confirms at startup that the table exists, so either side can ship first safely.
3. **One transaction:** a change to a plan or target writes the `app` row and the `coach` history row
   together; both succeed or neither does (generic code practices DB-1). The history row stores the
   ID of the plan or target it describes.
4. **Trainee sync:** new `app` tables follow the trainee app's existing pattern (change counter and
   "touch" trigger), specified in each change request, so trainees get coach changes through their
   normal sync.
5. **Tests:** coach tests build `app` from a copy of the trainee migrations (plus agreed change-request
   SQL), then add `coach` on top. Tests never run against Supabase.
6. **Account deletion:** every `coach` table that points at a person is deleted with that person.

### Separate database logins in production (owner, 2026-11-04)
- **Before real users, each server has its own database login** with only the access it needs
  (generic code practices DB-7, SE-3):

  | Login | `app` | `coach` |
  |---|---|---|
  | Trainee server | Full access | None |
  | Coach server | Read all; write only the agreed tables (links, targets, plans, accounts and roles as the contract allows) | Full access |

- Setting the coach login's `app` permissions is a change to schema `app`, so it is a **change
  request for Developer 1**, written and delivered before the first real user.
- **Until then:** both servers share one login. This is allowed **only in development, with test
  accounts**. Known effects: the coach server has more access than it needs, and a password change
  by Developer 1 stops the coach server until its `.env` is updated.

## Why this option wins
- It passes every gate and scores highest.
- The trainee app keeps full control of everything it shows and syncs; the coach team moves on its
  own for coach-only data.

## Why the alternatives were rejected
- **B:** coach changes could break the trainee app, and coach data would sit outside the trainee
  sync.
- **C:** every coach-only change would wait for Developer 1, with no benefit.

## Consequences
- **Benefits:** clear ownership; trainees get coach changes through the sync they already have.
- **Trade-offs:** plans need Developer 1 to create their tables before the coach side goes live; the
  change history (`coach`) is separate from the data it describes (`app`), linked by IDs and written
  in one transaction.
- **Risk until production:** the shared database login (above).

## Validation
- Database tests: the coach runner refuses `app` changes; data and history write together or not at
  all; deleting an account removes its `coach` rows.
- Per change request: an end-to-end check that a coach's change shows in the trainee app after sync,
  once Developer 1's side is merged.
- Before the first real user: the coach server runs with its own login, and a test confirms it
  cannot change `app` structure or write outside the agreed tables.

## Reconsider when
- The trainee app needs to read coach-only data (move it to `app` through a change request).
- The two apps merge into one repo.
