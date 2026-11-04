# ADR-0007: Change log for targets, plans and links

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | How every change a Coach or Head Coach makes to a trainee's targets, training plan, diet plan or link is recorded and shown |
| **Related decisions** | C-D4, C-D13, C-D27, C-D28, ADR-0002, ADR-0003, ADR-0006, invariants 1 and 13; TCR-001 to TCR-004 |
| **Supersedes** | None |

## Context
- C-D13: every change records who made it (name and role) and when; Coaches see the latest change
  and the full history; history is never edited.
- Targets and plans live in schema `app`, because the trainee app shows them (ADR-0002). The history
  is coach-only, so it belongs in schema `coach`.
- Owner, 2026-11-04: link events are part of the history; history is kept when a link is removed and
  stays readable by the gym (C-D28); coach changes override the trainee's own targets and plans
  (C-D27).

## Options considered

| Option | Description | Gate: ownership (ADR-0002) |
|---|---|---|
| **A** | **A history table in schema `coach`**, written by the coach server in the same transaction as each change | Pass |
| B | Database triggers on `app` tables that copy every change | **Fail**: triggers in schema `app`, and the trainee server would write into schema `coach` |
| C | Every plan version kept as rows in `app` tables | Pass, but every change needs Developer 1 and the trainee app's synced tables grow with coach-only history |

| Criterion (weight) | A | C |
|---|---|---|
| Security (20%) | 4 | 4 |
| Maintainability (20%) | 4 — the coach team owns it | 2 — waits on Developer 1 |
| Reliability (15%) | 4 — same transaction as the change | 4 |
| Performance (15%) | 4 | 3 — larger tables to sync |
| Scalability (10%) | 4 | 3 |
| Cost (10%) | 4 | 2 |
| Integration (10%) | 4 | 3 |
| **Weighted score** | **80 / 100** | **63 / 100** |

## Decision
**Option A: one history table in schema `coach`.**

### What is recorded
- **Targets:** created, changed, removed.
- **Training plans and diet plans:** created, changed, removed.
- **Link events:** joined the gym (under which coach), moved between coaches, removed (by whom). The
  last entry after a removal reads, for example, **"Link removed by Asha Rao (HC)"**.

### What each row holds
- Which trainee and which gym.
- What changed: target, training plan, diet plan or link, and its ID.
- Action: created, changed, removed, joined, moved.
- Who: their account, plus a **copy of their name and role at that moment**, shown as **HC** (Head
  Coach) or **C** (Coach), so the row still reads "Asha Rao (HC)" if Asha later changes her name or
  leaves.
- When: stored in UTC, shown in India time (invariant 4).
- Before and after values, so a coach sees exactly what changed. For a trainee's first coach-set
  value, "before" is the trainee's own value it replaced (C-D27).

### Rules
1. **Same transaction:** a change and its history row are saved together; both succeed or neither
   does (DB-1).
2. **Never edited:** the server offers no way to edit or delete history, and a database rule in
   schema `coach` refuses edits.
3. **Kept when a link is removed.** Removing or moving a trainee never deletes history.
4. **Deleted only when the trainee deletes their whole FitSphere account** (account deletion and the
   law require personal data to go).
5. **Who reads it:** the trainee's current Coach and the gym's Head Coach (ADR-0003). After a trainee
   moves within the gym, the new Coach sees the full history. **After a link is removed, the gym's
   Head Coach and the former Coach can still read the history and the trainee's data up to the day
   the link ended, read-only (C-D28)**, subject to the condition below.
6. **The trainee** sees only the latest value's label in the FitSphere app, **"Set by Asha Rao
   (HC)"** or **"Set by Ravi Kumar (C)"**, built by Developer 1 from the `app` tables (TCR-002 to
   TCR-004).
7. **Only coach changes and link events are logged here.** A trainee changing their own targets
   before any coach sets them is the trainee app's business.
8. **Privacy in logs:** before and after values are health data and are never written to server logs
   (invariant 6).

### Coach changes override the trainee's own (C-D27)
- Once a trainee has accepted, any target, diet plan or training plan set by their Coach or the gym's
  Head Coach **replaces** the trainee's own. The trainee sees "Set by … (HC)" or "(C)" and cannot
  change it (C-D4). Built in the FitSphere app by Developer 1 (TCR-002 to TCR-004).
- **After a link is removed (default, owner may change):** coach-set targets and plans stay in the
  FitSphere app, read-only and labelled, until the trainee sets their own.

### Condition for reading after removal (C-D28)
- Access after a link ends switches on only when (1) the FitSphere app's consent text, accepted by the
  trainee, says plainly that the gym keeps access to their past data after the link ends (TCR-001),
  and (2) Legal has reviewed it before real users. Until then it is built and tested with test
  accounts only.
- The purpose and the screens for reading a former trainee's data are a later requirement.

## Consequences
- **Benefits:** a complete, trustworthy history the coach team owns, including who linked, moved and
  removed each trainee.
- **Trade-offs:** history is stored apart from the plans (linked by ID, same transaction); one row per
  change.
- **Conflict named:** C-D28 differs from the trainee repo's rule that ending a link ends access to past
  data (its D-10 and invariant 1). It applies only to what the coach server shows, and depends on the
  consent condition above.

## Validation
Tests: every change and link event creates exactly one history row with the right person, role and
time; a failed change leaves no row; edit and delete of history are refused; removing a link keeps
the history; deleting the trainee's account removes it; another gym cannot read it; after removal the
former gym can read data only up to the removal date, and only when the consent switch is on.

## Reconsider when
- The purpose and limits of reading former trainees' data are decided.
- Legal's review requires a shorter retention or narrower access.
