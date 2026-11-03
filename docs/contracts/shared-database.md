# Shared database contract (fitsphere ↔ fitsphere-coach)

- Status: Draft — agreed by the coach developer 2026-11-03; waiting for Developer 1 (trainee repo) to agree.
- A copy should live in the trainee repo at `docs/contracts/shared-database.md`. Change both copies together.


These protect each team from breaking the other. Developer 1 should agree to them, and both repos keep a copy in `docs/contracts/shared-database.md`.

1. **Two schemas, two owners.** Schema `app` belongs to the trainee repo. Schema `coach` belongs to the coach repo. Each repo only creates or changes tables in its own schema.
2. **Two migration lists.** The coach repo records its migrations in `coach.schema_migrations`, never in `app.schema_migrations`. *(Why: the trainee repo's migration runner stops with an error if it finds a migration it doesn't have in its own folder.)* Coach migrations are numbered `C0001_…`, `C0002_…`.
3. **Shared tables are changed only by agreement.** If the coach app needs a change to an `app` table (for example `app.targets` needs an "author" column), Developer 2 asks, and **Developer 1 adds the migration in the trainee repo**. The coach repo waits until it is applied.
4. **Which `app` tables the coach API may write** (everything else is read-only for it):

   | Table | Coach API may… | Why |
   |---|---|---|
   | `app.users` | insert (account setup, same rules as `POST /v1/me`: confirmed email, 18+ confirmation) | Coaches are FitSphere users; links point at `app.users` |
   | `app.user_roles` | insert/delete `coach`, `head_coach` | Switching on a role (REQ-ROLE-001) |
   | `app.links` | insert, end | Accepting and ending coaching links (REQ-ROLE-003/005/014/015) |
   | `app.targets` | insert coach-set targets (once Developer 1 adds author columns) | REQ-ROLE-006 |
   | everything else in `app` | **read only**, and only through the access rules (invariant 1) | Trainee logs are owned by the trainee |

5. **Deleting an account must still work.** Every `coach` table that points at a user uses `on delete cascade` (or is cleaned up by the trainee repo's account deletion), so a user can always be deleted (REQ-ACC-009).
6. **The same privacy rules in both APIs.** Coach access to trainee data only through an accepted link; head coach only with the trainee's Allow; ending a link ends access to past data too; nothing sensitive in logs (invariants 1 and 7).
7. **Test on a copy, not the shared project.** Automated tests use a local test database. Migrations go to the shared project only after the pull request is merged.
8. **Talk before every migration** on the shared project: post a one-line note to Developer 1 ("Applying coach C0001: new schema coach, no change to app").

---

