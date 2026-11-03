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
| C-D10 | 2026-11-03 | **Gym onboarding with a FitSphere approval code.** A new person who creates an account in FitSphere Coach must onboard a gym (gym name, address, total trainees; more fields later) and send a request. The server emails a 6-digit code to FitSphere's approval inbox `appbayaipower@gmail.com`; the gym owner enters it in the app. A correct code within 7 days makes them Head Coach of that gym; after 7 days without approval the request expires and the form must be filled again. Details: `docs/product/coach-scope.md` §4. Supersedes C-D3's "anyone can switch on Head Coach". | Owner (Accepted); details marked Proposed in coach-scope §11 |
| C-D11 | 2026-11-03 | **Coaches join only by a Head Coach's invitation.** No self sign-up as Coach and no independent coaches; every Coach belongs to one Head Coach's gym. Supersedes C-D3's "anyone can switch on Coach" and "coaches may work alone". | Owner (Accepted) |
| C-D12 | 2026-11-03 | **Head Coach powers.** The Head Coach can do everything a Coach can do for a trainee, for every trainee of every Coach in the gym, and sees each trainee's Coach. Supersedes C-D3's "counts only; a trainee's data only if the trainee allows it" (D-13). Still blocked in practice by C-D7 until trainees can be linked. | Owner; **Proposed** reading (coach-scope §11 Q1, Q2) until confirmed |
| C-D13 | 2026-11-03 | **Change log on targets and plans.** Every change records who (name and role) and when; Coaches see the latest author and the full history. | Owner (Accepted) |
| C-D14 | 2026-11-03 | **"Already a Coach" check on invitations.** When a Head Coach invites an email that already has the Coach role, the app shows "This email is already available as a Coach. Try a different one." and sends nothing. A deliberate exception to invariant 3 (it reveals only the Coach role). | Owner (Accepted) |
| C-D15 | 2026-11-03 | **A Coach's personal training stays private.** When an invited Coach is also a FitSphere trainee, the Head Coach never sees that Coach's own personal training data. | Owner (Accepted) |

## Consequences still to apply
- **Scope v0.4** (`docs/product/coach-scope.md`, 2026-11-03) replaces the earlier plan for a
  "Coach spec v0.4": gyms and Head Coach approval (C-D10), invitation-only Coaches (C-D11), Head
  Coach powers (C-D12), change log (C-D13). Supabase Realtime and direct database access stay
  replaced by the coach API.
- **CF01 screens (locked 2026-11-03), four changes before build:** 18+ confirmation on sign-up;
  "Coach" instead of "Assistant coach"; invites for registered users appear inside the app after
  log in; the third sign-up step is "Name your team" (optional).
