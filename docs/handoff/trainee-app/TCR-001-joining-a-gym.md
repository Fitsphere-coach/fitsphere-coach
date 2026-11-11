# TCR-001: Joining a gym (trainee accepts a gym invitation)

| | |
|---|---|
| Status | **Ready for owner** (review the open questions in §11, then send to Developer 1) |
| Written by | Coach team (Developer 2), 2026-11-11 |
| For | Developer 1 — trainee app (`fitsphere`) |
| Coach feature that depends on it | CF04 (client management, SPEC-001): adding, listing, moving and removing trainees |
| Coach decisions | C-D18, C-D19, C-D21, C-D23, C-D24, C-D26, C-D28; ADR-0002, ADR-0006 |
| Trainee-repo items it delivers | New: a trainee's invitation, consent and display name (no existing REQ; Developer 1 to assign IDs) |

## 1. Why
A Coach or Head Coach adds a trainee by email (C-D18). The trainee creates their own FitSphere account if they have none (C-D23) and, on logging in, sees an invitation from the gym with **Accept** and **Decline**. Accepting records the trainee's consent to share their data with the **gym** (their coach and the gym's Head Coach, C-D26) and creates the link. Nothing is shared before that. The coach app cannot show a trainee's name or data until this exists.

## 2. User flow
1. A Coach or Head Coach enters the trainee's email in FitSphere Coach (choosing, for a Head Coach, "under myself" or "under a Coach", C-D21). The coach server saves an invitation (§5) and, if the email has no FitSphere account, emails a link.
2. **New trainee:** opens the link, which opens the FitSphere app (or the store page), creates their own account (own password, "I am 18 or older", their **name**), logs in, and sees the invitation pop-up.
3. **Existing trainee:** logs in to the FitSphere app and sees the invitation pop-up.
4. The pop-up names the gym and the coach, and states exactly what will be shared (§4).
5. **Accept:** the server records the consent, creates the link to the assigned coach, marks the invitation accepted. The trainee's data is now visible to the gym from this moment (C-D26) and "My coach" shows in Account.
6. **Decline**, or 7 days without an answer: nothing is linked; the invitation is marked declined or expired.
7. If the trainee already has an active coach (any gym), accepting is refused: a trainee is in one gym only (C-D19).

