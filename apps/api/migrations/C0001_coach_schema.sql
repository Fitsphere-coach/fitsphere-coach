-- CF00: the coach schema (shared database contract, rule 1). The runner has already created schema
-- coach and coach.schema_migrations. This file records who owns the schema; CF01 and later add the
-- coach tables. Every coach table: row level security on with no policies (the API connects as the
-- owner), and `on delete cascade` on any reference to app.users (contract rule 5).

comment on schema coach is
  'Owned by the fitsphere-coach repo. Changed only by its migrations (coach.schema_migrations). Schema app belongs to the fitsphere repo.';
