# CF02 — Gym onboarding and FitSphere approval code: UI design (LOCKED)

| | |
|---|---|
| **App** | FitSphere Coach (Expo, iOS + Android) |
| **Status** | UI approved by the owner on 2026-11-11 ("UI approved, build CF02") |
| **Scope** | `docs/product/coach-scope.md` §4; ADR-0004 (the code), ADR-0005 (the email), ADR-0008 (settings); C-D10, C-D25 |
| **Depends on** | CF01 (sign-in, the shared auth layout), `docs/design/design-system.md` |
| **Design source** | "FitSphere Coach Screens" canvas in Claude: the CF02 rows (dark, then light) |

All visual values come from `docs/design/design-system.md`. Copy in quotes is exact. UPPERCASE text
is rendered by the style; write it in sentence case in code. Layout is the CF01 auth layout
(CF01-coach-auth-ui.md §3): stripes top right, wordmark + COACH tag, heading block, footer pinned
to the bottom.

## 1. Decisions taken in design

| Topic | Decision |
|---|---|
| Gym form fields | Gym name, address, city, pincode, owner phone, total number of trainees, and an optional website or Instagram link. Answers coach-scope Q6. The first six are required; the link is optional and is stored in the open extra fields. |
| Where the code goes | Only to FitSphere's approval inbox. The app never shows it; the owner types the code FitSphere gives them. |
| Wrong codes | A wrong code is an answer, not an error: "You have N tries left." The 5th wrong code locks the request. |
| Step label | "Gym onboarding" on the form and "Request sent" on the code screen (the sign-up flow has no step count in scope v0.4). |
| Both themes | Every screen is drawn in dark and light with the design-system tokens. |

## 2. Flow (where each log in goes, coach-scope §4.2a)

The server decides from the saved state, so the answer is the same on every phone.

| Account state | Screen |
|---|---|
| Head Coach or Coach | Straight into the app |
| No request, or a new account | Gym form |
| Request sent, not approved, within 7 days | Enter your approval code |
| Request expired | Request expired |
| Request locked (5 wrong codes) | Too many wrong tries |

Gym form → (send) → Enter your approval code → (right code) → You're a Head Coach → home.

## 3. Screens

### 3.1 Gym form (`/gym-form`)
1. Wordmark + COACH (no back)
2. "GYM ONBOARDING" (step style) · heading "REGISTER" / "YOUR GYM"
3. Sub: "Tell us about your gym. FitSphere checks every gym before you become its Head Coach."
4. **Gym name** (placeholder "Iron Gym") · **Address** ("Street and area") · **City** and **Pincode** side by side ("6 digits") · **Owner phone** ("+91", hint "FitSphere may call this number to check your gym.") · **Total number of trainees** ("e.g. 120") · **Website or Instagram (optional)** ("Link to your gym online")
5. Primary "SEND REQUEST →" (disabled until the six required fields are valid) · text link "LOG OUT"

| State | What shows |
|---|---|
| empty / incomplete | Button disabled |
| ready | Button enabled |
| sending | Spinner in the button; fields 60 % |
| not sent (email failed) | Error banner "Couldn't send your request. Check your connection and try again. This didn't use up one of your requests today."; button "TRY AGAIN" |
| limit reached | Error banner "You have sent the most requests allowed today. Try again tomorrow." |
| offline / server | The CF01 offline / try-later banners |

Rules: pincode is 6 digits; the phone is an Indian number (10 digits, optional +91 or 0); trainees
is a whole number from 1 to 100,000.

### 3.2 Enter your approval code (`/approval-code`)
"REQUEST SENT" · heading "ENTER YOUR" / "APPROVAL CODE" · sub "FitSphere is checking your gym. When it is approved, they will give you a 6-digit code. Enter it here." · six code boxes (the design system's Code input; one hidden input with one-time-code and paste) · info banner "This request expires in 6 days, on 18 Nov, 14:20." · primary "APPROVE MY GYM →" (disabled until every digit is entered) · links "SEND A NEW REQUEST", "LOG OUT".

| State | What shows |
|---|---|
| wrong code | Boxes in `danger`; banner "That code didn't match. You have 3 tries left. Check the code FitSphere gave you."; boxes cleared |
| right code | Goes to You're a Head Coach |
| 5th wrong code | Goes to Too many wrong tries |
| expired meanwhile | Goes to Request expired |

The number of boxes is the server's code length setting (6 by default). Dates are India time.

### 3.3 Too many wrong tries (`/request-locked`)
Lock tile · heading "TOO MANY" / "WRONG TRIES" · "This request is locked after too many wrong codes. Send a new request and FitSphere will give you a new code. The old code will stop working." · info banner "You can send N more requests today." (or "You have used today's requests. You can send a new one tomorrow." and the button is disabled) · primary "SEND A NEW REQUEST →" · secondary "LOG OUT".

### 3.4 Request expired (`/request-expired`)
Clock tile · heading "REQUEST" / "EXPIRED" · "Requests work for 7 days. Fill in your gym details again to send a new one. FitSphere will give you a new code, and your earlier code no longer works." · the same requests-left banner · primary "START AGAIN →" · secondary "LOG OUT".

### 3.5 You're a Head Coach (`/gym-approved`)
Success tile with a tick · "APPROVED" · heading "YOU'RE A" / "HEAD COACH" · "**Iron Gym** is approved. You can now invite Coaches and add trainees. You will not need a code again." · primary "GO TO HOME →". Approved once, approved for good: every later log in goes straight into the app.

### 3.6 Coaching is off (`/coaching-off`, changed)
Now only for a signed-in account that was never set up for the coach app. No "Switch on coaching" button. Rows: "Set-up not finished" and "Joining someone's team?". Log out only.

## 4. Accessibility
Same rules as CF01 §5. The code boxes are announced as one field, "Approval code", with the value "3 of 6 digits entered". Errors are announced next to the cause. The pincode, phone and trainees fields open the number keyboards. Status is never colour alone: every banner has an icon and words.

## 5. Out of scope for CF02
Inviting Coaches (CF03), the Head Coach home screen (CF09), FitSphere's own approval tool (approval is by email, ADR-0004).
