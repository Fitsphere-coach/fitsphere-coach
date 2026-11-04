# ADR-0011: Offline use and sync

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | How FitSphere Coach works without internet and syncs when the connection returns |
| **Related decisions** | ADR-0001, ADR-0003, ADR-0007, ADR-0009, ADR-0010, C-D22, C-D27, C-D28, C-D30 |
| **Follows** | The trainee app's ADR-0007 (offline storage and sync): same method and rules |
| **Supersedes** | None |

## Context
- The owner wants FitSphere Coach to **work without internet and sync when the connection returns**,
  following the trainee app's practice.
- The trainee app uses Expo SQLite on the phone, an outbox of changes with IDs made on the phone,
  and one sync endpoint on its server that re-authorizes and applies each change once (trainee
  ADR-0007).
- The coach app has its own server (ADR-0001), so it gets **its own sync endpoint** with the same
  rules. Nothing in the trainee app changes (C-D22).

## Decision criteria
**Pass/fail gates:**
1. Works offline and syncs later.
2. The server re-checks permission for every queued change.
3. Data on the phone is encrypted.
4. Does not affect the trainee app (C-D22).

**Weighted criteria:** cost 25%, security 20%, maintainability 15%, reliability 15%, performance
10%, integration 10%, scalability 5% (as ADR-0010).

## Options considered

| Option | Gates | Score |
|---|---|---|
| **A. Same method as the trainee app:** Expo SQLite, outbox, one sync endpoint on the coach server | Pass | **86 / 100** |
| B. A sync product (for example PowerSync) | Pass, but adds a paid service and a second permission model | 64 / 100 |
| C. Online only | **Fails gate 1** | — |

## Decision
**Option A**, with the trainee app's rules:
1. **What the phone keeps:** for each trainee the coach may see (ADR-0003), current targets and
   plans and the **last 30 days** of their data; the gym's coach and trainee lists. Older history
   loads from the server online; offline it shows "Needs internet".
2. **Works offline, synced later:** viewing trainees and their recent data; setting or changing
   targets, diet plans and training plans. Each change has an ID made on the phone and is applied
   **once** however often it is sent.
3. **Needs internet** (with a named "Needs internet" message): sign-up, log in, password changes;
   gym onboarding and the approval code; inviting, adding, removing and moving coaches or trainees;
   history older than 30 days. Membership is always decided live.
4. **At sync:**
   - the server re-checks every change; a change the coach is no longer allowed to make (for
     example, the trainee was removed) is refused, shown to the coach with the reason, and removed
     from the outbox;
   - when a Coach and the Head Coach change the same target, the change the server receives last
     wins; both stay in the change log with name, role and time (ADR-0007);
   - coach changes still override the trainee's own (C-D27).
5. **Removals:** each sync returns what the phone must delete (a removed trainee's data, a trainee
   moved to another coach). Reading a former trainee's past data (C-D28) is **online only**, never
   from the phone's copy.
6. **30-day clear:** if the app has not synced for 30 days, the phone deletes trainees' data and
   unsent changes, after a warning 3 days before. The check runs when the app starts or returns to
   the foreground, before any data is shown.
7. **Encryption:** the phone database is encrypted with a key kept in the phone's secure storage;
   no password for the coach.
8. **Dates and units:** "today" is Asia/Kolkata; a change stores the chosen day and a UTC time;
   values in the trainee app's canonical units.

## Why this option wins
- Passes every gate; same tested method as the trainee app; no extra service or cost.

## Why the alternatives were rejected
- **B:** a paid service and a second permission model. **C:** fails the owner's requirement.

## Consequences
- **Benefits:** coaches can work in gyms with poor signal; one method across both apps.
- **Trade-offs:**
  - **First cloud build:** the encrypted phone database (SQLCipher, as in the trainee app) does not
    run in Expo Go. When the first offline feature is built, the app moves to an **EAS development
    build** under the coach app's own Expo account (ADR-0009, C-D30). Claude tells the owner before
    every build.
  - Offline edits can be refused at sync; the coach must see why.
- **Depends on Developer 1:** the trainee app refusing a trainee's offline edit to a coach-set
  target is part of TCR-002.

## Validation
- Change a target in airplane mode, reconnect: saved once and listed in the change log.
- Remove a trainee while the coach's phone is offline: on reconnect, the queued change is refused
  and that trainee's data leaves the phone.
- The phone database file is unreadable without the key.
- With the phone in another time zone, the saved day is still India's.

## Reconsider when
- Sync bugs grow costly; real-time features are needed; phone storage problems appear.
