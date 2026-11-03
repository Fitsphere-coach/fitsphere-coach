import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checksum, MigrationError, readMigrations, touchesAppSchema } from './migrate.ts';

async function dirWith(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'coach-migrations-'));
  for (const [name, sql] of Object.entries(files)) await writeFile(path.join(dir, name), sql);
  return dir;
}

describe('touchesAppSchema (shared database contract, rule 1)', () => {
  it.each([
    'create table app.coach_notes (id uuid);',
    'ALTER TABLE app.targets ADD COLUMN author_id uuid;',
    'alter table "app".targets add column x int;',
    'drop table if exists app.links;',
    'create index on app.links (status);',
    'create unique index links_x on app.links (kind);',
    'truncate app.users;',
    'comment on table app.users is $$x$$;',
    'create or replace function app.touch() returns trigger language sql as $$select 1$$;',
    'create trigger t before insert on app.users for each row execute function coach.f();',
    'create policy p on app.users using (true);',
    'drop schema app cascade;',
  ])('refuses %s', (sql) => {
    expect(touchesAppSchema(sql)).toBe(true);
  });

  it.each([
    'create table coach.teams (id uuid primary key, head_coach_id uuid not null references app.users (id) on delete cascade);',
    'create index teams_head on coach.teams (head_coach_id);',
    'select count(*) from app.users;',
    '-- alter table app.users add column x int;\ncreate table coach.x (id int);',
    'comment on schema coach is $$owned by coach$$;',
    'create table coach.app_settings (id int);',
  ])('allows %s', (sql) => {
    expect(touchesAppSchema(sql)).toBe(false);
  });
});

describe('readMigrations', () => {
  it('reads this repo’s migrations', async () => {
    const migrations = await readMigrations();
    expect(migrations.map((m) => m.name)[0]).toBe('C0001_coach_schema.sql');
  });

  it('refuses names that are not C0001_name.sql', async () => {
    await expect(readMigrations(await dirWith({ '0001_x.sql': 'select 1;' }))).rejects.toThrow(MigrationError);
  });

  it('refuses two files with the same number', async () => {
    const dir = await dirWith({ 'C0001_a.sql': 'select 1;', 'C0001_b.sql': 'select 1;' });
    await expect(readMigrations(dir)).rejects.toThrow(/numbered C0001/);
  });

  it('refuses a file that changes schema app', async () => {
    const dir = await dirWith({ 'C0002_bad.sql': 'alter table app.targets add column x int;' });
    await expect(readMigrations(dir)).rejects.toThrow(/schema app/);
  });
});

describe('checksum', () => {
  it('ignores Windows line endings', () => {
    expect(checksum('a\r\nb')).toBe(checksum('a\nb'));
  });
});
