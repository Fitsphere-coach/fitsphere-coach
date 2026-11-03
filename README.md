# FitSphere Coach

The coaches' app for FitSphere: Head Coaches manage Coaches, Coaches manage trainees. It shares one
Supabase project (sign-in and database) with the trainee app in `pradeepKumawatPalara/fitsphere`.

| Folder | What |
|---|---|
| `apps/mobile` | The FitSphere Coach phone app (Expo, TypeScript) |
| `apps/api` | The coach API (Node.js, Fastify): the only path to the data |
| `packages/shared` | Types and validation shared by the app and the API |
| `docs` | Spec, design, decisions, the shared database contract and the runbook |

Set-up and commands: `docs/operations/runbook.md`. Rules for working in this repo: `CLAUDE.md`.
