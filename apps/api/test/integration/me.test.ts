// GET and POST /v1/me against schemas app and coach on the test database (CAUTH-001/005/006).
import { randomUUID } from 'node:crypto';
import { AGE_CONFIRMATION_TEXT_VERSION, COACH_TERMS_VERSION } from '@fitsphere-coach/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { createTestAuth, signToken, type fakeSupabaseUsers, type TestKeys } from '../helpers/auth.ts';
import { connect, insertAccount, testDatabaseUrl } from './database.ts';

let client: pg.Client;
let db: pg.Pool;
let keys: TestKeys;
let supabase: ReturnType<typeof fakeSupabaseUsers>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  client = await connect();
  db = new pg.Pool({ connectionString: testDatabaseUrl(), max: 2 });
  const testAuth = await createTestAuth();
  keys = testAuth.keys;
  supabase = testAuth.supabase;
  app = buildApp({ db, auth: testAuth.auth });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.end();
  await client.end();
});

const setupBody = {
  ageConfirmed: true,
  ageConfirmationTextVersion: AGE_CONFIRMATION_TEXT_VERSION,
  fullName: '  Asha   Rao ',
  coachTermsVersion: COACH_TERMS_VERSION,
};

async function call(method: 'GET' | 'POST', subject: string, payload?: object) {
  const token = await signToken(keys, subject);
  return app.inject({ method, url: '/v1/me', headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
}

/** A Supabase sign-in user with no FitSphere account yet. */
function supabaseUser(confirmed = true) {
  const subject = randomUUID();
  const email = `Coach-${subject}@Example.test`;
  supabase.users.set(subject, { email, confirmed });
  return { subject, email: email.toLowerCase() };
}

describe('GET /v1/me', () => {
  it('reads an account the trainee app created, with its roles and no coach details', async () => {
    const account = await insertAccount(client, ['personal', 'head_coach']);
    const response = await call('GET', account.subject);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: { id: account.id, email: account.email },
      roles: ['head_coach', 'personal'],
      coach: null,
    });
  });

  it('answers ACCOUNT_SETUP_REQUIRED for a signed-in user with no account', async () => {
    const response = await call('GET', randomUUID());
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('never shows another account', async () => {
    const mine = await insertAccount(client);
    await insertAccount(client, ['coach']);
    const response = await call('GET', mine.subject);
    expect(response.json().user.id).toBe(mine.id);
    expect(response.json().roles).toEqual(['personal']);
  });
});

describe('POST /v1/me (CAUTH-006)', () => {
  it('creates the account exactly as the trainee app does, plus the coach name and terms', async () => {
    const user = supabaseUser();
    const response = await call('POST', user.subject, setupBody);
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ user: { email: user.email }, roles: ['personal'], coach: { fullName: 'Asha Rao' } });

    const { rows } = await client.query(
      `select u.email, u.age_confirmation_text_version, u.age_confirmed_at is not null as confirmed,
              (select array_agg(role) from app.user_roles where user_id = u.id) as roles,
              (select terms_version from coach.terms_acceptances where user_id = u.id) as terms
       from app.users u where u.auth_subject = $1`,
      [user.subject],
    );
    expect(rows[0]).toEqual({
      email: user.email,
      age_confirmation_text_version: AGE_CONFIRMATION_TEXT_VERSION,
      confirmed: true,
      roles: ['personal'],
      terms: COACH_TERMS_VERSION,
    });
  });

  it('keeps an existing trainee account as it is and only adds the coach details', async () => {
    const existing = await insertAccount(client, ['personal']);
    supabase.users.set(existing.subject, { email: existing.email, confirmed: true });
    const before = await client.query('select * from app.users where id = $1', [existing.id]);

    const response = await call('POST', existing.subject, setupBody);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { id: existing.id }, roles: ['personal'], coach: { fullName: 'Asha Rao' } });

    const after = await client.query('select * from app.users where id = $1', [existing.id]);
    expect(after.rows).toEqual(before.rows);
    const roles = await client.query('select role from app.user_roles where user_id = $1', [existing.id]);
    expect(roles.rows).toEqual([{ role: 'personal' }]);
  });

  it('is safe to repeat: a second setup updates the name and creates nothing new', async () => {
    const user = supabaseUser();
    await call('POST', user.subject, setupBody);
    const again = await call('POST', user.subject, { ...setupBody, fullName: 'Asha R' });
    expect(again.statusCode).toBe(200);
    expect(again.json().coach).toEqual({ fullName: 'Asha R' });
    const { rows } = await client.query(
      `select count(*)::int as users,
              (select count(*)::int from coach.terms_acceptances t join app.users u2 on u2.id = t.user_id where u2.auth_subject = $1) as terms
       from app.users where auth_subject = $1`,
      [user.subject],
    );
    expect(rows[0]).toEqual({ users: 1, terms: 1 });
  });

  it('creates nothing for an unconfirmed email', async () => {
    const user = supabaseUser(false);
    const response = await call('POST', user.subject, setupBody);
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('EMAIL_NOT_VERIFIED');
    const { rows } = await client.query('select count(*)::int as n from app.users where auth_subject = $1', [user.subject]);
    expect(rows[0].n).toBe(0);
  });

  it('creates nothing without the 18+ confirmation', async () => {
    const user = supabaseUser();
    const response = await call('POST', user.subject, { ...setupBody, ageConfirmed: false });
    expect(response.json().error.code).toBe('AGE_CONFIRMATION_REQUIRED');
    const { rows } = await client.query('select count(*)::int as n from app.users where auth_subject = $1', [user.subject]);
    expect(rows[0].n).toBe(0);
  });

  it('deleting the account in the trainee app also removes the coach details (contract rule 5)', async () => {
    const user = supabaseUser();
    const created = await call('POST', user.subject, setupBody);
    const id = created.json().user.id as string;
    await client.query('delete from app.users where id = $1', [id]);
    const { rows } = await client.query(
      `select (select count(*)::int from coach.profiles where user_id = $1) as profiles,
              (select count(*)::int from coach.terms_acceptances where user_id = $1) as terms`,
      [id],
    );
    expect(rows[0]).toEqual({ profiles: 0, terms: 0 });
  });
});
