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
| C-D7 | 2026-11-03 | **No impact on the trainee app.** Nothing done for the coach app may affect Developer 1 or the trainee app: no changes or requests in the `fitsphere` repo, no changes to schema `app`, and no coach writes that change what the trainee app shows. A coach feature that would need a trainee-app change is stopped and raised with the owner. This narrows C-D3/C-D4 and the shared database contract wherever they asked Developer 1 for work. | Coach developer |
| C-D8 | 2026-11-03 | **Email verification uses the link, not a 6-digit code.** The shared Supabase project's sign-up email contains a link; changing it would change the trainee app's email (C-D7). The coach app's Verify step asks the coach to tap the link, which opens FitSphere Coach. Everything else in the CF01 screens is as approved. | Claude (forced by C-D7), reported to the owner |
| C-D6 | 2026-11-03 | The phone app starts on **Expo Go** (no cloud builds) until a native module needs a development build. | Coach developer (default) |
| C-D9 | 2026-11-03 | **Sign-up goes straight on when Supabase sends no verify email.** The shared Supabase project has "Confirm email" switched off (found in the CF01 phone check: every account is confirmed on creation and no confirmation email is ever sent). Switching it on would change the trainee app's sign-up (C-D7), so the coach app adapts: when sign-up returns a session, the coach skips "Verify your email" and continues as after log in. The link flow (C-D8) stays for when Supabase sends a link. Email ownership is then checked exactly as in the trainee app (not at all while the setting is off). | Coach developer (owner), on Claude's recommendation |

## Consequences still to apply
- **Coach spec v0.4:** "Organisation" becomes the Head Coach's team; "Assistant coach" is "Coach";
  independent coaches are allowed; the Head Coach's trainee view follows D-13; Supabase Realtime and
  direct database access are replaced by the coach API.
- **CF01 screens (locked 2026-11-03), four changes before build:** 18+ confirmation on sign-up;
  "Coach" instead of "Assistant coach"; invites for registered users appear inside the app after
  log in; the third sign-up step is "Name your team" (optional).
