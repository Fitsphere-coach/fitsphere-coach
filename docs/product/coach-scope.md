# FitSphere Coach — Project Scope (v0.4)

| | |
|---|---|
| **Version** | 0.4 — 2026-11-03 |
| **Status** | Owner's scope refinement of 2026-11-03 (decisions C-D10 to C-D15). Items marked **Interpretation** are Claude's reading of the owner's words and stay **Proposed** until the owner confirms them (§11). |
| **Authority** | This file is the scope of record. Where `coach-spec.md` (v0.3) disagrees, this file wins. Project rules in `CLAUDE.md` (C-D7 first) still win over both. |

---

## 1. The product in one paragraph
FitSphere Coach is a separate phone app (Android and iOS) for gyms. A **gym owner** registers the
gym and becomes its **Head Coach** after FitSphere approves the registration. The Head Coach invites
**Coaches**; coaches look after **trainees**, who use the FitSphere (trainee) app. Both apps share
one Supabase project: the same logins and the same database.

---

## 2. Roles

| Role | Who | How they get the role | Uses which app |
|---|---|---|---|
| **Head Coach** | The person who registers a gym | Gym onboarding, approved by FitSphere with a one-time code (§4) | FitSphere Coach |
| **Coach** | A person who coaches trainees in a gym | **Only** by accepting a Head Coach's invitation (§5) | FitSphere Coach |
| **Trainee** (Personal Training User) | A person who logs food, workouts and body data | Signs up in the trainee app | FitSphere app only |

- A Coach belongs to **one** Head Coach (one gym). There are no independent coaches (C-D11).
- A Trainee has at most one Coach.
- A person can be a Coach and also log their own training as a Trainee in the FitSphere app.

---

## 3. What each role can do and see

### 3.1 Coach → Trainee
- Sees the trainees linked to them, and each trainee's food logs, workouts, weight, steps, sleep,
  measurements and progress.
- Sets the trainee's targets and builds their diet and training plans.
- Ending the link ends all access to that trainee's data, including past data.

### 3.2 Head Coach → Coaches and their trainees (C-D12, Interpretation — see §11 Q1)
- **Everything a Coach can do for a trainee, the Head Coach can do for every trainee of every
  Coach in the gym**: see their data, set targets, and build or change their plans.
- The Head Coach also manages the Coaches themselves: invite, see the list, and remove.
- The Head Coach **sees which Coach each trainee belongs to**.
- The Head Coach **never** sees a Coach's own personal training data (food, workouts, body data the
  Coach logs for themselves in the FitSphere app), even when that Coach is also a FitSphere
  trainee (C-D15).
- No Coach or Head Coach ever sees a trainee's app settings or AI consent.

### 3.3 Change log on plans and targets (C-D13)
- Every change to a trainee's targets, diet plan or training plan records **who** made it (name and
  role: Coach or Head Coach) and **when**.
- When a Coach opens a plan or targets, they see the latest change and its author, and can open the
  full change history ("Set by Asha Rao · Head coach · 3 Nov, 14:20").
- History is never edited or deleted, except when the trainee's account is deleted.

---

## 4. Gym onboarding with FitSphere approval (C-D10)

### 4.1 Who goes through it
- A **new person** who opens FitSphere Coach and creates an account (email not yet in FitSphere)
  must onboard a gym before using the app.
- Whether an **existing FitSphere account** (a trainee) may also onboard a gym: §11 Q3.

### 4.2 Steps
1. **Account:** name, email, password, "I am 18 or older", terms (the existing CF01 sign-up).
2. **Gym form:** gym name, address, total number of trainees. More fields will be added later; the
   form and its storage must allow new fields without rework.
3. **Request approval:** the person taps "Send request". The system:
   - saves the request with status **Pending** and an expiry **7 days** from now;
   - creates a **6-digit approval code** (one-time password, OTP);
   - emails the code and the gym details to **FitSphere's approval inbox: `appbayaipower@gmail.com`**.
4. **FitSphere approves:** the FitSphere team checks the gym and, if satisfied, gives the code to the
   gym owner (by phone, message or email; outside the app).
5. **Enter the code:** the gym owner enters the 6-digit code in the app.
   - Correct code within 7 days → request **Approved**; the person becomes **Head Coach** of that gym
     and sees the rest of the app.
   - Wrong code → an error; after **5** wrong tries the code stops working and the owner must send a
     new request (Proposed default, §11 Q5).
6. **Waiting:** until approved, every log in returns to "Enter your approval code", showing when the
   request expires.
7. **Expired:** if 7 days pass without approval, the request expires. The person must **fill in the
   gym form again**, which sends a new code to the approval inbox.

### 4.3 Rules for the code
- 6 digits, random, never shown in the app and never logged.
- Stored only as a one-way hash; the plain code exists only in the approval email.
- Valid for 7 days from the request, for that one request only.
- A new request replaces the previous one; the old code stops working.
- Requests are limited (Proposed: at most 3 per person per day) so the approval inbox cannot be
  flooded.

### 4.4 What needs a decision before building
- **How the server sends the email** to the approval inbox: a new email service is needed (§11 Q4).
  Supabase's own emails cannot send this message.

---

## 5. Coaches join only by invitation (C-D11, C-D14)
- Coaches cannot sign up on their own. A Coach account exists only through a Head Coach's invitation.
- The Head Coach enters the person's email.
- **If that email already has the Coach role**, the app shows: **"This email is already available
  as a Coach. Try a different one."** and no invitation is sent (C-D14). This is a deliberate
  exception to "never reveal whether an email is registered"; it reveals only that the email is
  already a Coach.
