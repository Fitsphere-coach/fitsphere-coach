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
  console.error(connectionHelp(error));
  process.exit(1);
}
console.log('Connected to the database.');
try {
  const applied = await migrate(client, migrations);
  console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Nothing to apply.');
} finally {
  await client.end();
}

/** A plain reason for a failed connection. The driver's own message names the host and user,
 * never the password, so it is shown too. */
function connectionHelp(error: unknown): string {
  const code = String((error as { code?: unknown }).code ?? '');
  const message = error instanceof Error ? error.message : String(error);
  const reason =
    code === '28P01' || /password authentication failed/i.test(message)
      ? 'The database password in DATABASE_URL is wrong (or [YOUR-PASSWORD] is still in it).'
      : code === 'ENOTFOUND' || code === 'EAI_AGAIN'
        ? 'The database address in DATABASE_URL was not found. Copy the Session pooler string again.'
        : code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENETUNREACH' || code === 'EHOSTUNREACH'
          ? 'The database did not answer. Use the Session pooler string (not "Direct connection"), check the Supabase project is not paused, and check no firewall blocks port 5432.'
          : /tenant or user not found/i.test(message)
            ? 'The user name in DATABASE_URL is wrong: for the pooler it must be postgres.<project-ref>.'
            : 'Could not connect to the database. Check DATABASE_URL and your internet connection.';
  return `${reason}\nDetail: ${code ? `${code} ` : ''}${message}`;
}
