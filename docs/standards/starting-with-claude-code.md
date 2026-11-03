# Starting the Application with Claude Code — Business Guide

Oct 21, 2026 · @Unnati Sharma

Start the application in six steps: agree goals and owners, load the skills zip into Claude Code, choose the architecture, record and approve decisions, build one feature at a time, and release only on evidence. Each step uses one of the five project files below.

| File | What it controls | Used in step |
| --- | --- | --- |
| Skills zip (5 skills + CLAUDE.md) | Rules Claude follows while coding: architecture, API and data, testing, reliability, security and delivery | 2, 5 |
| Application Architecture Decision Framework | How the architecture is chosen and scored | 3 |
| DECISIONS.md | Record of approved technical choices (D-001: Fastify + TypeScript, Accepted) | 4, 6 |
| STANDARD\_IT\_TESTING\_RULES.md | Testing, quality gates and release sign-off rules | 1, 3, 5, 6 |
| Claude Skills list | Plugin skills: feature-dev, frontend-design, security review, claude-security, webapp-testing | 2, 5 |

## Step 1 — Prepare (business owner + tech lead)

No code is written until the business owner has signed off on goals, owners and risk level.

1. Write the business goal, target users and the first features (for example: login, cloud account connection, data extraction, search).
2. Name the owners: business owner, tech lead, QA lead and security reviewer (testing rules GOV-004, GOV-014).
3. Set the risk tier. The app stores personal data and cloud tokens, so treat it as high risk (Tier 1–2, Annex 2).
4. Agree acceptance criteria per feature: success path, failure path, and which roles can and cannot act (REQ-009 to REQ-012).

## Step 2 — Set up Claude Code and load the skills zip

The project folder must look like this before the first prompt, so Claude reads the rules automatically.

```
project-root/
├── CLAUDE.md                      ← always-on rules (read on every task)
├── docs/DECISIONS.md
├── docs/STANDARD_IT_TESTING_RULES.md
├── docs/Architecture_Decision_Framework.docx
└── .claude/skills/
    ├── architecture-and-design/SKILL.md
    ├── api-and-data/SKILL.md
    ├── testing-and-quality/SKILL.md
    ├── reliability-and-observability/SKILL.md
    └── security-and-delivery/SKILL.md
```

1. Create the project repository and install Claude Code; open it from the project root.
2. Unzip the skills package into `.claude/skills/`. Each skill needs its own folder with a `SKILL.md` directly inside (no extra nested folder from the zip).
3. Place `CLAUDE.md` at the root. Add one line telling Claude to follow `docs/DECISIONS.md` and `docs/STANDARD_IT_TESTING_RULES.md`. Fill in Project Commands (install, run, test, lint, build) once the stack is set.
4. Install the plugin skills (feature-dev, frontend-design, security review, claude-security, webapp-testing) with `/plugin` from an approved marketplace. Check the publisher before installing, as the skills list requires.
5. Confirm setup: ask Claude "Which skills and project rules can you see?" All five skills and CLAUDE.md should be listed.

## Step 3 — Choose the architecture

Claude proposes and scores the options; the business owner approves. Start prompt: *"Using the architecture-and-design skill and the Architecture Decision Framework, propose and score the architecture for this app."*

1. Claude lists requirements, measurable quality targets (speed, uptime, recovery) and constraints (budget, team skills, compliance).
2. Claude compares options and scores each 1–5 using the framework weights: security 20%, maintainability 20%, reliability 15%, performance 15%, scalability 10%, cost 10%, integration 10%.
3. Security, privacy and legal needs are pass/fail. A high score cannot outweigh a failure on these.
4. Default candidate is a modular monolith. Microservices or serverless need a proven business reason.
5. Claude writes a test strategy from the testing rules: scope, risk tier, test levels, entry and exit criteria, synthetic test data only (PLAN-001, TDATA-003).

## Step 4 — Record and approve decisions

Every architecture and technology choice goes into DECISIONS.md, and only the business owner can make it Accepted. Start prompt: *"Record each choice from Step 3 in DECISIONS.md as Proposed, using its template."*

1. Claude adds one entry per choice: decision, why, alternatives, date, owner, scope and consequences.
2. Each entry stays **Proposed** until the approver reviews it and sets it to **Accepted** or **Rejected**. Claude never accepts its own proposals.
3. Claude follows all Accepted decisions. Any change that conflicts must cite the decision ID and be approved first.
4. A changed decision gets a new entry that supersedes the old one, and the index table is updated each time.

Housekeeping: the index row for D-001 still shows a placeholder; update it to match the record (Fastify + TypeScript, Accepted, with date and approver).

## Step 5 — Build one feature at a time

Suggested order: authentication → cloud connections → data extraction → screens (login, account cards, data tables, search and filters).

| Stage | Skill to use | Who checks |
| --- | --- | --- |
| Plan and build the feature (7 phases: discovery to summary) | feature-dev + architecture-and-design, api-and-data | Tech lead answers Claude's clarifying questions |
| Design the screens | frontend-design | Business owner reviews look and flow |
| Check failure handling and logging | reliability-and-observability | Tech lead |
| Security review: login, cross-user access, OAuth tokens, encryption, SQL injection, open endpoints | claude-security / security review + security-and-delivery | Security reviewer, before the feature is accepted |
| Test and verify browser flows | testing-and-quality, then webapp-testing | QA lead |

A feature is **done** only when:

- [ ] Acceptance criteria pass, including failure and permission cases
- [ ] Claude ran format, lint, type-check, test and build, and reported what it did not verify
- [ ] No tests were deleted, skipped or weakened to pass
- [ ] A person other than the author reviewed the code before merge (STAT-001, PRIN-004)

## Step 6 — Release and keep the rules current

Release is a business decision made on recorded evidence, not on Claude's or anyone's assurance (GOV-016).

1. Check exit criteria: requirement coverage, open defects by severity, mandatory test types complete (PLAN-012).
2. List untested requirements as gaps (REQ-016). Any test dropped for time needs written business-owner risk acceptance (PLAN-020).
3. After each production deployment, run a post-deployment check of health and critical paths (LVL-016).
4. Keep DECISIONS.md current as decisions change (Step 4).
5. Review the skills and CLAUDE.md after each release based on real results, and the testing standard at least yearly (GOV-020).
