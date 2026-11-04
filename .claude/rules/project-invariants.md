# Project Invariants — FitSphere Coach

Always-on rules for any change in this repo. Rules 1 to 7 are the trainee app's invariants
(`fitsphere/.claude/rules/project-invariants.md`), which both apps must keep because they share
one database. Rules 8 to 10 come from the shared database contract; rules 11 to 16 from scope v0.4
(`docs/product/coach-scope.md`).

1. **Authorization is server-side.** A coach sees a trainee's data only through an **accepted**
   link. A Head Coach can do for every trainee of the gym's Coaches what a Coach can do (C-D12)
   and sees each trainee's Coach, but **never** a Coach's own personal training
   data (C-D15). Ending a link ends access to all of that person's data, including past data.
   UI hiding is not access control.
2. **A trainee cannot edit coach-set targets; coach input wins** (REQ-PLAN-001, coach spec CQ-04).
3. **Invitations never reveal whether an email is registered** (REQ-ROLE-011, D-11). One owner-approved
   exception: inviting an email that already has the Coach role shows "already available as a Coach"
   (C-D14).
4. **Phase 1 serves India only.** "Today" and day membership use Asia/Kolkata; timestamps are
   stored in UTC; a chosen day is its own field.
5. **Units are display settings.** Data is stored in the canonical units the trainee app uses.
6. **Sensitive data stays out of logs, analytics and fixtures.** Synthetic test data only.
7. **An account needs a confirmed email and the 18+ confirmation** (REQ-ACC-010).
8. **This repo changes schema `coach` only.**
9. **Coach migrations are recorded in `coach.schema_migrations`, never `app.schema_migrations`.**
10. **Nothing in schema `coach` may stop an account from being deleted** (`on delete cascade`).
11. **A gym's Head Coach exists only after FitSphere approves its onboarding code** (C-D10). Approval
    codes are stored only as hashes and never shown, returned or logged.
12. **Coaches join only by invitation** (C-D11). There is no self sign-up as Coach.
13. **Every change to a trainee's targets or plans is logged with who and when** (C-D13).
14. **Only the person higher up adds or removes** (C-D18): Head Coach → Coaches and trainees; Coach →
    their trainees. A Coach cannot remove their Head Coach; a trainee cannot remove their Coach or
    Head Coach. The server refuses any such request, whatever the app shows.
15. **A trainee is in a gym only once** (C-D19). A second add is refused with "This trainee is already
    added."
16. **A Coach with trainees cannot be removed** (C-D20). The Head Coach moves the trainees first.
