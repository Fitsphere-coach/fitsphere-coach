// npm run migrate -w @fitsphere-coach/api: applies new coach migrations to DATABASE_URL (the
// session pooler of the shared Supabase project). Only after the pull request is merged, and tell
// Developer 1 first (shared database contract, rule 8).
import pg from 'pg';
import { migrate, readMigrations } from '../src/db/migrate.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

// Read and check the files before connecting: a file that touches schema app stops here.
const migrations = await readMigrations();

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
} catch (error) {
  const code = (error as { code?: unknown }).code;
  console.error(
    code === '28P01'
      ? 'Could not connect: the database password in DATABASE_URL is wrong.'
      : 'Could not connect to the database. Check DATABASE_URL and your internet connection.',
  );
  process.exit(1);
}
console.log('Connected to the database.');
try {
  const applied = await migrate(client, migrations);
  console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Nothing to apply.');
} finally {
  await client.end();
}
