# ADR-0008: Settings as environment variables

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 (owner's choice: option B) |
| **Scope** | Where the changeable values (limits, email settings) live, and how they are checked and changed |
| **Related decisions** | C-D17 (refined by this ADR), ADR-0004, ADR-0005, ADR-0006 |
| **Supersedes** | None |

## Context
- The owner wants limits and email settings changeable without code changes (C-D17).
- Secrets (the Gmail app password, the approval-code secret key, database passwords) must never be in
  the repo (ADR-0004, ADR-0005; generic code practices SE-1).

## Decision criteria
**Pass/fail gates:**
1. No secrets in the repo.
2. Changeable without code changes.
3. A wrong value cannot silently break the app.

**Weighted criteria:** security 20%, maintainability 20%, reliability 15%, performance 15%,
scalability 10%, cost 10%, integration 10%.

## Options considered

| Option | Description | Gates |
|---|---|---|
| A | One settings file in the repo (`apps/api/config/settings.json`), checked at start | Pass |
| **B** | **One environment variable per setting** (`apps/api/.env` locally; the host's settings in production), checked at start | Pass |
| C | A settings table in the database | Pass, but changes leave no record without an admin tool |

| Criterion (weight) | A | B | C |
|---|---|---|---|
| Security (20%) | 5 — every change recorded in GitHub | 4 | 3 — changeable unnoticed with database access |
| Maintainability (20%) | 5 — one readable place | 3 — many separate variables | 3 |
| Reliability (15%) | 4 | 4 | 4 |
| Performance (15%) | 5 | 5 | 4 |
| Scalability (10%) | 4 | 4 | 4 |
| Cost (10%) | 5 | 5 | 4 — needs an admin tool |
| Integration (10%) | 4 | 4 | 3 |
| **Weighted score** | **93 / 100** | **81 / 100** | **70 / 100** |

## Decision
**Option B, chosen by the owner** (2026-11-04): every setting is an environment variable.

- **Owner's reason:** settings stay alongside the other server settings and can be changed per
  computer or in the host's settings without touching the repo.
- **Recorded difference from the score:** option A scored higher (93) mainly for change history and
  readability. Option B is accepted with the two safeguards below, which recover most of that.

### The settings

| Variable | Starting value | Allowed range |
|---|---|---|
| `APPROVAL_INBOX` | `appbayaipower@gmail.com` | A valid email |
| `SENDER_EMAIL` | `appbayaipower@gmail.com` | A valid email |
| `SENDER_DISPLAY_NAME` | `FitSphere Coach` | 1–50 characters |
| `APPROVAL_CODE_LENGTH` | `6` | 4–8 |
| `GYM_REQUEST_VALID_DAYS` | `7` | 1–30 |
| `APPROVAL_WRONG_TRIES` | `5` | 1–10 |
| `GYM_REQUESTS_PER_DAY` | `3` | 1–10 |
| `COACH_INVITE_VALID_DAYS` | `7` | 1–30 |
| `TRAINEE_INVITE_VALID_DAYS` | `7` | 1–30 |
| `INVITES_PER_DAY` | `20` | 1–100 |

Secrets are environment variables too (`SMTP_APP_PASSWORD`, `APPROVAL_CODE_SECRET`, `DATABASE_URL`,
…) but are never written in `.env.example` with real values.

### Safeguards
1. **`apps/api/.env.example`** (in the repo) lists **every variable with its starting value and
   allowed range**. Setting up a computer means copying it, so values do not drift between
   computers, and changes to the list are recorded in GitHub.
2. **Checked at start (DC-5):** a missing or out-of-range variable stops the server with a message
   naming it; secret values are never printed.

### Changing a value
- **On a PC:** edit `apps/api/.env` and restart the coach server.
- **On the live server:** change it in the host's settings (ADR-0010) and restart.
- The trainee invitation's validity (`TRAINEE_INVITE_VALID_DAYS`) is given to Developer 1 in TCR-001,
  so both apps use the same number.

## Consequences
- **Benefits:** no secrets in the repo; values change without code changes; bad values are caught at
  start.
- **Trade-offs (accepted by the owner):** changes to the actual values on each computer are not
  recorded in GitHub; the live server and a PC can differ if one is updated and the other is not.
  When changing a value on a PC, also change it on the live server.

## Validation
- Tests: the server refuses to start for each missing or out-of-range variable; it starts with the
  values in `.env.example`; error messages never include secret values.

## Reconsider when
- Several people change settings and a change history becomes necessary (option A or an admin tool).
