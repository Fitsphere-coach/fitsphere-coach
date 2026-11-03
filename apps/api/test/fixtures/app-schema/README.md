# Copy of the trainee repo's schema `app`

These SQL files are copied from `pradeepKumawatPalara/fitsphere`, `apps/api/migrations/`, at commit
`497e7b9` (2026-11-03). The integration tests apply them to the **local or CI test database** so
schema `app` exists there, then apply this repo's `coach` migrations on top.

- Never apply these files to Supabase: the trainee repo owns them (shared database contract, rule 1).
- When the trainee repo adds a migration, copy the new file here and update the commit above.
