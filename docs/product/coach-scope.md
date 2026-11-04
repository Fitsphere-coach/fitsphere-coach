# FitSphere Coach — Project Scope (v0.4)

| | |
|---|---|
| **Version** | 0.4.1 — 2026-11-04 (adds who can add and remove whom, a trainee once per gym, and moving a removed Coach's trainees, §3.4) |
| **Status** | Owner's scope refinement of 2026-11-03 and 2026-11-04 (decisions C-D10 to C-D20), with the owner's answers of the same day (§11). C-D16 (how the approval email is sent) is **Proposed** until the owner accepts it. |
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

### 3.2 Head Coach → Coaches and their trainees (C-D12, confirmed by the owner)
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

### 3.4 Who can add and remove whom (C-D18, owner 2026-11-04)
Adding and removing only works **downwards**: the person higher up decides.

| Who | Can add | Can remove | Cannot remove |
|---|---|---|---|
| Head Coach | Coaches and trainees in the gym | Coaches and trainees in the gym | — |
| Coach | Their own trainees | Their own trainees | Their Head Coach |
| Trainee | — | — | Their Coach or their Head Coach |

- A Coach cannot leave or remove their Head Coach. Only the Head Coach can remove a Coach from the gym.
- A trainee cannot leave or remove their Coach or Head Coach, for now. Only a Coach or the Head Coach can remove a trainee.
- "Add" always means sending an invitation that the person accepts (§5); nobody is added without accepting.
- Removing someone ends the link: the remover loses all access to that person's data, including past data, and no data is deleted.
- **A trainee is added to a gym only once** (C-D19). If the trainee is already in the gym, whether
  added by their Coach or by the Head Coach, a second add shows **"This trainee is already added."**
  and sends nothing. This reveals nothing new: everyone who can add trainees in that gym can already
  see that trainee.
- When the Head Coach adds a trainee, the Head Coach chooses which of the gym's Coaches the trainee
  belongs to, or keeps the trainee as their own (Proposed, §11 Q8).
- **Before removing a Coach, the Head Coach moves every one of that Coach's trainees** to another
  Coach in the gym or to themselves (C-D20). The removal is refused while the Coach still has
  trainees, so no trainee is ever left without a coach.
- Adding and removing trainees waits for the trainee side (§6, C-D7).

---

## 4. Gym onboarding with FitSphere approval (C-D10)

### 4.1 Who goes through it
- **Everyone who uses the coach app without a Coach or Head Coach role follows the same route**,
  whether or not they already have a FitSphere (trainee) account (owner's answer to Q3):
  - a **new person** taps **Create account**, makes the account, then onboards a gym;
  - a person who **logs in** with an existing FitSphere account that has no coach role goes straight
    to gym onboarding.
- **Log in stays as it is** (owner's answer to Q2): the log-in screen never reveals whether an email
  has an account. New people start from **Create account**.
- A person who has a **pending Coach invitation** sees it on the same screen and can accept it
  instead of onboarding a gym (§5).

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
   - Wrong code → an error; after the **wrong-try limit** (5) the code stops working and the owner
     must send a new request.
6. **Waiting:** until approved, every log in returns to "Enter your approval code", showing when the
   request expires.
7. **Expired:** if 7 days pass without approval, the request expires. The person must **fill in the
   gym form again**, which sends a new code to the approval inbox.
8. **Approved once, approved for good:** after the code is accepted, the gym is approved
   permanently. Every later log in, on any phone, goes straight into the app as Head Coach. The app
   never asks to onboard the gym or enter a code again, and the 7-day limit no longer applies.

### 4.2a Where each log in goes
The server decides from the account's saved state, not from the phone, so the answer is the same on
every phone and after reinstalling the app.

| Account state | Where log in goes |
|---|---|
| Head Coach of an approved gym | Straight into the app (home) |
| Coach in a gym (accepted invitation) | Straight into the app (home) |
| Request sent, not approved, within 7 days | "Enter your approval code" |
| Request expired (7 days passed) | The gym form, to send a new request |
| No coach role and no request (new account or FitSphere trainee) | The gym form; any pending Coach invitation shows on the same screen |

### 4.3 Rules for the code
- Random digits, never shown in the app and never logged.
- Stored only as a one-way hash; the plain code exists only in the approval email.
- Valid for one request only; a new request replaces the previous one and the old code stops
  working.
- Requests are limited per person per day so the approval inbox cannot be flooded.

### 4.4 Settings kept in a configuration file (C-D17, owner's answer to Q5)
These values live in **one configuration file** in the coach server, not in the code, so they can be
changed later by editing the file and restarting the server, with no code change:

| Setting | Starting value |
|---|---|
| Approval inbox (where codes are emailed) | `appbayaipower@gmail.com` |
| Code length | 6 digits |
| Days a request stays valid | 7 |
| Wrong tries allowed per code | 5 |
| Requests allowed per person per day | 3 |
| Days a Coach invitation stays valid | 7 |
| Coach invitations allowed per Head Coach per day | 20 |

- The server checks the file when it starts and refuses to start if a value is missing or out of a
  sensible range (generic code practices DC-5).
- The file holds **no secrets**. Passwords for sending email stay in `apps/api/.env`.

### 4.5 How the approval email is sent (C-D16, Proposed until the owner accepts)
- FitSphere has **no website domain**, so services that need one (for example Resend) are not an
  option now (owner's answer to Q4).
- **Proposed:** the coach server sends the email through **Gmail**, signed in to a Gmail account
  with a Google **app password** (a separate password Google creates for one app). The sending
  account can be `appbayaipower@gmail.com` itself, emailing its own inbox.
- The Gmail address and app password are kept only in `apps/api/.env`, never in the repo or logs.
- Limits to know: Gmail allows a few hundred emails a day from one account, which is far more than
  gym requests need; Google may block sign-in if the app password is removed.
- Supabase's own emails cannot be used: they only send sign-in emails to the account's own address.
- If FitSphere gets a domain later, the sender can move to a service such as Resend by changing the
  email settings, without changing the onboarding feature.

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
- Only the Head Coach can remove a Coach; a Coach cannot leave the gym on their own (C-D18).

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
| **CF02** | **Gym onboarding and FitSphere approval code** (§4) | **Next** — owner accepts C-D16, then screens are designed and approved |
| CF03 | Head Coach invites Coaches; Coach accepts; "already a Coach" check; Head Coach removes a Coach; Coaches cannot leave (§5, §3.4) | After CF02 |
| CF04 | Coach or Head Coach adds and removes trainees; trainee list and profile; Head Coach sees each trainee's Coach (§3.4) | Blocked by C-D7 (needs trainee links) |
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
| Head Coach sees counts only; a trainee's data only if the trainee taps Allow (C-D3, D-13) | Head Coach can do everything a Coach can, for every trainee in the gym, and sees each trainee's Coach (C-D12) |
| Invitations never reveal whether an email is registered | Exception: inviting an existing Coach shows "already available as a Coach" (C-D14) |
| "Set by" label only | Full change log on targets and plans (C-D13) |
| Sign-up step 3 "Choose your role" | Sign-up step 3 is gym onboarding (C-D10) |
| "Coaching is off" offers "Switch on coaching" | Every account without a coach role goes to gym onboarding, trainee or not; pending Coach invitations show on the same screen |
| Limits written in the code | Onboarding and invitation limits live in a configuration file (C-D17) |
| Either side can end a link; trainees and coaches can leave (REQ-ROLE-014, coach spec LINK-004) | Only the person higher up removes: Head Coach removes Coaches and trainees, Coach removes trainees; Coaches and trainees cannot leave (C-D18) |

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

## 11. Owner's answers and open questions

| # | Question | Status |
|---|---|---|
| Q1 | What "Head Coach can perform every task over the coach that a coach can perform over the trainee" means | **Answered 2026-11-03:** the Head Coach can do everything a Coach does for the Coach's trainees (see data, set targets and plans), and also invites, lists and removes Coaches. Never sees or sets a Coach's own personal training (C-D12, C-D15). |
| Q2 | Detect a "completely new email" on the log-in screen? | **Answered:** no. Log in stays as it is; Create account leads to gym onboarding (§4.1). |
| Q3 | Does an existing FitSphere trainee who logs in follow a different route? | **Answered:** no. Every account without a coach role follows the same gym onboarding route (§4.1). |
| Q4 | How the server emails the approval code | **Answered:** FitSphere has no domain. **Proposed** answer: Gmail with an app password (C-D16, §4.5); waits for the owner's acceptance. |
| Q5 | Wrong-try and request limits | **Answered:** keep them in a configuration file so they change without code (C-D17, §4.4). Starting values: 5 wrong tries, 3 requests a day. |
| Q6 | Which extra gym fields come next (phone, city, GST number, …) | Open. The form stores extra fields without database changes. |
| Q7 | Trainees are no longer asked to "Allow" the Head Coach (C-D12). Should trainees be told, or asked, when trainees join? | Open. Recorded as a privacy item for when the trainee side is unblocked (C-D7). |
| Q8 | Can the same trainee be added twice in one gym, and whose trainee are they when the Head Coach adds them? | **Answered 2026-11-04:** a trainee is added to a gym only once, by their Coach or the Head Coach; a second add shows "This trainee is already added." (C-D19). Still **Proposed**: the Head Coach chooses which Coach the trainee belongs to, or keeps them. |
| Q9 | When the Head Coach removes a Coach, what happens to that Coach's trainees? | **Answered 2026-11-04:** the Head Coach first moves them to another Coach or to themselves; removal is refused until the Coach has no trainees (C-D20). |
