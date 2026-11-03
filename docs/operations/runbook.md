# Runbook — FitSphere Coach

## 1. Set up a computer (once)
1. Install **Git**, **Node.js 24** and **VS Code**. For the integration tests, also a local
   **PostgreSQL 17** (or Docker).
2. Clone: `git clone https://github.com/pradeepKumawatPalara/fitsphere-coach D:\fitsphere-coach`
3. Copy `apps/api/.env.example` to `apps/api/.env` and fill it in (never committed).
4. Copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill it in.
5. `npm install` in the repo folder.
6. Install **Expo Go** on your phone.

## 2. Configuration names

| Name | Where | What | Secret? |
|---|---|---|---|
| `DATABASE_URL` | `apps/api/.env` | Supabase → **Connect** → *Session pooler* connection string, with the database password. Same project as the trainee app. | **Yes** |
| `SUPABASE_URL` | `apps/api/.env` | `https://<project-ref>.supabase.co` | No |
| `SUPABASE_PUBLISHABLE_KEY` | `apps/api/.env` | Supabase → Project Settings → API keys → publishable key (`sb_publishable_…`) | No |
| `PORT` | `apps/api/.env` | Optional; default `3100` (the trainee API uses 3000, so both can run on one PC) | No |
| `TEST_DATABASE_URL` | `apps/api/.env` or CI | Local test database, e.g. `postgres://postgres:postgres@localhost:5432/fitsphere_coach_test`. **Never Supabase**: the tests drop and recreate schemas `app` and `coach` | No |
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` | Same as `SUPABASE_URL` | No |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/mobile/.env` | Same as `SUPABASE_PUBLISHABLE_KEY` | No |
| `EXPO_PUBLIC_API_URL` | `apps/mobile/.env` | Where the phone reaches the coach API, e.g. `http://192.168.1.20:3100` on the same Wi-Fi, or a tunnel address while testing. Never commit a tunnel address. | No |

## 3. Commands

| Command | What it does |
|---|---|
| `npm run dev -w @fitsphere-coach/api` | Runs the coach API on this PC (port 3100) |
| `npm run migrate -w @fitsphere-coach/api` | Applies new `coach` migrations to `DATABASE_URL`. **Only after the pull request is merged, and tell Developer 1 first** (contract rule 8). Prints "Connected" first, so it also checks the database password. |
| `npm start -w @fitsphere-coach/mobile` | Starts the phone app; scan the QR code with Expo Go |
| `npm run lint` / `npm run typecheck` / `npm test` | Checks and unit tests |
| `npm run test:integration` | API and database tests against `TEST_DATABASE_URL` |

## 4. Reaching the API from the phone
The API listens on this PC. For Expo Go on the same Wi-Fi, set `HOST=0.0.0.0` in `apps/api/.env`
and `EXPO_PUBLIC_API_URL=http://<this PC's Wi-Fi address>:3100`. Use test accounts only, and turn
`HOST` back off after testing.