- Otherwise:
  - an email with no FitSphere account gets an invitation email with a link to join;
  - an email that is a FitSphere trainee account gets the invitation inside the coach app when they
    log in there with that account (the trainee app is not changed, C-D7).
- Invitations expire after 7 days; at most 20 per Head Coach per day; they can be resent or
  cancelled.
- Accepting makes the person a Coach in that gym. If they are already a FitSphere trainee, their
  personal data stays private from the Head Coach (C-D15).

---

## 6. Trainees
- Trainees use only the FitSphere (trainee) app.
- **Blocked by C-D7 (owner to decide):** a trainee accepting a Coach's invitation, trainees seeing
  coach-set targets and plans, and therefore any Coach or Head Coach access to trainee data. Each of
  these needs a change to the trainee app.

---

## 7. Feature plan

| Code | Feature | Status |
|---|---|---|
| CF00 | Foundation | Done |
| CF01 | Sign-in, sign-up, passwords, log out | Built; phone check in progress. Sign-up's next step changes to gym onboarding (CF02). "Coaching is off" changes to "Onboard your gym / wait for an invitation". |
| **CF02** | **Gym onboarding and FitSphere approval code** (§4) | **Next** — needs §11 Q3 and Q4 answered, then screens designed and approved |
| CF03 | Head Coach invites Coaches; Coach accepts; "already a Coach" check; remove a Coach (§5) | After CF02 |
| CF04 | Trainee list and profile; Head Coach sees each trainee's Coach | Blocked by C-D7 (needs trainee links) |
| CF05 | Targets (Coach and Head Coach) with change log | Blocked by C-D7 |
| CF06 | Training plans with change log | Blocked by C-D7 |
| CF07 | Diet plans with change log | Blocked by C-D7 |
| CF08 – CF12 | Templates, dashboard, notes, check-ins, reports | Later |

---

## 8. What changed from the earlier scope

| Earlier rule | Now |
|---|---|
| Anyone can switch on Coach or Head Coach (C-D3, REQ-ROLE-001) | Head Coach only through approved gym onboarding; Coach only through invitation (C-D10, C-D11) |
| Coaches may work alone | Every Coach belongs to one Head Coach's gym (C-D11) |
| Head Coach sees counts only; a trainee's data only if the trainee taps Allow (C-D3, D-13) | Head Coach can do everything a Coach can, for every trainee in the gym, and sees each trainee's Coach (C-D12, Interpretation) |
| Invitations never reveal whether an email is registered | Exception: inviting an existing Coach shows "already available as a Coach" (C-D14) |
| "Set by" label only | Full change log on targets and plans (C-D13) |
| Sign-up step 3 "Choose your role" | Sign-up step 3 is gym onboarding (C-D10) |

---

## 9. Data this scope adds (schema `coach` only)
- **Gym onboarding requests:** applicant, gym name, address, total trainees, extra fields (open
  key–value set for fields added later), status (Pending / Approved / Expired / Replaced), code hash,
  wrong-try count, created and expiry times.
- **Gyms:** an approved gym and its Head Coach.
- **Gym memberships:** which Coach belongs to which gym (one gym per Coach).
- **Coach invitations:** email, gym, token hash, status, expiry.
- **Change log:** who changed which target or plan, when, and what changed (built with CF05–CF07).
- Head Coach and Coach roles are also written as rows in the shared `app.user_roles` table, exactly
  as the shared database contract allows. Nothing else in schema `app` changes (C-D7).

---

## 10. Rules that do not change
- No impact on the trainee app (C-D7) stays the highest-priority rule.
- All permission checks happen on the coach server; hiding a button is never protection.
- A Head Coach never sees a Coach's personal training data.
- Passwords, tokens, approval codes, emails and health data never appear in logs.
- Tests use made-up data only.
- The organisation standards apply to every task.

---

## 11. Questions for the owner (open)

| # | Question | Proposed answer until decided |
|---|---|---|
| Q1 | "Head Coach can perform every task over the coach that a coach can perform over the trainee": does this mean the Head Coach can do everything a Coach does **for the Coach's trainees** (see data, set targets and plans), or that the Head Coach manages **the Coaches** the way a Coach manages trainees (invite, list, remove, set the Coach's own targets)? | The first, plus inviting, listing and removing Coaches. The Head Coach never sees or sets a Coach's own personal training. |
| Q2 | Today a Head Coach sees a trainee's data only if the trainee taps Allow (D-13). Q1's answer removes that. Should trainees still be told, or asked, that the gym's Head Coach can see their data? | The trainee app is out of scope (C-D7); record as a privacy item for when trainees join. |
| Q3 | Should "a completely new email" be detected on the **log-in** screen? That tells anyone whether an email has an account. | No: **Log in** stays as it is; **Create account** leads to gym onboarding. An existing FitSphere trainee who logs in to the coach app is offered "Onboard a gym" or "Wait for an invitation". |
| Q4 | How should the server email the approval code to `appbayaipower@gmail.com`? Options: a sending service such as Resend (needs a sending domain), or Gmail SMTP with an app password. This is a new external service and needs an architecture decision. | Resend, if FitSphere has a domain to send from; otherwise Gmail SMTP for now. |
| Q5 | Wrong-code limit and request limit. | 5 wrong tries per code; 3 requests per person per day. |
| Q6 | Which extra gym fields come next (phone, city, GST number, …)? | Added later; the form stores them without code changes to the database. |
