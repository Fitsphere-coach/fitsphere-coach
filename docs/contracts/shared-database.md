# Shared database contract (fitsphere ↔ fitsphere-coach)

- Status: Draft — the coach repo's own rules for the shared database. It asks nothing of Developer 1.
- **C-D7 wins over anything below:** no change may affect the trainee app. Where a rule below mentions Developer 1 adding or changing something, the coach feature waits and the owner decides; Claude never plans that change.


These keep the coach app from ever affecting the trainee app. They are this repo's rules only; they ask nothing of Developer 1.

1. **Two schemas, two owners.** Schema `app` belongs to the trainee repo. Schema `coach` belongs to the coach repo. Each repo only creates or changes tables in its own schema.
2. **Two migration lists.** The coach repo records its migrations in `coach.schema_migrations`, never in `app.schema_migrations`. *(Why: the trainee repo's migration runner stops with an error if it finds a migration it doesn't have in its own folder.)* Coach migrations are numbered `C0001_…`, `C0002_…`.
3. **Shared tables are never changed by this repo.** If a coach feature seems to need a change to an `app` table (for example an "author" column on `app.targets`), the feature stops and the owner decides (C-D7). Claude does not plan or request that change.
4. **Which `app` tables the coach API may write** (everything else is read-only for it):

   | Table | Coach API may… | Why |
   |---|---|---|
   | `app.users` | insert (account setup, same rules as `POST /v1/me`: confirmed email, 18+ confirmation) | Coaches are FitSphere users; links point at `app.users` |
   | `app.user_roles` | insert/delete `coach`, `head_coach` | Switching on a role (REQ-ROLE-001) |
   | `app.links` | insert, end | Accepting and ending coaching links (REQ-ROLE-003/005/014/015) |
   | `app.targets` | **nothing for now**: coach-set targets would change what the trainee app shows (C-D7). Blocked until the owner decides | REQ-ROLE-006 |
   | everything else in `app` | **read only**, and only through the access rules (invariant 1) | Trainee logs are owned by the trainee |

5. **Deleting an account must still work.** Every `coach` table that points at a user uses `on delete cascade` (or is cleaned up by the trainee repo's account deletion), so a user can always be deleted (REQ-ACC-009).
6. **The same privacy rules in both APIs.** Coach access to trainee data only through an accepted link; head coach only with the trainee's Allow; ending a link ends access to past data too; nothing sensitive in logs (invariants 1 and 7).
7. **Test on a copy, not the shared project.** Automated tests use a local test database. Migrations go to the shared project only after the pull request is merged.
8. **Coach migrations only add to schema `coach`.** A courtesy note to Developer 1 is fine but not required: nothing they use changes.

---

