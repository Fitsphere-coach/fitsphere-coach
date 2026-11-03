// GET /v1/me against the shared schema app on the test database.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../src/app.ts';
import { createTestAuth, signToken, type TestKeys } from '../helpers/auth.ts';
import { connect, insertAccount, testDatabaseUrl } from './database.ts';

let client: pg.Client;
let db: pg.Pool;
let keys: TestKeys;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  client = await connect();
  db = new pg.Pool({ connectionString: testDatabaseUrl(), max: 2 });
  const testAuth = await createTestAuth();
  keys = testAuth.keys;
  app = buildApp({ db, auth: testAuth.auth });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.end();
  await client.end();
});

async function getMe(subject: string) {
  const token = await signToken(keys, subject);
  return app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });
}

describe('GET /v1/me', () => {
  it('reads an account the trainee app created, with its roles', async () => {
    const account = await insertAccount(client, ['personal', 'head_coach']);
    const response = await getMe(account.subject);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: { id: account.id, email: account.email },
      roles: ['head_coach', 'personal'],
    });
  });

  it('answers ACCOUNT_SETUP_REQUIRED for a signed-in user with no account', async () => {
    const response = await getMe(randomUUID());
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('never shows another account', async () => {
    const mine = await insertAccount(client);
    await insertAccount(client, ['coach']);
    const response = await getMe(mine.subject);
    expect(response.json().user.id).toBe(mine.id);
    expect(response.json().roles).toEqual(['personal']);
  });
});
