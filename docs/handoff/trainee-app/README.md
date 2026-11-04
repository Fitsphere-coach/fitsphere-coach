# Trainee-app change requests (TCR)

Decision C-D22: the coach team never edits the trainee app (`pradeepKumawatPalara/fitsphere`).
When a coach feature needs the trainee app to change, the coach team writes the change here in full,
the owner reviews it, and the owner gives it to Developer 1, who builds it in the trainee app.

## How a request moves

| Status | Meaning |
|---|---|
| Draft | Being written by the coach team |
| Ready for owner | Complete; waiting for the owner's review |
| Sent to Developer 1 | The owner has given it to Developer 1 |
| In progress | Developer 1 is building it |
| Done | Merged in the trainee repo and applied to the shared database; the coach side can go live |
| Changed | Developer 1 or the owner changed the request; the coach side is updated to match |

- One file per request: `TCR-NNN-short-name.md`.
- A request is written **when its coach feature is designed**, so its details match the approved
  coach screens and data.
- Developer 1 must be able to build it **without asking questions**. Anything unknown is listed under
  "Open questions" for the owner to answer before sending.
- The coach side never goes live before its request is Done.

## Index

| ID | Change in the trainee app | Needed by | Status |
|---|---|---|---|
| TCR-001 | Joining a gym (C-D23): the trainee creates their own account; on log in an Accept/Decline pop-up for the gym's invitation; accepting records consent (covering the gym, C-D26, and the gym's read access to past data after the link ends, C-D28) and creates the link; tables `app.coach_invitations` and `app.coach_consents` (ADR-0006) | CF04 | Not written yet |
| TCR-002 | Coach-set targets override the trainee's own (C-D27): shown with "Set by <name> (HC)" or "(C)", locked for the trainee; stay read-only after the link ends | CF05 | Not written yet |
| TCR-003 | Coach training plan in the Training tab; workouts logged against it | CF06 | Not written yet |
| TCR-004 | Coach diet plan in the Diet plan tab; a plan option logged as a meal | CF07 | Not written yet |
| TCR-005 | Separate database login for the coach server (its `app` permissions), ADR-0002 | Before the first real user | Not written yet |

## Template

```markdown
# TCR-NNN: <short title>

| | |
|---|---|
| Status | Draft |
| Written by | Coach team (Developer 2), <date> |
| For | Developer 1 — trainee app (`fitsphere`) |
| Coach feature that depends on it | CFxx |
| Coach decisions | C-Dxx |
| Trainee-repo items it delivers | REQ-…, backlog B-… (if any) |

## 1. Why
What the trainee and the coach get, in two or three sentences.

## 2. User flow
Numbered steps from the trainee's point of view, including what the coach did first.

## 3. Screens and states
For each screen or change: where it appears, top to bottom, and every state (loading, empty,
error, success, offline). Link the approved coach-side design where relevant.

## 4. Exact copy
Every text the trainee sees, word for word.

## 5. Data
- New or changed tables and columns in schema `app` (full SQL for the trainee repo's next
  migration number), indexes, constraints, `on delete` rules.
- What the coach server writes and reads, and when.
- Offline and sync behaviour (outbox, sync changes, conflicts).

## 6. API changes in the trainee server
Routes, request and response shapes, error codes, access rules.

## 7. Rules and permissions
Who may see or change what; what the server must refuse.

## 8. Acceptance criteria
Given / when / then, including failure and permission cases.

## 9. Tests Developer 1 should add
Unit, integration and permission tests; phone checks.

## 10. How the coach side depends on it
What the coach server expects to find in the database, and how both sides are tested together.

## 11. Rollout
Order of merges and migrations; what is safe if one side ships first.

## 12. Open questions
For the owner to answer before sending, or `None`.
```
