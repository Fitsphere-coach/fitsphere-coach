# FitSphere Coach — new repo and shared database guide

| | |
|---|---|
| **Date** | 2026-11-03 |
| **Decided by** | FitSphere Coach developer (owner of the coach app) |
| **Repos** | Trainee app: `pradeepKumawatPalara/fitsphere` (Developer 1). Coach app: **`fitsphere-coach`** (new, Developer 2) |
| **Shared** | One Supabase project: the same sign-in accounts (Supabase Auth) and the same PostgreSQL database |
| **Send to** | Developer 1, so both repos follow the same database rules (§4) |

---

## 1. Decisions (2026-11-03)

| # | Decision |
|---|---|
| C-D1 | FitSphere Coach is a **separate app in its own repo**, `fitsphere-coach`. This replaces the trainee repo's D-02 reading ("coaches use the same app"). |
| C-D2 | Both apps use **one Supabase project**: same accounts, same database. |
| C-D3 | The coach app follows the trainee repo's **accepted coach rules** (no preference given, so the recommended option applies): REQ-ROLE-001 to 017, D-06, D-10, D-11, D-13, D-14 and project invariant 1. In short: anyone can switch on Coach or Head Coach; a trainee has at most one coach and a coach at most one head coach, by invitation; a head coach sees a trainee's name and data **only if the trainee taps Allow**, otherwise counts only; invites to registered users arrive **inside the app** (the inviter never learns whether an email is registered); invites expire after 7 days, 20 per day. |
| C-D4 | Coach targets always win over the trainee's own edits (coach spec CQ-04, matches invariant 2 / REQ-PLAN-001). |
| C-D5 | Same technology as the trainee app: Expo (React Native) + TypeScript for the phone app; a TypeScript Node.js API (Fastify) as the **only path to the data**; Supabase Auth tokens checked on the server. Supabase's Data API stays off. |

**Consequences for the coach spec (to update in v0.4):** the "Organisation" becomes the head coach's **team** (a head coach plus the coaches who accepted them); "Assistant coach" is called **Coach**; independent coaches (no head coach) are allowed; the head coach's trainee view follows D-13; direct Supabase access and Realtime are replaced by the coach API (live updates by refresh/polling first).

**Consequences for the CF01 screens (locked today):** four small changes before build:
1. Sign-up adds the **18+ confirmation** checkbox (REQ-ACC-010; the account cannot be created without it).
2. "Assistant coach" → "Coach" everywhere.
3. A registered user's invite appears **inside the coach app after log in** (a "Pending invites" list), not via an email link. The email link screen stays only for **unregistered** emails.
4. The 3rd sign-up step is "Name your team" (optional), not "Set up your organisation".

---

## 2. How the pieces fit

```mermaid
flowchart LR
  subgraph T[Repo: fitsphere - Developer 1]
    TA[FitSphere app<br/>apps/mobile] --> TAPI[Trainee API<br/>apps/api]
  end
  subgraph C[Repo: fitsphere-coach - Developer 2]
    CA[FitSphere Coach app<br/>apps/mobile] --> CAPI[Coach API<br/>apps/api]
  end
  subgraph S[One Supabase project]
    AUTH[Supabase Auth<br/>same accounts]
    subgraph DB[(PostgreSQL)]
      APP[schema app<br/>owned by trainee repo]
      COACH[schema coach<br/>owned by coach repo]
    end
  end
  TA -. sign in .-> AUTH
  CA -. sign in .-> AUTH
  TAPI --> APP
  CAPI --> COACH
  CAPI -- reads trainee data, writes agreed tables only --> APP
```

- Each app signs in with Supabase Auth and sends its token to **its own API**. Each API checks the token and every permission itself.
- Neither phone app ever touches the database directly.

---

## 3. What goes in the new repo

Same layout as the trainee repo, so either developer can read both:

```
fitsphere-coach/
├── CLAUDE.md                  rules for Claude Code in this repo (incl. §4 below)
├── .claude/rules/             invariants (copied from the trainee repo + shared-DB rules)
├── apps/
│   ├── mobile/                FitSphere Coach (Expo, expo-router, TypeScript)
│   └── api/                   Coach API (Fastify, pg, jose)
│       └── migrations/        coach-owned SQL, schema "coach" only
├── packages/shared/           request/response types and validation
├── docs/
│   ├── product/coach-spec.md
│   ├── design/design-system.md, CF01-coach-auth-ui.md, …
│   ├── contracts/shared-database.md   ← the agreement in §4
│   └── decisions/             C-D1… and ADRs
└── .github/workflows/ci.yml   lint, typecheck, tests
```

---

## 4. Shared database rules (both repos must follow)

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

## 5. Your steps (Developer 2)

### Step 1 — Create the repo (5 min)
1. On GitHub, signed in as `pradeepKumawatPalara`: **New repository** → name `fitsphere-coach` → **Private** → no README → Create.
2. Give Claude access: GitHub → Settings → Applications → Claude → Configure → add `fitsphere-coach` (or "All repositories").
3. Tell Claude: "repo created". Claude sets up the repo (§3), the shared-database rules and CI, and pushes it.

### Step 2 — Set up this computer (30 min)
1. Install **Git**, **Node.js 24** and **VS Code**.
2. Clone: `git clone https://github.com/pradeepKumawatPalara/fitsphere-coach D:\fitsphere-coach`
3. Create `apps\api\.env` (never committed):
   ```
   DATABASE_URL=<session pooler connection string, with the database password>
   SUPABASE_URL=https://vmieqpjevwkdagshbyyo.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<publishable key>
   ```
   The `DATABASE_URL` is in Supabase → **Connect** → *Session pooler*. It's the same value Developer 1 has.
4. Create `apps\mobile\.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://vmieqpjevwkdagshbyyo.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   ```
5. `npm install`
6. Install **Expo Go** on your phone (the coach app starts on Expo Go, so no cloud builds are needed at first).
7. Optional: install the **Claude desktop app**, open this chat and link the `D:\fitsphere-coach` folder, so Claude can run the API and migrations on this PC.

### Step 3 — Check the password and apply the first migration
`npm run migrate -w @fitsphere-coach/api`. If it says "connected" and lists `C0001`, the password is correct. Tell Developer 1 first (rule 8).

### Step 4 — The feature loop
The same loop as today, one feature at a time: **UI → you approve → Claude builds the API, database and screens with tests → you try it on your phone → done**.

| # | Feature | What you get |
|---|---|---|
| CF00 | Foundation | Repo, both apps running, theme, coach schema, CI, the API checking tokens |
| CF01 | Coach sign-in (screens already designed, 4 changes in §1) | Sign up, verify, log in, invites for unregistered emails, forgot/change password, log out |
| CF02 | Switch on Coach / Head Coach, name your team | Role set-up after sign-up |
| CF03 | Invites and links | Head coach invites coaches; coach invites trainees; pending invites list; **needs the trainee app's Accept screen** (Developer 1) |
| CF04 … | Trainee list and profile, targets, plans, dashboard | As in `coach-spec.md` §17 |

## 6. What Developer 1 needs to do (send this part)
- Agree to §4, and keep a copy at `docs/contracts/shared-database.md` in the trainee repo.
- Record in the trainee repo that a separate coach app now exists (C-D1). D-20 still applies to the **trainee app's** scope.
- Later, when the coach features reach them: author columns on `app.targets` and plans; showing invites and the Allow/Decline request in the trainee app; showing coach-set targets as read-only.
