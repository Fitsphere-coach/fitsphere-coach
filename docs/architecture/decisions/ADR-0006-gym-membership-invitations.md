# ADR-0006: Gym, membership and invitation data

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | Where gyms, Coaches, trainees and invitations are saved, and what happens when someone is added, moved or removed |
| **Related decisions** | ADR-0002, ADR-0003, ADR-0004, ADR-0005, C-D11, C-D14, C-D18, C-D19, C-D20, C-D21, C-D23, C-D24, C-D25, C-D26; TCR-001 |
| **Supersedes** | None |

## Context
- ADR-0002: data the **trainee app shows** lives in schema `app` (built by Developer 1 from change
  requests); data **only the coach app uses** lives in schema `coach`.
- A trainee sees and answers their invitation in the FitSphere app (C-D23), so trainee invitations
  are trainee-app data.
- A Coach sees and answers their invitation in the coach app (C-D11), so Coach invitations are
  coach-only data.

## Options considered: where trainee invitations live

| Option | Gate: ADR-0002 (the trainee app never reads schema `coach`) |
|---|---|
| **A. In schema `app`**: a new table built by Developer 1 from TCR-001; the coach server writes it, the trainee server reads and answers it | Pass |
| B. In schema `coach`, read by the trainee server | **Fail** |

Option A is the only option that passes, so no scoring is needed.

## Decision

### Tables

| Saved | Schema | Table | Key rules |
|---|---|---|---|
| Gym requests | `coach` | `gym_requests` | States and keyed-hash code as ADR-0004; gym fields plus an "extra fields" slot for fields added later |
| Gyms | `coach` | `gyms` | **One gym per Head Coach**, enforced by a unique constraint (C-D25) |
| Coaches in a gym | `coach` | `gym_coaches` | **One gym per Coach**, enforced by a unique constraint (C-D25); plus the `coach` row in `app.user_roles` |
| Coach invitations | `coach` | `coach_invitations` | Email, gym, inviter, token (keyed hash), status, expiry (7 days, configuration file) |
| Trainee invitations | `app` (TCR-001) | e.g. `app.coach_invitations` | Email, gym, **assigned coach** (the Head Coach or a chosen Coach, C-D21), inviter, status, expiry (7 days) |
| Trainee consent | `app` (TCR-001) | e.g. `app.coach_consents` | The trainee's acceptance, its time, and the version of the text shown |
| Trainee ↔ coach link | `app` (exists) | `app.links`, kind `coach_trainee` | Its existing unique index allows **one active coach per trainee**, so a trainee is in one gym and is never added twice (C-D19) |

- **A trainee's gym is not stored separately**: it is always the gym of their coach (a Coach in
  `gym_coaches`, or the Head Coach in `gyms`), so it can never be out of step.
- Every `coach` table that points at a person is deleted with that person (`on delete cascade`).

### What happens when

| Event | What is saved |
|---|---|
| Head Coach invites a Coach | Check "already a Coach" (C-D14). Save a coach invitation. Email a link if the email has no account; otherwise the invitation shows in the coach app |
| Coach accepts | In one transaction: add to `gym_coaches`, add the `coach` role, mark the invitation Accepted |
| Coach or Head Coach invites a trainee | Check "already added" (C-D19) and "a Coach cannot be a trainee in their own gym" (C-D24). Save a trainee invitation in `app`. Email if the email has no account |
| Trainee accepts (in the FitSphere app) | Done by the trainee server (TCR-001), in one transaction: save the consent, create the active link, mark the invitation Accepted |
| Trainee declines, or 7 days pass | Nothing is linked; the invitation is marked Declined or Expired (expiry worked out when read) |
| Head Coach moves a trainee to another coach in the gym | In one transaction: end the old link and start a new one. **No new consent**: the trainee agreed to share with the **gym** (C-D26) |
| Head Coach removes a Coach | Refused while the Coach has trainees (C-D20). Otherwise, in one transaction: remove from `gym_coaches` and remove the `coach` role |
| A Coach or the Head Coach removes a trainee | End the link with reason "removed". No data is deleted |

### Consent covers the gym (C-D26)
- The trainee's acceptance is consent to share their data with **the gym**: their coach and the
  gym's Head Coach. The consent text in TCR-001 must say so in plain words.
- Moving the trainee to another coach in the same gym therefore needs no new acceptance.

### Invitation emails
- Sent by the coach server through the ADR-0005 Gmail sender ("FitSphere Coach").
- The inviter always sees **"Invitation sent"**, whether or not the email has an account
  (invariant 3). The only exception is "This email is already available as a Coach" (C-D14).

## Consequences
- **Benefits:** the database itself refuses duplicates (one gym per Head Coach, one gym per Coach,
  one coach per trainee); a trainee's gym can never be wrong.
- **Depends on Developer 1:** trainee invitations and consent wait for TCR-001.
- **Risk:** invitation and approval emails share Gmail's daily sending limit (a few hundred). Enough
  for phase 1; if many gyms join, move to a domain email service (ADR-0005, "Reconsider when").

## Validation
- Database tests that refuse: a second gym for a Head Coach, a second gym for a Coach, a second
  active coach for a trainee, removing a Coach who still has trainees.
- A test that a move keeps the trainee in the same gym and needs no new consent.
- The trainee-accept flow is tested together with Developer 1's change (TCR-001).

## Reconsider when
- A person needs to belong to more than one gym.
- Trainees should re-consent when moved between coaches.
