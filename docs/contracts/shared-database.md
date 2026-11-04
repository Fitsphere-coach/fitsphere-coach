# Shared database contract (fitsphere ↔ fitsphere-coach)

- Status: Draft — the coach repo's rules for the shared database.
- **C-D22 (2026-11-04):** the coach repo never changes the trainee app or schema `app`. Any change the trainee app needs, including new `app` tables or columns, is written as a trainee-app change request (`docs/handoff/trainee-app/`) for Developer 1 to build.


These keep the two repos from breaking each other. Changes the trainee app needs reach Developer 1 only through change requests.

1. **Two schemas, two owners.** Schema `app` belongs to the trainee repo. Schema `coach` belongs to the coach repo. Each repo only creates or changes tables in its own schema.
2. **Two migration lists.** The coach repo records its migrations in `coach.schema_migrations`, never in `app.schema_migrations`. *(Why: the trainee repo's migration runner stops with an error if it finds a migration it doesn't have in its own folder.)* Coach migrations are numbered `C0001_…`, `C0002_…`.
3. **Shared tables are never changed by this repo.** If a coach feature needs a change to an `app` table (for example an "author" column on `app.targets`), it is written as a trainee-app change request and Developer 1 makes it in the trainee repo (C-D22). The coach side waits until it is merged and applied.
4. **Which `app` tables the coach API may write** (everything else is read-only for it):

   | Table | Coach API may… | Why |
   |---|---|---|
   | `app.users` | insert (account setup, same rules as `POST /v1/me`: confirmed email, 18+ confirmation) | Coaches are FitSphere users; links point at `app.users` |
   | `app.user_roles` | insert/delete `coach`, `head_coach` | Switching on a role (REQ-ROLE-001) |
   | `app.links` | insert, end | Accepting and ending coaching links (REQ-ROLE-003/005/014/015) |
   | `app.targets` | **nothing until the change request for coach-set targets is built by Developer 1** (locking coach targets in the trainee app, C-D4); then as that request defines | REQ-ROLE-006 |
   | everything else in `app` | **read only**, and only through the access rules (invariant 1) | Trainee logs are owned by the trainee |

5. **Deleting an account must still work.** Every `coach` table that points at a user uses `on delete cascade` (or is cleaned up by the trainee repo's account deletion), so a user can always be deleted (REQ-ACC-009).
6. **The same privacy rules in both APIs.** Coach access to trainee data only through an accepted link; the Head Coach as C-D12 and C-D15 define; ending a link ends access to past data too; nothing sensitive in logs (invariants 1 and 6).
7. **Separate database logins before real users** (ADR-0002): the coach server gets its own login with full access to `coach`, read on `app`, and write only on the agreed `app` tables; set up by Developer 1 from a change request. The shared login is for development with test accounts only.
8. **Test on a copy, not the shared project.** Automated tests use a local test database. Migrations go to the shared project only after the pull request is merged.
9. **Coach migrations only add to schema `coach`.** They never change anything the trainee app uses.

---

