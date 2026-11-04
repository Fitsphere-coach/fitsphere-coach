# Architecture Decision Records — FitSphere Coach

Each ADR follows the architecture decision framework (`docs/standards/architecture-decision-framework.md`):
pass/fail gates for security, privacy, legal and ownership, then a weighted score. An ADR is
**Proposed** until the owner approves it; only the owner marks it **Accepted**. A changed decision
gets a new ADR that supersedes the old one.

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-0001](ADR-0001-system-architecture.md) | System architecture and boundaries | Accepted | 2026-11-04 |
| [ADR-0002](ADR-0002-database-ownership.md) | Shared database ownership, migrations and where coach data lives | Accepted | 2026-11-04 |
| [ADR-0003](ADR-0003-auth-and-permissions.md) | Sign-in and permissions (roles, gym hierarchy, adding and removing) | Accepted | 2026-11-04 |
| ADR-0004 | Gym onboarding and approval-code security | Not written yet | — |
| ADR-0005 | Sending the approval email | Not written yet | — |
| ADR-0006 | Gym, membership and invitation data model | Not written yet | — |
| ADR-0007 | Change log for targets and plans | Not written yet | — |
| ADR-0008 | Settings in a configuration file | Not written yet | — |
| ADR-0009 | Phone app delivery (Expo Go now, app builds later) | Not written yet | — |
| ADR-0010 | Where the coach server runs | Not written yet | — |
