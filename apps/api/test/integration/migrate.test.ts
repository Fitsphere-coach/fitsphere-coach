// The coach migration runner on a real database (shared database contract, rules 1 and 2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { migrate, MigrationError, readMigrations } from '../../src/db/migrate.ts';
import { connect } from './database.ts';

let client: pg.Client;
beforeAll(async () => {
  client = await connect();
});
afterAll(async () => {
  await client.end();
});

describe('coach migrations', () => {
  it('are recorded in coach.schema_migrations, never in app.schema_migrations', async () => {
    const coach = await client.query<{ name: string }>('select name from coach.schema_migrations order by name');
    expect(coach.rows.map((row) => row.name)).toEqual((await readMigrations()).map((m) => m.name));
    const app = await client.query<{ count: string }>(
      "select count(*) from information_schema.tables where table_schema = 'app' and table_name = 'schema_migrations'",
    );
    // The fixture files do not create app.schema_migrations (the trainee runner does), and the
    // coach runner must not either.
    expect(app.rows[0]?.count).toBe('0');
  });

  it('running again applies nothing', async () => {
    expect(await migrate(client, await readMigrations())).toEqual([]);
  });

  it('refuses a migration edited after it was applied', async () => {
    const migrations = await readMigrations();
    const edited = migrations.map((m, i) => (i === 0 ? { ...m, sql: `${m.sql}\n-- edited` } : m));
    await expect(migrate(client, edited)).rejects.toThrow(MigrationError);
  });

  it('refuses when an applied migration is missing from the checkout', async () => {
    await expect(migrate(client, [])).rejects.toThrow(/missing from this checkout/);
  });

  it('keeps row level security on for coach.schema_migrations', async () => {
    const { rows } = await client.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'coach.schema_migrations'::regclass",
    );
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it('every coach table has row level security on', async () => {
    const { rows } = await client.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'coach' and c.relkind = 'r'`,
    );
    for (const row of rows) expect([row.relname, row.relrowsecurity]).toEqual([row.relname, true]);
  });
});
