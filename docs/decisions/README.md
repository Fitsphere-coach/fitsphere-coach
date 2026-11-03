# Decisions — FitSphere Coach

Decisions made for this repo. IDs start with **C-D** so they never clash with the trainee repo's D-
numbers.

| ID | Date | Decision | Decided by |
|---|---|---|---|
| C-D1 | 2026-11-03 | FitSphere Coach is a **separate app in its own repo**, `fitsphere-coach`. This replaces the trainee repo's reading of D-02 ("coaches use the same app"). | Coach developer (owner of the coach app) |
| C-D2 | 2026-11-03 | Both apps use **one Supabase project**: the same sign-in accounts and the same database. | Coach developer |
| C-D3 | 2026-11-03 | The coach app follows the trainee repo's **accepted coach rules**: REQ-ROLE-001 to 017, D-06, D-10, D-11, D-13, D-14 and its invariant 1. Anyone can switch on Coach or Head Coach; a trainee has at most one coach and a coach at most one Head Coach, by invitation; a Head Coach sees a trainee's name and data only if the trainee allows it (counts otherwise); invites to registered users arrive inside the app; invites expire after 7 days, 20 per day. (No preference was given, so the recommended option applies.) | Coach developer (default) |
| C-D4 | 2026-11-03 | Coach targets always win over the trainee's own edits (coach spec CQ-04; trainee repo REQ-PLAN-001). | Coach developer |
| C-D5 | 2026-11-03 | Same technology as the trainee app: Expo + TypeScript; a TypeScript Node.js API as the only path to the data; Supabase Auth tokens checked on the server; Supabase's Data API off. This repo owns schema `coach`. | Coach developer |
| C-D6 | 2026-11-03 | The phone app starts on **Expo Go** (no cloud builds) until a native module needs a development build. | Coach developer (default) |

## Consequences still to apply
- **Coach spec v0.4:** "Organisation" becomes the Head Coach's team; "Assistant coach" is "Coach";
  independent coaches are allowed; the Head Coach's trainee view follows D-13; Supabase Realtime and
  direct database access are replaced by the coach API.
- **CF01 screens (locked 2026-11-03), four changes before build:** 18+ confirmation on sign-up;
  "Coach" instead of "Assistant coach"; invites for registered users appear inside the app after
  log in; the third sign-up step is "Name your team" (optional).
