# ADR-0005: Sending the approval email

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | How the coach server emails the gym details and the 6-digit approval code to FitSphere's approval inbox |
| **Related decisions** | C-D10, C-D16 (accepted by this ADR), C-D17, ADR-0004 |
| **Supersedes** | None |

## Context
- Each gym request sends one email to FitSphere's approval inbox with the gym details and the code
  (C-D10, ADR-0004).
- FitSphere has **no website domain**.
- Volume is low: at most a few dozen emails a day in phase 1.
- The email contains the approval code, so the sending account must be protected.

## Decision criteria
**Pass/fail gates:**
1. Works without a domain.
2. Can send to any inbox named in the settings file.
3. The sending password never goes into the repo, the database or logs.

**Weighted criteria:** security 20%, maintainability 20%, reliability 15%, performance 15%,
scalability 10%, cost 10%, integration 10%.

## Options considered

| Option | Gate 1 | Gate 2 | Notes |
|---|---|---|---|
| Resend | **Fail**: needs a domain | — | — |
| Supabase's own emails | Pass | **Fail**: sends only sign-in emails to the account's own address | — |
| **A. Gmail with a Google app password** | Pass | Pass | Sent from Google's servers to a Gmail inbox |
| B. An email service's free plan (for example Brevo) with a Gmail sender address | Pass | Pass | A new account; mail claiming a Gmail sender but sent by another service may be filtered as spam (not tested) |

| Criterion (weight) | A | B |
|---|---|---|
| Security (20%) | 4 | 4 |
| Maintainability (20%) | 4 | 4 |
| Reliability (15%) | 4 — Google to Google | 2 — spam risk with a Gmail sender |
| Performance (15%) | 4 | 4 |
| Scalability (10%) | 2 — Gmail's daily limit of a few hundred emails | 4 |
| Cost (10%) | 5 | 5 |
| Integration (10%) | 4 | 3 — new account and sender verification |
| **Weighted score** | **79 / 100** | **74 / 100** |

## Decision
**Option A: Gmail with an app password.** This accepts C-D16.

### Settings
| Setting | Where | Starting value |
|---|---|---|
| Sender email | Configuration file (C-D17) | `appbayaipower@gmail.com` |
| Sender display name | Configuration file | `FitSphere Coach` |
| Approval inbox | Configuration file | `appbayaipower@gmail.com` |
| Sender app password (`SMTP_APP_PASSWORD`) | `apps/api/.env` in development; the hosting secrets manager in production (ADR-0010) | Created by the owner |

- The **password is never in the configuration file**: that file is in the repo (generic code
  practices SE-1, SE-2). It is never in the database or logs either.
- **The sender email and the app password must belong to the same Gmail account**, or Gmail refuses
  to send. The server checks at startup that both are set and fails with a clear message if not
  (DC-5), without printing the password.
- The email is sent as **"FitSphere Coach" <sender email>**. When the sender and the inbox are the
  same account, Gmail's inbox list may show "me"; the opened email shows FitSphere Coach.

### Sending
- Through Gmail's SMTP server, with the package **`nodemailer`**: the standard Node.js email sender,
  widely used and maintained; Node.js cannot send email by itself (DC-1).
- **10-second timeout, no automatic retry** (ER-4, ER-5): a second send would mean a second request.
  A failed send marks the request **"Not sent"** and the person can try again (ADR-0004).
- **The email contains only:** gym name, address, total trainees, the person's name and email, the
  request time, the expiry time, and the code.

### Owner set-up (once, before CF02's phone check)
1. Sign in to the sender Gmail account; open **myaccount.google.com → Security**.
2. Turn on **2-Step Verification** (Google asks for a phone number; it is required before app
   passwords can be created).
3. Search **App passwords**, create one named **FitSphere Coach**, and copy the 16-letter password.
4. Put it in `apps/api/.env` as `SMTP_APP_PASSWORD`. Restart the coach server.

### Fallback: if an app password cannot be created for `appbayaipower@gmail.com`
1. Use **another Gmail account** the owner controls (a new one made only for sending is best).
2. Turn on 2-Step Verification there and create its app password (steps above).
3. Change two settings, no code change: **Sender email** in the configuration file → the new
   address; `SMTP_APP_PASSWORD` in `apps/api/.env` → the new account's app password. The display name
   stays FitSphere Coach and the approval inbox stays `appbayaipower@gmail.com`.
4. Restart the coach server and send one test request.

## Why this option wins
- It is the only option that passes every gate with reliable delivery to a Gmail inbox, at no cost
  and with no domain.

## Why the alternatives were rejected
- **Resend:** needs a domain. **Supabase emails:** cannot send this message. **Email service with a
  Gmail sender:** spam risk and a new account, for no benefit at this volume.

## Consequences
- **Benefits:** free; no domain; quick set-up; the sender can be switched by settings alone.
- **Trade-offs and accepted risks:**
  - Gmail's daily sending limit (far above gym-request volume).
  - Google may block sign-in if the account looks unusual or the app password is removed; requests
    are then "Not sent" until fixed.
  - **Sender and inbox are the same account (owner's choice, 2026-11-04):** if the app password
    leaked, that inbox could be read. Revoke the app password at once in Google's security page if a
    leak is suspected. Moving to a separate sending account (the fallback) removes this risk.
- **Later:** if FitSphere gets a domain, switch to a domain-based service such as Resend by changing
  only the email settings.

## Validation
- A test with a fake email sender checks the content and that nothing extra is included.
- A failed send marks the request "Not sent"; no automatic retry.
- Startup fails clearly when the sender email or app password is missing.
- One real email is sent during the owner's CF02 phone check.

## Reconsider when
- Volume nears Gmail's daily limit, or FitSphere gets a domain.
