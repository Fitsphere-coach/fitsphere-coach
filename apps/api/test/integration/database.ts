// The local or CI test database. Synthetic data only. The tests drop and recreate schemas app and
// coach, so they refuse to run against Supabase.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

/** TEST_DATABASE_URL from the environment (CI) or from apps/api/.env (the PC). */
export function testDatabaseUrl(): string {
  let url = process.env.TEST_DATABASE_URL;
  const envFile = new URL('../../.env', import.meta.url);
  if (!url && existsSync(envFile)) {
    // Only this one value is taken from the file.
    url = parseEnv(readFileSync(envFile, 'utf8')).TEST_DATABASE_URL;
  }
  if (!url) throw new Error('TEST_DATABASE_URL is not set: see apps/api/.env.example');
  if (!/^postgres(ql)?:\/\/[^/]+\/[^/?]+/.test(url)) {
    throw new Error('TEST_DATABASE_URL must look like postgres://postgres:<password>@localhost:5432/fitsphere_coach_test');
  }
  if (/supabase\.(co|com)/i.test(url)) {
    throw new Error('TEST_DATABASE_URL must be a local or CI database, never Supabase');
  }
  return url;
}

export async function connect(url: string = testDatabaseUrl()): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

const APP_SCHEMA_DIR = fileURLToPath(new URL('../fixtures/app-schema/', import.meta.url));

/** Builds schema app from the copy of the trainee repo's migrations (test database only). */
export async function createAppSchema(client: pg.ClientBase): Promise<void> {
  const names = (await readdir(APP_SCHEMA_DIR)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of names) {
    await client.query(readFileSync(path.join(APP_SCHEMA_DIR, name), 'utf8'));
  }
}

const PROPOSED_DIR = fileURLToPath(new URL('../fixtures/proposed-app/', import.meta.url));

/** The app changes TCR-001 proposes, so inviting can be tested before they exist (test database only). */
export async function createProposedAppTables(client: pg.ClientBase): Promise<void> {
  const names = (await readdir(PROPOSED_DIR)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of names) {
    await client.query(readFileSync(path.join(PROPOSED_DIR, name), 'utf8'));
  }
}

/** A synthetic FitSphere account with the given roles, as the trainee API would create it. */
export async function insertAccount(
  client: pg.ClientBase,
  roles: string[] = ['personal'],
): Promise<{ id: string; subject: string; email: string }> {
  const id = randomUUID();
  const subject = randomUUID();
  const email = `user-${id}@example.test`;
  await client.query(
    `insert into app.users (id, auth_subject, email, age_confirmed_at, age_confirmation_text_version)
     values ($1, $2, $3, now(), 'synthetic')`,
    [id, subject, email],
  );
  for (const role of roles) {
    await client.query('insert into app.user_roles (user_id, role) values ($1, $2)', [id, role]);
  }
  return { id, subject, email };
}
