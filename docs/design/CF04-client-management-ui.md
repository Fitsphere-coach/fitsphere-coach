# CF04 — Client management (SPEC-001): UI design (DRAFT, owner review)

| | |
|---|---|
| **App** | FitSphere Coach (Expo, iOS + Android) |
| **Status** | **UI approved by the owner, 2026-11-11.** Screens are in the "FitSphere Coach Screens" canvas (rows "SPEC-001 · Client management", dark and light). **Built:** client list (2.1, 2.2), profile (2.5), change coach (2.6), remove client (2.7). **Waiting for Developer 1 (TCR-001):** invite a client (2.3, 2.4), the trainee's real name, and the Inactive and Invited filters. Until then the list shows each client's email. |
| **Source spec** | `spec/SPEC-001-client-management.md` (business draft). Where it disagrees with `docs/product/coach-scope.md` v0.4 or a C-D decision, the scope and the decisions win (CLAUDE.md). |
| **Depends on** | CF02 (the Head Coach exists), CF03 (Coaches exist), **TCR-001** (trainee accepts a gym invitation; Developer 1, C-D22) |
| **Scope/decisions** | coach-scope §3.4, §6; C-D12, C-D15, C-D18, C-D19, C-D20, C-D21, C-D23, C-D24, C-D26, C-D28 |

All visual values come from `docs/design/design-system.md`. UPPERCASE text is rendered by the style.

## 1. How SPEC-001 maps to the scope

| SPEC-001 says | What the product does | Why |
|---|---|---|
| "Gym Owner" and "Head Coach" are separate roles | One role: the gym owner **is** the Head Coach | coach-scope §2 |
| Staff add a client by entering a profile | Staff **invite by email**; the trainee creates their own account and accepts | C-D23 |
| Coach can be assigned to a client; maybe several | **One coach per trainee** (database rule); a Head Coach may keep a trainee under themselves | coach-scope §2, C-D21, `app.links` unique index |
| Delete or deactivate a client | **Remove** ends the link and keeps the history read-only; nothing is deleted | C-D18, C-D28 |
| Profile: date of birth, gender, address, height, goal, membership | The FitSphere app holds **no** such fields. The coach sees the trainee's **name** (new, TCR-001) and what they log: weight, targets, meals, workouts, steps, sleep | shared database (`app` schema) |
| Prevent duplicate clients | "This trainee is already added." The database allows one active coach per trainee | C-D19 |
| A Coach does not see every gym client | A Coach sees **their own** trainees; the Head Coach sees all and which Coach each belongs to | C-D12 |
| Search and filter by status and coach | Same; the coach filter shows for the Head Coach only | SPEC-001 §4.1 |

## 2. Screens

### 2.1 Client list (Head Coach shown)
Eyebrow "{Gym} · Head coach" · title "CLIENTS" · "{n} clients in your gym. Coaches see only their own." · **search** (name, email) · filter chips **All / Active / Inactive / Invited** with counts · **coach filter** ("COACH · All coaches", Head Coach only) · rows (avatar initial, name, "Logged today · Coach Ravi Kumar", status chip) · primary "INVITE CLIENT".
- **Active:** an active link. **Inactive:** removed; read-only history stays in the gym (C-D28). **Invited:** a pending invitation.
- A Coach sees the same screen without the coach filter, listing only their trainees.
- States: loading, empty (2.2), no search results ("No clients match."), offline (the cached list, read-only), error.

### 2.2 No clients yet
Tile · "NO CLIENTS / YET" · "Invite a trainee by email. When they accept in the FitSphere app, they appear here and you can see what they log." · "INVITE CLIENT".

### 2.3 Invite a client
Back "CLIENTS" · "INVITE A / CLIENT" · "Enter their email. They accept in the FitSphere app, and you see their data once they do." · **Client email** · **Add under** (Head Coach only): "Myself" or "A coach" (then a coach picker, C-D21; a Coach always adds under themselves) · info "The invite works for 7 days. You can cancel it any time." · "SEND INVITE".
- Already in the gym: error under the email, **"This trainee is already added."** (C-D19); nothing is sent.
- The email of a Coach in this gym is refused (C-D24).
- The result never reveals whether the email has a FitSphere account (invariant 3): always 2.4.

### 2.4 Invite sent
Success tile · "INVITE / SENT" · "We emailed {email}. When {name} accepts in the FitSphere app, they appear in your clients. The invite expires in 7 days." · "BACK TO CLIENTS", "INVITE ANOTHER". Pending invitations can be cancelled or resent from the Invited filter.

### 2.5 Client profile
Back · avatar, name, status chip · **Coach** card ("Ravi Kumar", "Since 3 Nov 2026"; the Head Coach sees each client's coach) · **Progress** card: latest weight, calorie target, protein target, workouts this week, last logged · **Plans and schedule** card: Training plan (CF06), Diet plan (CF07), Calendar (CF09) — each "Not set yet" until those features exist · "CHANGE COACH" (Head Coach only) · "REMOVE CLIENT".
- Nothing here is shown for a Coach's own personal training (C-D15). Notes and the full trainee tabs (nutrition, training, progress) are CF04's trainee profile views (TPRO-*).

### 2.6 Change coach (sheet, Head Coach only)
"MOVE TO A COACH" · "{Name} stays your gym's client. The new coach sees their data, and the change is recorded." · radio list: the gym's Coaches (current one marked) and "Myself" with client counts · "MOVE CLIENT", "CANCEL". No new consent is needed (C-D26).

### 2.7 Remove client (sheet)
"REMOVE {NAME}?" · "This ends your link with {Name}. You will not see anything new they log. History up to today stays in your gym, read-only. Nothing is deleted, and {Name} keeps their FitSphere account." · "REMOVE CLIENT" (danger colour), "KEEP CLIENT". A Head Coach can remove any client in the gym; a Coach only their own (C-D18).
- Removing a **Coach** is CF03: refused while the Coach still has trainees (C-D20).

## 3. Rules the server enforces (not the screens)
- Authorization is server-side: a Coach cannot open a trainee who is not theirs; the Head Coach can open any trainee of the gym.
- Invite: refuse an already-added email (C-D19), a Coach of this gym (C-D24), and more than the daily limit (`INVITES_PER_DAY`, ADR-0008). Seven-day expiry.
- Move: in one transaction end the old link (reason `switched`) and start the new one; the new upper user must be a Coach of the same gym or the Head Coach.
- Remove: end the link (reason `removed`); no data deleted.
- Every move and removal is logged with who and when.

## 4. Not in CF04
Multiple coaches per client; coach-entered profile fields (date of birth, address, membership) and notes (CF10 for notes; the rest needs a new decision); permanent deletion; a separate Gym Owner role.

## 5. Open questions for the owner
1. Is "Logged today" (last activity) the right line under the name, or would you prefer weight or adherence?
2. The Invited filter: should a pending invitation also show in the main list as a faded row?
3. Should the Head Coach also be able to **cancel** a Coach's pending invitation to a trainee? (Proposed: yes.)
4. SPEC-001's "to be confirmed" items (mandatory fields, membership) are answered by the table in §1; confirm.