## 3. Screens and states
**Invitation pop-up** (a modal over the trainee's home, shown on every log in until answered; also a card in Account → "Coaching"):
- Top to bottom: gym icon tile · "{Gym name} invited you" · "{Coach name} ({Head coach|Coach}) would like to coach you." · a card "What the gym will see" (list in §4) · a card "What the gym can do" · the consent text · primary **Accept** · secondary **Decline**.
- States: loading; accepting (spinner, buttons disabled); accepted ("You're with {Gym name}" with a button to Account); declined (closes); **expired** ("This invitation has expired. Ask {Coach name} to send a new one."); **no longer valid** (cancelled by the coach: "This invitation was cancelled."); **already has a coach** ("You already have a coach. Ask them to remove you before joining a new gym."); offline (accept and decline need internet; "Connect to the internet to answer").
- Account → Coaching: "My coach" row (name, gym) once linked; "Pending invitation" row when one waits. **There is no Leave button** (C-D18: only the coach or Head Coach removes a trainee).
- Account setup: a **Name** field (2–60 characters) at sign-up and in Account, so coaches can recognise the trainee (§5). Existing trainees without a name are asked for it when they accept.

## 4. Exact copy
(Draft; **Legal must review the consent text before real users**, C-D28.)
- Title: "{Gym name} invited you"
- Intro: "{Coach name} ({Head coach / Coach}) at {Gym name} would like to coach you in FitSphere."
- **What the gym will see:** "Your meals and food log · Your workouts · Your weight and body measurements · Your steps and sleep · Your targets and progress"
- **Who:** "Your coach, {Coach name}, and the gym's Head Coach, {Head Coach name}. If you are moved to another coach in this gym, the new coach can see the same."
- **What the gym can do:** "Set your targets and build your diet and training plans. Coach-set targets and plans replace your own, and you will see who set them."
- **What stays private:** "Your app settings, your AI consent and your account details. Your own logs are never shown to other gyms."
- **After it ends:** "If your coach or the gym removes you, they stop seeing anything new. The gym keeps read-only access to what you logged up to that day." (C-D28)
- **Your control:** "You can decline now. Only your coach or the gym's Head Coach can end the link."
- Buttons: "Accept" · "Decline"
- Accepted: "You're with {Gym name}." · Expired / cancelled / already-has-a-coach texts as in §3.
- Invitation email (sent by the coach server, not the trainee server): "{Coach name} at {Gym name} invited you to FitSphere. Open the FitSphere app and create your account with this email to accept." with the link.
- Consent text version string: `gym-consent-2026-11-11` (Developer 1 may rename; keep it stable, it is stored with each consent).

## 5. Data (schema `app`; Developer 1 writes the migration)
Next trainee-repo migration number; all tables with row level security on and no policies, `on delete cascade` for account deletion (REQ-ACC-009), like the existing tables.

```sql
-- The trainee's name, so coaches can recognise them. Nullable for old accounts.
alter table app.users
  add column full_name text
  check (full_name is null or (char_length(full_name) between 2 and 60 and full_name = btrim(full_name)));

-- A gym's invitation to a trainee (ADR-0006: lives in `app` because the trainee app answers it).
create table app.coach_invitations (
  id uuid primary key default gen_random_uuid(),
  -- The gym is identified by its Head Coach's user id. The coach server checks the gym; this
  -- table never points at schema `coach` (ADR-0002).
  gym_head_coach_id uuid not null references app.users (id) on delete cascade,
  -- Who becomes the trainee's coach: the Head Coach or one of the gym's Coaches (C-D21).
  assigned_coach_id uuid not null references app.users (id) on delete cascade,
  invited_by_id uuid not null references app.users (id) on delete cascade,
  invitee_email text not null check (invitee_email = lower(invitee_email)),
  -- Filled in when the invitee has an account (found by email, or after they sign up).
  invitee_user_id uuid references app.users (id) on delete cascade,
  -- Keyed hash of the email link's token; the plain token exists only in the email.
  token_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz
);
-- One pending invitation per email and gym.
create unique index coach_invitations_one_pending
  on app.coach_invitations (gym_head_coach_id, invitee_email) where status = 'pending';
create index coach_invitations_invitee on app.coach_invitations (invitee_user_id) where status = 'pending';
create index coach_invitations_email on app.coach_invitations (invitee_email) where status = 'pending';

-- The trainee's consent, one row per answer, append-only (like app.ai_consents).
create table app.coach_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references app.users (id) on delete cascade,
  invitation_id uuid not null references app.coach_invitations (id) on delete cascade,
  consented boolean not null,
  text_version text not null check (char_length(text_version) between 1 and 32),
  recorded_at timestamptz not null
);
create index coach_consents_user on app.coach_consents (user_id, recorded_at desc);
```
- Expiry (7 days; the value is `TRAINEE_INVITE_VALID_DAYS`, ADR-0008, the same number the coach server uses) is **worked out when read**; no job. The coach server sets `expires_at`.
- **What the coach server does** (shared database contract, rule 4, to be updated by Developer 1's change): inserts invitations; sets `cancelled`; inserts and ends `app.links` (kind `coach_trainee`) when a Head Coach **moves** a trainee (end the old link with reason `switched`, start a new one, no new consent, C-D26) or **removes** one (reason `removed`). It only reads `app.coach_consents`. It never writes `accepted` or `declined`: only the trainee server does.
- `app.links` is unchanged: its existing unique index (`links_one_active_per_lower`) already gives one active coach per trainee.
- Not synced to the phone database: invitations and consent are **online only**.

## 6. API changes in the trainee server
All routes need the trainee's own token and account (the same access rules as the other `/v1/me` routes).
- `GET /v1/me/gym-invitations` → pending, non-expired invitations for this user: `{ id, gymName, coachName, coachRole, headCoachName, expiresAt }`. The gym name and coach names come from the **coach server's data**; since the trainee server must not read schema `coach` (ADR-0002), the coach server stores these three display texts on the invitation. **Add to the table:** `gym_name text not null`, `assigned_coach_name text not null`, `head_coach_name text not null` (copied at invitation time).
- `POST /v1/me/gym-invitations/{id}/accept` body `{ consentTextVersion }` → in **one transaction**: re-check pending and not expired; refuse if the user already has an active `coach_trainee` link; insert the consent row (`consented = true`); insert the link (`upper = assigned_coach_id`, `lower = the trainee`, `kind = coach_trainee`, `status = active`, `started_at = now()`); mark the invitation accepted. Returns the link summary.
- `POST /v1/me/gym-invitations/{id}/decline` → consent row (`consented = false`) and status `declined`.
- `POST /v1/me/gym-invitations/claim` body `{ token }` (the email link, new account): finds the pending invitation by token hash and the signed-in user's confirmed email; sets `invitee_user_id`. Refuses if the emails differ.
- Sign-up and `PUT /v1/me` accept `fullName`.
- Error codes follow the trainee API's error model; add `INVITATION_EXPIRED`, `INVITATION_NOT_AVAILABLE`, `ALREADY_HAS_COACH`.
- **Never reveal whether an email is registered** (invariant 3): the claim route answers the same for a wrong token and a wrong email.

## 7. Rules and permissions
- Only the invited person can see or answer their invitation. Another user's id answers 404.
- Accepting creates exactly one link; a second accept of the same invitation does nothing.
- A trainee cannot leave: there is no route for it (C-D18).
- A Coach cannot be a trainee in their own gym (C-D24): the **coach server** refuses this when inviting (it can see its own gyms). The trainee server additionally refuses if the accepting user holds an active `head_coach_coach` link to the invitation's `gym_head_coach_id`, or is that Head Coach.
- A coach-role user may be a trainee elsewhere (they keep a personal account).
- Account deletion deletes the invitations and consents (cascade); active links end with reason `account_deleted` as today.

## 8. Acceptance criteria
- Given a pending invitation, when the trainee taps Accept, then a consent row (`consented = true`, the text version, the time), an active link to the assigned coach, and an `accepted` invitation exist together, or none do.
- Given an invitation 7 days old, when the trainee opens it, then it shows as expired and Accept is refused with `INVITATION_EXPIRED`.
- Given the coach cancelled the invitation, then the trainee sees "no longer valid" and cannot accept.
- Given the trainee already has an active coach, when they accept, then `ALREADY_HAS_COACH` and nothing changes.
- Given Decline, then no link exists and the gym sees nothing.
- Given another user's invitation id, then 404.
- Given a new email with an invitation link, when they create their account and enter the name, then the invitation appears; a different email cannot claim it.
- Given the trainee is linked, then Account shows "My coach", and there is no way to leave.
- Given the accept request is repeated, then still one link and one consent.

## 9. Tests Developer 1 should add
Unit tests for expiry and the refusal rules; integration tests (real database) for: the accept transaction (all or nothing), a second accept, an expired invitation, a cancelled invitation, an existing coach, another user's id, the claim route's identical answers, and cascade on account deletion; permission tests that the trainee server never reads schema `coach`; a phone check of the pop-up in both themes with the text size at maximum.

## 10. How the coach side depends on it
CF04 cannot go live until this is Done: the coach server writes invitations, reads linked trainees' names and data through `app.links`, and moves and removes trainees by ending and starting links. Until then the coach app's "Invite client" stays off. **The coach side is already built** against the tables in section 5 (CF04 pull request), switched off by `TRAINEE_INVITES_ENABLED=false`: nothing reads a table that does not exist yet. The integration tests create those tables from `apps/api/test/fixtures/proposed-app/0009_tcr001_proposed.sql`, a **proposed** copy of section 5. **If Developer 1 changes any table, column or name, tell the coach team:** the coach code (`apps/api/src/invitations.ts`) and that fixture must change to match, then the switch is turned on after both migrations are applied.

## 11. Open questions for the owner (answer before sending)
1. **Consent and after-link text:** Legal review of §4 (especially "the gym keeps read-only access", C-D28).
2. **The name field:** is adding `app.users.full_name` acceptable, or should the name live in `app.settings`-like personal data that the coach sees only for linked trainees?
3. **Deep link and store links** for the invitation email (FitSphere has no domain, ADR-0005); the app's scheme (`fitsphere://invite?token=…`) and what a phone without the app sees.
4. **Existing accounts:** do they get the invitation in the app only (recommended, no email), or also an email?
5. **Display texts on the invitation** (`gym_name`, `assigned_coach_name`, `head_coach_name`) are copied at invitation time and can go stale if a name changes. Acceptable?
