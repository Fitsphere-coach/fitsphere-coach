# Feature board — FitSphere Coach

One feature at a time: UI designed → owner approves → build (API, database, screens, tests) → owner
tries it on the phone → DONE.

| # | Feature | Spec IDs | Status |
|---|---|---|---|
| CF00 | Foundation: repo, coach API skeleton (token check, access rules, `GET /v1/me`), coach schema and migration runner, phone app shell with the FitSphere theme, CI | CNFR-001…006 | **Done** (merged; C0001 applied 2026-11-03) |
| CF01 | Coach sign-in, sign-up, verify (link), coaching off, password, log out | CAUTH-001, 003, 004, 005, 006 | **Built — owner's phone check pending** |
| CF01b | Accepting a coach invite (link and in-app card) — built with CF03, when invites can be sent | CAUTH-002 | Moved to CF03 |
| CF02 | Switch on Coach / Head Coach, name your team | ORG-001/002 → REQ-ROLE-001 | Not started |
| CF03 | Invites and links — **trainee side blocked by C-D7** (a trainee accepting an invite needs the trainee app; owner to decide). Coach ↔ Head Coach links work inside the coach app | LINK-*, TEAM-002…004, REQ-ROLE-003/005/008/009/011/014/015/017 | Not started |
| CF04 | Trainee list and profile (read-only) | TRNE-*, TPRO-* | Not started |
| CF05 | Coach-set targets — **blocked by C-D7** (trainees would see new targets in their app; owner to decide) | CTGT-* | Not started |
| CF06 | Exercise library and training plans | EXL-*, CTRN-* | Not started |
| CF07 | Diet plans | CDIET-* | Not started |
| CF08 | Templates | TPL-* | Not started |
| CF09 | Dashboard, adherence, flags, activity | MON-001…004 | Not started |
| CF10 | Notes, comments, notifications | COMM-001…003 | Not started |
| CF11 | Weekly check-ins | MON-005 | Not started |
| CF12 | Reports, team view, audit log | RPT-*, TEAM-005, AUD-001 | Not started |
