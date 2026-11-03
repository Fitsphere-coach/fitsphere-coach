# Project Invariants — FitSphere Coach

Always-on rules for any change in this repo. Rules 1 to 7 are the trainee app's invariants
(`fitsphere/.claude/rules/project-invariants.md`), which both apps must keep because they share
one database. Rules 8 to 10 come from the shared database contract.

1. **Authorization is server-side.** A coach sees a trainee's data only through an **accepted**
   link; a Head Coach sees the coaching activity of their accepted coaches (counts only, never a
   coach's own personal logs) and a trainee's data only while that trainee allows it
   (REQ-ROLE-004, REQ-ROLE-013, D-13). Ending a link ends access to all of that person's data,
   including past data. UI hiding is not access control.
2. **A trainee cannot edit coach-set targets; coach input wins** (REQ-PLAN-001, coach spec CQ-04).
3. **Invitations never reveal whether an email is registered** (REQ-ROLE-011, D-11).
4. **Phase 1 serves India only.** "Today" and day membership use Asia/Kolkata; timestamps are
   stored in UTC; a chosen day is its own field.
5. **Units are display settings.** Data is stored in the canonical units the trainee app uses.
6. **Sensitive data stays out of logs, analytics and fixtures.** Synthetic test data only.
7. **An account needs a confirmed email and the 18+ confirmation** (REQ-ACC-010).
8. **This repo changes schema `coach` only.**
9. **Coach migrations are recorded in `coach.schema_migrations`, never `app.schema_migrations`.**
10. **Nothing in schema `coach` may stop an account from being deleted** (`on delete cascade`).
