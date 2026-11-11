// Runs once before the integration tests: a fresh schema app (from the trainee repo's migrations,
// copied into test/fixtures/app-schema) and a fresh schema coach with every coach migration applied.
import { migrate, readMigrations } from '../../src/db/migrate.ts';
import { connect, createAppSchema, createProposedAppTables } from './database.ts';

export default async function setup() {
  const client = await connect();
  try {
    await client.query('drop schema if exists coach cascade');
    await client.query('drop schema if exists app cascade');
    await createAppSchema(client);
    // TCR-001's proposed tables, until Developer 1 delivers the real ones (see the fixture file).
    await createProposedAppTables(client);
    await migrate(client, await readMigrations());
  } finally {
    await client.end();
  }
}
