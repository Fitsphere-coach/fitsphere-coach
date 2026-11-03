// Migration runner for schema `coach` (shared database contract, rules 1 and 2). Same design as the
// trainee repo's runner, kept apart from it on purpose:
// - this repo's files are named `C0001_name.sql` and recorded in `coach.schema_migrations`, so the
//   trainee repo's runner (which records in `app.schema_migrations`) never sees them;
// - each file runs in one transaction and is recorded with a checksum; a file edited after it was
//   applied is refused;
// - a file that touches schema `app` with DDL is refused before anything runs (contract rule 1).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

export type Migration = { name: string; sql: string };

export class MigrationError extends Error {}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));

const FILE_NAME = /^C\d{4}_[a-z0-9_]+\.sql$/;
// Any fixed number, different from the trainee runner's; it keeps two coach runners apart.
const LOCK_KEY = 4_200_101;

/**
 * Whether a migration changes schema `app`: any statement that starts with a changing verb (create,
 * alter, drop, truncate, comment on, grant, revoke) and names schema `app` or an `app.` object.
 * Pointing a foreign key at an `app` table (`references app.users`) is allowed. Deliberately
 * cautious: a coach function whose body writes to `app` is refused too, and needs Developer 1.
 */
const CHANGING_STATEMENT = /^\s*(create|alter|drop|truncate|comment\s+on|grant|revoke)\b/i;
const NAMES_APP = /("?\bapp"?\s*\.)|(\bschema\s+(if\s+(not\s+)?exists\s+)?"?app"?(\s|;|$))/i;
const FOREIGN_KEY_TO_APP = /\breferences\s+"?app"?\s*\.\s*"?\w+"?/gi;

export function touchesAppSchema(sql: string): boolean {
  // Comments and quoted text ('…') do not count; function bodies ($$…$$) do.
  const code = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^']|'')*'/g, "''");
  return code
    .split(';')
    .some((statement) => CHANGING_STATEMENT.test(statement) && NAMES_APP.test(statement.replace(FOREIGN_KEY_TO_APP, '')));
}

export async function readMigrations(dir: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  const numbers = new Set<string>();
  for (const name of names) {
    if (!FILE_NAME.test(name)) {
      throw new MigrationError(`${name}: coach migration files are named like C0001_name.sql`);
    }
    const number = name.slice(0, 5);
    if (numbers.has(number)) throw new MigrationError(`Two migrations are numbered ${number}`);
    numbers.add(number);
  }
  const migrations = await Promise.all(
    names.map(async (name) => ({ name, sql: await readFile(path.join(dir, name), 'utf8') })),
  );
  for (const migration of migrations) {
    if (touchesAppSchema(migration.sql)) {
      throw new MigrationError(
        `${migration.name} changes schema app, which the trainee repo owns; ask Developer 1 instead`,
      );
    }
  }
  return migrations;
}

/** The same on Windows and Linux checkouts: line endings do not count. */
export function checksum(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

/** Applies the coach migrations not applied yet, in order, and returns their names. */
export async function migrate(client: pg.ClientBase, migrations: Migration[]): Promise<string[]> {
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    await client.query('create schema if not exists coach');
    await client.query(`
      create table if not exists coach.schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )`);
    // Same rule as schema app: row level security on, no policies, so Supabase's anon and
    // authenticated roles can read nothing; the API connects as the tables' owner.
    await client.query('alter table coach.schema_migrations enable row level security');

    const { rows } = await client.query<{ name: string; checksum: string }>(
      'select name, checksum from coach.schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));
    const known = new Set(migrations.map((migration) => migration.name));
    for (const name of applied.keys()) {
      if (!known.has(name)) throw new MigrationError(`${name} was applied but is missing from this checkout`);
    }
    for (const migration of migrations) {
      const recorded = applied.get(migration.name);
      if (recorded !== undefined && recorded !== checksum(migration.sql)) {
        throw new MigrationError(`${migration.name} was edited after it was applied; add a new migration instead`);
      }
    }

    const done: string[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      await client.query('begin');
      try {
        await client.query(migration.sql);
        await client.query('insert into coach.schema_migrations (name, checksum) values ($1, $2)', [
          migration.name,
          checksum(migration.sql),
        ]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
      done.push(migration.name);
    }
    return done;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
  }
}
