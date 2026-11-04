# ADR-0001: System architecture and boundaries

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | The whole FitSphere Coach system: phone app, coach server, and its connection to the shared Supabase project |
| **Related decisions** | C-D1, C-D2, C-D5, C-D22 |
| **Supersedes** | None |
| **Framework** | `docs/standards/architecture-decision-framework.md` (pass/fail gates, then weighted score) |

## Context
- FitSphere Coach lets gyms, Head Coaches and Coaches manage trainees who use the separate FitSphere
  (trainee) app.
- Both apps must use the same accounts and the same data: coaches see what trainees log, and what
  coaches create must reach the trainee app.
- The trainee app already exists, built by Developer 1 in the `fitsphere` repo. Its server is the
  only path to its data, and Supabase's direct data access is turned off.
- **Rule C-D22:** the coach team never edits the trainee app. Changes the trainee app needs are
  written as change requests and built by Developer 1.
- The team is one developer working with Claude.
- The coach server runs on the developer's PC for now; hosting is decided in ADR-0010.

## Decision criteria

**Pass/fail gates** (an option that fails any gate is out, whatever its score):
1. **Security and privacy:** every permission is checked on a server the coach team controls; the
   phone never reads the database directly.
2. **Ownership (C-D22):** the coach team never edits the trainee app (repo, server, schema `app`,
   screens or shared Supabase settings it relies on). Trainee-app changes go to Developer 1 as change
   requests; the coach product itself does not live in Developer 1's repo (C-D1).
3. **Shared accounts and data:** one login for both apps, and the coach sees the trainee's real data.

**Weighted criteria:** security 20%, maintainability 20%, reliability 15%, performance 15%,
scalability 10%, cost 10%, integration 10%.

## Options considered

| Option | Description | Gate 1 | Gate 2 | Gate 3 |
|---|---|---|---|---|
| **A** | **Separate coach app + its own coach server (one service), in its own repo, on the same Supabase project** | Pass | Pass | Pass |
| B | Coach screens inside the trainee app, with a role switch | Pass | **Fail**: the coach product would live in the trainee repo and be built there | Pass |
| C | Separate coach app reading Supabase directly (direct data access, live feed) | **Fail**: the phone reaches the data; permissions only in database rules | **Fail**: needs Supabase settings the trainee app relies on to change | Pass |
| D | Separate coach app calling new coach endpoints in the trainee server | Pass | **Fail**: the coach server logic would live in the trainee repo | Pass |
| E | Separate coach app + several small coach services | Pass | Pass | Pass |

**Scores for options that pass every gate** (1–5, judgment based on the assumptions below):

| Criterion (weight) | A: one coach server | E: several services |
|---|---|---|
| Security (20%) | 4 — one place for permission checks | 4 — same checks, spread across services |
| Maintainability (20%) | 4 — one codebase, clear modules | 2 — many deployments for one developer |
| Reliability (15%) | 4 — few moving parts | 3 — more network links that can fail |
| Performance (15%) | 4 | 4 |
| Scalability (10%) | 3 — scales as one unit | 5 — parts scale separately |
| Cost (10%) | 5 — one service to run | 2 — several to host and monitor |
| Integration (10%) | 4 — one connection to Supabase | 3 |
| **Weighted score** | **80 / 100** | **65 / 100** |

**Assumptions:** phase 1 has tens of gyms and hundreds of trainees; one developer; the free or
low-cost Supabase plan. Revisit the scores if any of these changes materially.

## Decision
**Option A.** A separate FitSphere Coach phone app with its own coach server, in its own repo, both
using the same Supabase project.
- **Phone app:** Expo (React Native) and TypeScript.
- **Coach server:** one Node.js + TypeScript service (Fastify), built as a **modular monolith** with
  clear internal modules: sign-in and permissions, accounts, gym onboarding, gyms and memberships,
  invitations, trainees, targets and plans, change log.
- **The coach server is the only path to the data.** The phone app never connects to the database.
- **Supabase:** shared sign-in (Supabase Auth) and the shared PostgreSQL database. The coach team owns
  schema `coach` (ADR-0002); schema `app` belongs to the trainee repo.
- **Trainee-app side of coach features:** delivered by Developer 1 from change requests in
  `docs/handoff/trainee-app/` (C-D22).

## Why this option wins
- It is the only kind of option that passes all three gates, and it scores higher than E.
- All permission checks sit in one server the coach team controls (generic code practices SE-3,
  VA-1).
- One service suits one developer; the framework names the modular monolith as the starting point.
- The same technology as the trainee app keeps both apps familiar and comparable.

## Why the alternatives were rejected
- **B, D:** the coach product or its server logic would be built inside the trainee repo, against
  C-D1 and C-D22.
- **C:** exposes data to the phone and needs shared Supabase settings changed.
- **E:** passes the gates but costs more and is harder to run, with no benefit at this size.

## Consequences
- **Benefits:** the coach team works only in its own repo; one server holds every permission check;
  simple to build, test and run.
- **Trade-offs:**
  - Two servers read and write some of the same account tables, which needs strict ownership rules
    (ADR-0002).
  - Some code is copied from the trainee app (token checks, error format) instead of shared.
  - Live updates come from the coach server, not Supabase's live feed.
  - Coach features that need the trainee app go live only when Developer 1's change is merged.
- **Risks and mitigations:**
  - The trainee app changes its tables without the coach team knowing → coach tests build schema
    `app` from a copy of the trainee migrations, refreshed when they change.
  - Change requests and the coach side drift apart → each request is written when its coach feature
    is designed, and both sides are tested together before going live.
  - Hosting is still open → ADR-0010.

## Implementation guidance
- Every coach route declares an access rule; a route without one cannot be registered.
- The phone app reaches data only through the coach server.
- Coach database changes go only into schema `coach`, through the coach migration runner.
- Anything the trainee app must do is written as a change request, never built in the `fitsphere`
  repo.

## Validation
- CI runs database tests that build the trainee tables and the coach tables together, on every pull
  request.
- The migration runner refuses any coach migration that changes schema `app`.
- Every coach route has a permission test for allowed and refused callers.
- Each feature is checked on a real phone before it is done.

## Reconsider when
- The coach product moves into the trainee app by the owner's decision (B or D become possible).
- Load grows far beyond phase 1, with measurements showing one service is the bottleneck (E).
