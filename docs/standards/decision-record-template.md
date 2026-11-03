# Project Decisions

> Purpose: Record important technical and architectural decisions so that developers
> and AI coding assistants can understand what has been decided, why it was decided,
> and what constraints must be respected.
>
> This is a project convention, not a special built-in Claude Code file format.

## How to Use This File

- Record decisions that meaningfully affect architecture, security, data, dependencies,
  deployment, maintainability, cost, or future implementation.
- Keep entries concise, specific, and understandable.
- Record the decision and its reasoning, not just the chosen technology.
- Use `Proposed` while a decision is still under discussion.
- Use `Accepted` only after the decision is actually approved.
- Use `Rejected` for options considered but not selected, when that context is useful.
- Do not guess missing facts or mark assumptions as approved decisions.
- If a decision changes, do not silently rewrite history. Add a new decision that
  supersedes the old one and link the entries.
- Update the index below when adding a decision.
- Keep implementation details that can be discovered from the code out of this file
  unless they explain an important constraint or rationale.

## Status Definitions

- **Proposed** — Suggested, but not approved.
- **Accepted** — Approved and currently in effect.
- **Rejected** — Considered but not selected.
- **Superseded** — Replaced by a later decision. Link the newer decision.
- **Deprecated** — No longer recommended; migration or removal may be pending.

## Decision Index

| ID | Title | Status | Date | Supersedes / Superseded by |
|---|---|---|---|---|
| D-001 | Replace this row with the first decision | Proposed | YYYY-MM-DD | — |

---

## Decisions

### D-001: Backend Framework

**Status:** Accepted

**Decision:** Use Fastify with TypeScript.

**Why:** We want a lightweight API framework with request validation and good performance.

**Alternatives:** Express, NestJS.

---

## Decision Record Template

Copy this section for each new decision. Replace all placeholders and remove fields
that genuinely do not apply. Do not leave example text presented as a real decision.

### D-XXX: Short, Specific Decision Title

**Status:** Proposed

**Decision:** State exactly what is being chosen. Make this specific enough that someone can
implement it without guessing about the central choice.

**Why:** Explain why this option is preferred, including the most important trade-offs
and constraints.

**Alternatives:** List the realistic alternatives considered and briefly explain why
they were or were not selected. Do not invent alternatives that were not considered.
If no alternatives were assessed, write `Not formally assessed`.

**Date:** YYYY-MM-DD

**Decision owner / approver:** Name or role, if applicable.

**Scope:** Component, service, or area affected.

**Related decisions:** D-XXX, or `None`.

**Supersedes:** D-XXX, or `None`.

**Consequences:** Note expected benefits, trade-offs, drawbacks, and risks where relevant.

**Implementation Guidance:** List constraints or requirements that implementation must respect.

**Validation:** Explain how the decision will be verified, such as through tests, reviews,
security checks, performance targets, or operational checks.

**Open Questions:** List unresolved questions, or write `None`.

---

## Decision-Making Rules

1. **Do not invent approval.** If the user has not approved a consequential choice,
   keep it `Proposed` or ask for clarification when necessary.
2. **Follow accepted decisions.** Before proposing a conflicting change, identify the
   relevant decision ID and explain why a change may be needed.
3. **Handle conflicts explicitly.** If decisions contradict one another, do not silently
   choose one. Explain the conflict and request clarification unless an existing
   documented precedence rule resolves it.
4. **Use reasonable defaults for low-impact gaps.** If a minor implementation detail
   is missing, choose a sensible option consistent with accepted decisions and record
   the assumption where useful.
5. **Escalate material uncertainty.** Ask before making a materially consequential,
   irreversible, security-sensitive, costly, or data-destructive decision when the
   available requirements do not resolve it.
6. **Preserve history.** When changing a decision, add a new record and mark the old
   record `Superseded`, with links between the two.
7. **Keep records factual.** Separate confirmed requirements, approved decisions,
   assumptions, and proposals.
8. **Do not treat this file as a substitute for safeguards.** Follow repository
   permissions, security controls, review requirements, tests, and deployment
   approval rules.

## Optional Decision Categories

Use a category in the title or scope when helpful. Examples:

- Architecture and system boundaries
- Languages, frameworks, and libraries
- APIs and integration contracts
- Database and data modelling
- Authentication and authorization
- Security, privacy, and encryption
- Infrastructure, deployment, and scaling
- Reliability, monitoring, and logging
- Testing and quality standards
- Cost, licensing, and vendor choices

## Change Log

| Date | Change | Related decision |
|---|---|---|
| YYYY-MM-DD | Initial decision log created | — |
