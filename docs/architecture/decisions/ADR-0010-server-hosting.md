# ADR-0010: Where the coach server runs

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | Where the coach server runs once people outside the developer's Wi-Fi use the app: testers, then real users |
| **Related decisions** | ADR-0001, ADR-0002, ADR-0004, ADR-0005, ADR-0008, C-D22, C-D29 |
| **Supersedes** | None |

## Context
- Today the coach server runs **on the developer's PC** and the phone reaches it over Wi-Fi. It stops
  when the PC is off and is not safe for real users.
- The trainee app plans **Google Cloud Run** later; its server also runs on a PC today.
- Secrets (Gmail app password, approval-code key, database password) must sit in a **secrets vault**
  in production (SE-1; ADR-0004, ADR-0005).
- The shared Supabase project is in **Singapore** (`ap-southeast-1`), chosen by mistake; it moves to
  Mumbai once both apps are built (C-D29). The server must run close to the database.
- **The owner wants the most cost-efficient option.**

## Decision criteria
**Pass/fail gates:**
1. Reachable from phones at any time over HTTPS.
2. Secrets kept in a vault, not in files.
3. Does not affect the trainee app (C-D22): separate billing and settings.
4. **Costs ₹0 a month while testing**, with a small, known cost when real users start.

**Weighted criteria (cost raised at the owner's request):** cost 25%, security 20%, maintainability
15%, reliability 15%, performance 10%, integration 10%, scalability 5%.

## Options considered

| Option | Gate 1 | Gate 2 | Gate 3 | Gate 4 |
|---|---|---|---|---|
| **A. Google Cloud Run**, own Google Cloud project and billing account | Pass | Pass (Secret Manager) | Pass | Pass: free monthly allowance (about 2 million requests) |
| B. Render free plan | Pass, but sleeps after 15 min idle; about 1 minute to wake; Render says not for production | Pass | Pass | Pass now; needs a paid plan for real users |
| C. A rented virtual server, self-managed | Pass | Partly: set up by hand | Pass | **Fail**: paid every month, used or not |
| D. Keep it on the developer's PC | **Fail** | **Fail** | Pass | Pass |

| Criterion (weight) | A: Cloud Run | B: Render | C: own server |
|---|---|---|---|
| Cost (25%) | 5 — ₹0 at testing volume, then pay per use | 4 — free with sleep; paid to stay awake | 3 |
| Security (20%) | 5 — managed HTTPS, Secret Manager | 4 | 3 — patched by hand |
| Maintainability (15%) | 4 | 4 | 2 |
| Reliability (15%) | 4 | 2 — sleeps | 3 |
| Performance (10%) | 4 — short wake-up delay when idle | 2 — about 1 minute wake-up | 4 |
| Integration (10%) | 4 — same platform the trainee app plans | 3 | 3 |
| Scalability (5%) | 5 | 4 | 2 |
| **Weighted score** | **90 / 100** | **68 / 100** | **58 / 100** |

## Decision
**Option A: Google Cloud Run.**
1. **Its own Google Cloud project and billing account** for FitSphere Coach, so its free allowance
   and settings are never shared with the trainee app.
2. **Region:** next to the database. **Now: Singapore** (`asia-southeast1`). **After the database
   moves to Mumbai (C-D29): Mumbai** (`asia-south1`, also Google's cheaper price group), by deploying
   again there.
3. **Cost settings:**
   - zero copies running when idle (no always-on copy unless the owner decides later);
   - smallest size: 1 CPU, 512 MB memory;
   - only 3 secrets (within Secret Manager's 6 free versions and 10,000 free reads a month);
   - old app versions deleted after each deploy;
   - a **budget alert at ₹500 a month**, emailed to the owner (an alert warns; it does not stop
     spending).
4. **Secrets** in Google Secret Manager: Gmail app password, approval-code key, database password.
   **Normal settings** (ADR-0008) in the service's environment variables.
5. **Database connection:** Supabase's transaction pooler, which suits servers that start and stop.
6. **Deploying:** a GitHub Action builds and deploys after a pull request is merged into `main`.
7. **When:** set up before the first testers outside the developer's Wi-Fi; until then the PC.
8. **Before real users:** the coach server's own database login (ADR-0002, TCR-005).

## Why this option wins
- Passes every gate, including cost, and scores highest: ₹0 while testing, pay per use after, no
  server to maintain.

## Why the alternatives were rejected
- **B:** the 1-minute wake-up and "not for production" rule mean a paid plan for real users.
- **C:** paid every month and maintained by hand. **D:** not reachable or safe for real users.

## Consequences
- **Benefits:** HTTPS address, secrets in a vault, grows automatically, free or nearly free at the
  start.
- **Trade-offs:**
  - a short delay on the first request after an idle period;
  - Google needs a card to switch on billing, even within the free allowance;
  - data sent to phones is charged per GB beyond the free amount (small for an API);
  - Singapore is in the dearer price group until the move to Mumbai.
- **Not covered:** Supabase is a separate bill; its free plan has no backups. Moving to a paid plan
  before real users is a shared decision with Developer 1.
- **Region move (C-D29):** Supabase cannot change a project's region in place. The move means a new
  Mumbai project and copying sign-in accounts, data and stored files, planned together with
  Developer 1 on one date for both apps. Both apps then use the new address and keys. It should
  happen before the release (the trainee app's documents assume Mumbai; Legal's review, Q-049, may
  care where Indian users' data is kept).
- **Logs** go to Google Cloud Logging; the server already keeps tokens, emails and health data out
  of logs.

## Validation
- After the first deploy: the health check answers over HTTPS; the phone app works against the live
  address; a missing secret stops the server with a clear message; logs hold no secrets or health
  data; the budget alert is set.

## Reconsider when
- Use goes past the free allowance, or the wake-up delay troubles real users (consider one
  always-on copy).
- The database moves to Mumbai (redeploy the server there).
