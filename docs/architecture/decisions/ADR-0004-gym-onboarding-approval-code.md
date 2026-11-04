# ADR-0004: Gym onboarding and approval-code security

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | How a gym request and its 6-digit approval code are created, stored, checked and expire, and who may send a request |
| **Related decisions** | C-D10, C-D17, C-D25, ADR-0002, ADR-0003, invariants 4, 6 and 11 |
| **Supersedes** | None |

## Context
- A person sends a gym request; a 6-digit code is emailed to FitSphere's approval inbox; the FitSphere
  team checks the gym and gives the code to the gym owner; a correct code within 7 days makes the
  person Head Coach, permanently (C-D10).
- Limits are kept as environment variables (C-D17, ADR-0008): 5 wrong tries per code, 3 requests per person per day.
- Risk: a 6-digit code has only 1,000,000 possibilities. If it could be guessed in the app or read
  from the database, someone could approve a fake gym.

## Decision criteria
**Pass/fail gates:**
1. The code cannot be read from the database, even if the database leaks (invariant 11).
2. The code cannot be guessed in the app: wrong tries are limited.
3. No change to the trainee app (C-D22).

**Weighted criteria:** security 20%, maintainability 20%, reliability 15%, performance 15%,
scalability 10%, cost 10%, integration 10%.

## Options for storing the code

| Option | How it is stored | Gate 1 | Gate 2 | Gate 3 |
|---|---|---|---|---|
| Plain text | The code itself | **Fail** | Pass | Pass |
| Simple hash (SHA-256) | A scrambled version | **Fail**: all 1,000,000 codes can be scrambled and compared in seconds | Pass | Pass |
| **A** | **Keyed hash (HMAC-SHA256)** with a secret key held only by the server | Pass: without the key, a leaked database reveals nothing | Pass | Pass |
| B | Slow password hash (bcrypt) | Pass: slower, but 1,000,000 codes can still be tried offline | Pass | Pass |

| Criterion (weight) | A | B |
|---|---|---|
| Security (20%) | 5 | 4 |
| Maintainability (20%) | 4 — built into Node.js | 4 |
| Reliability (15%) | 4 | 4 |
| Performance (15%) | 5 | 3 |
| Scalability (10%) | 4 | 4 |
| Cost (10%) | 5 — no new package | 4 — a new package |
| Integration (10%) | 4 | 4 |
| **Weighted score** | **89 / 100** | **77 / 100** |

## Decision
**Option A, with the rules below.**

### Who may send a gym request (C-D25)
- **One gym per email.** A person owns at most one gym and belongs to only one gym, as Coach or Head
  Coach.
- An email that is **already a Head Coach** is refused: **"This email is already registered as a
  Head Coach."**
- An email that is **already a Coach** in a gym is refused: **"This email is already registered as a
  Coach."**
- The app does not show the gym form to these people (they go straight into the app), but the
  **server refuses the request anyway**.
- A person has at most one **Pending** request; a new request replaces it.
- These messages describe only the caller's own email, so they reveal nothing about anyone else
  (invariant 3 is not affected).

### The code
- 6 random digits from the server's secure random generator (`node:crypto`).
- Stored only as a **keyed hash (HMAC-SHA256)**. The secret key is `APPROVAL_CODE_SECRET`, held only
  by the coach server: in `apps/api/.env` during development, and in the hosting provider's secrets
  manager in production (generic code practices SE-1; ADR-0010). It is never in the repo, the
  database or logs.
- The key and the database live in different places, so stealing the database alone reveals no code.
- Checked with a timing-safe comparison.
- Never returned by the server, never shown in the app, never logged (invariant 6). The only copy is
  in the approval email.

### Limits against guessing
- **5 wrong tries** lock the request; the person must send a new request.
- **Each new request has a new random code**, so earlier guesses do not help.
- **3 requests per person per day**, counted by the India date (invariant 4).
- Together: at most 15 guesses a day per person out of 1,000,000.
- Every request also arrives in the FitSphere approval inbox, so repeated attempts are visible.
- A gym-wide or system-wide daily limit on wrong tries was considered and **not adopted** (owner,
  2026-11-04).

### A request's life

| State | Meaning | Next |
|---|---|---|
| Pending | Sent; waiting for the code | Approved, Expired, Locked or Replaced |
| Approved | The correct code was entered | Final: Head Coach for good |
| Expired | 7 days passed | The person fills in the form again |
| Locked | 5 wrong tries | The person sends a new request |
| Replaced | The person sent a newer request | Final; the old code stops working |
| Not sent | The approval email could not be sent | The person tries again; not counted toward the daily limit |

- Expiry is worked out whenever the request is read, so no background job is needed.

### Approving, in one transaction (DB-1)
When the code matches, all of these succeed together or none do: mark the request Approved, create
the gym, add the `head_coach` role in `app.user_roles`, and record who approved and when.

### Records
Every request, approval, expiry, lock and failed send is logged with its time and the person's ID,
never with the code (LG-1, LG-2).

## Why this option wins
- It passes every gate and scores highest; it needs no new package.

## Why the alternatives were rejected
- **Plain text and simple hash:** a database leak reveals the code.
- **Slow hash:** still crackable offline with only 1,000,000 codes, slower, and adds a package.

## Consequences
- **Benefits:** a leaked database reveals no codes; guessing is capped; no new packages.
- **Trade-offs:** if `APPROVAL_CODE_SECRET` is lost or changed, open requests' codes stop working and
  those people send a new request (acceptable: requests last 7 days).
- **Residual risk (accepted):** someone could make many accounts, each with 3 requests a day. The
  chance per guess stays tiny, attempts are visible in the approval inbox, and a fake gym sees no
  one's data until trainees accept an invitation.
- **Depends on people:** approval is only as good as the FitSphere team's check before sharing the
  code.

## Validation
Tests for: right code; wrong code; the 5th wrong try locks; an expired code fails; a replaced
request's old code fails; the 4th request in a day is refused; a Head Coach email and a Coach email
are refused with their messages; the code never appears in any response or log; approval creates the
gym and the role together or neither; a failed email send does not count toward the limit.

## Reconsider when
- Requests or guessing attempts show abuse in practice (then add a wider limit or alerts).
- FitSphere moves approval inside an admin tool instead of email.
