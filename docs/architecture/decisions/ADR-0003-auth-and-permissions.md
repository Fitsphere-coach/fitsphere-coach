# ADR-0003: Sign-in and permissions

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | How the coach server knows who is calling and decides what they may do |
| **Related decisions** | ADR-0001, ADR-0002, C-D10, C-D11, C-D12, C-D15, C-D18, C-D19, C-D20, C-D21, C-D22, C-D23, C-D24 |
| **Supersedes** | None |

## Context
- **Roles:** Head Coach (owns one approved gym), Coach (belongs to one gym, by invitation), Trainee
  (linked to one Coach or to the Head Coach, by accepting an invitation).
- **Permissions decided:** the Head Coach can do for every trainee in the gym what a Coach can and
  sees each trainee's Coach (C-D12); never sees a Coach's own personal training (C-D15); only the
  person higher up adds or removes (C-D18); a trainee is in a gym only once (C-D19); a Coach with
  trainees cannot be removed (C-D20); the Head Coach adds a trainee under self or under a Coach
  (C-D21).
- Both apps share Supabase sign-in. Roles are already stored in the shared table `app.user_roles`
  (`personal`, `coach`, `head_coach`).

## Decision criteria
**Pass/fail gates:**
1. **Security:** every permission is checked on the server, on every request; hiding a button is
   never protection.
2. **Ownership (C-D22):** no change to the trainee app or to the structure of schema `app`.
3. **Immediate effect:** removing a Coach or ending a link cuts access at once, not when a token
   expires.

**Weighted criteria:** security 20%, maintainability 20%, reliability 15%, performance 15%,
scalability 10%, cost 10%, integration 10%.

## Options considered

| Option | Description | Gate 1 | Gate 2 | Gate 3 |
|---|---|---|---|---|
| **A** | **One access module in the coach server**: every route declares its rule; each request checks the caller's role and gym relationships from the database | Pass | Pass | Pass |
| B | Database row rules (PostgreSQL row-level security policies) | Pass | **Fail**: needs policies on `app` tables | Pass |
| C | Roles inside the sign-in token (custom claims) | Pass | **Fail**: changes the shared Supabase sign-in setup | **Fail**: a removed Coach keeps access until the token expires |
| D | An external permissions service (for example OpenFGA) | Pass | Pass | Pass |

| Criterion (weight) | A | D |
|---|---|---|
| Security (20%) | 4 | 4 |
| Maintainability (20%) | 4 — rules next to the code, tested together | 3 — a second system to keep in step |
| Reliability (15%) | 4 | 3 — another service that can fail |
| Performance (15%) | 4 — one database lookup | 3 — an extra network call per request |
| Scalability (10%) | 4 | 5 |
| Cost (10%) | 5 | 2 |
| Integration (10%) | 4 | 3 |
| **Weighted score** | **82 / 100** | **67 / 100** |

## Decision
**Option A: one access module in the coach server.**

### 1. Who is calling (authentication)
- The phone signs in with Supabase (shared with the trainee app) and sends its sign-in token on every
  request.
- The coach server checks the token's signature against the Supabase project's public keys, its
  issuer and its expiry (built in CF00).
- The server then reads the caller's account, roles and gym **from the database on every request**,
  so a removal takes effect immediately.

### 2. Where roles come from

| Role | Saved as | Created when | Removed when |
|---|---|---|---|
| Head Coach | `head_coach` row in `app.user_roles` + gym record in `coach` | The approval code is accepted (C-D10) | Not in scope yet |
| Coach | `coach` row in `app.user_roles` + gym membership in `coach` | The Coach accepts the invitation (C-D11) | The Head Coach removes them, after moving their trainees (C-D20) |
| Trainee | Link in `app.links` + gym record in `coach` | The trainee accepts in the FitSphere app (C-D23, TCR-001) | A Coach or the Head Coach removes them (C-D18) |

### 3. What each role may do (everything else is refused)

| Action | Head Coach | Coach | Trainee (coach app) |
|---|---|---|---|
| Invite or remove a Coach | Own gym | No | No |
| Invite a trainee | Own gym, under self or under a Coach | Under self | No |
| Remove a trainee | Any in own gym | Own trainees | No |
| See a trainee's data, set targets and plans | Every trainee in own gym | Own trainees | No |
| See which Coach a trainee belongs to | Yes | Own only | No |
| See a Coach's own personal training | **Never** | — | No |
| Leave or remove the person above them | — | **No** | **No** |

### 4. Server rules
1. **Every route declares who may use it.** A route without a rule cannot be registered, so the
   server will not start with an unprotected route (built in CF00).
2. **"Not available" instead of "not allowed".** Asking for a person or record the caller may not
   see returns 404 "Not available", exactly as if it did not exist, so nobody can probe other gyms.
3. **A Coach cannot be a trainee in their own gym (C-D24).** Adding such a person as a trainee in
   that gym is refused. They can be a trainee in another gym, and can always use the FitSphere app
   for their own personal goals. This keeps a Coach's personal logs private from their Head Coach
   (C-D15).
4. **Removing cuts all access at once.** Removing a Coach or ending a trainee's link stops access to
   all of that person's data, including past data, on the next request. Nothing is deleted.

## Why this option wins
- It passes every gate and scores highest; rules, code and tests live together in one place.

## Why the alternatives were rejected
- **B:** needs policies on the trainee app's tables.
- **C:** changes the shared sign-in setup and keeps removed people in until their token expires.
- **D:** passes the gates but adds cost, a network call per request, and a second system, with no
  benefit at this size.

## Consequences
- **Benefits:** one place holds every rule; removals act instantly; nothing changes in the trainee
  app.
- **Trade-off:** one extra database lookup per request, small at phase-1 size.

## Implementation guidance
- Permission checks run in the access module and in each handler's data query (object-level checks,
  generic code practices SE-3); the phone's screens only mirror them.
- Gym relationships are read through one function, so every route uses the same rule.
- No secret or token is ever logged (LG-1).

## Validation
A permission test for every route, with each caller expected to be allowed or refused:
- the right Head Coach, and another gym's Head Coach;
- the trainee's own Coach, another Coach in the same gym, and a Coach from another gym;
- a removed Coach;
- a trainee;
- a Coach asking for their Head Coach's personal data, and the Head Coach asking for a Coach's
  personal data;
- adding a Coach as a trainee in their own gym (refused).

## Reconsider when
- Load needs permissions cached or moved out of the request path (with measurements).
- The product adds roles or multi-gym membership.
