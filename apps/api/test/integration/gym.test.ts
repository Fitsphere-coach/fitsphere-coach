// Gym onboarding (CF02, ADR-0004) against schemas app and coach on the test database: sending a
// request, the approval code, the limits, expiry, and approving in one transaction.
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { createTestAuth, signToken, type TestKeys } from '../helpers/auth.ts';
import { testOnboarding } from '../helpers/onboarding.ts';
import { connect, insertAccount, testDatabaseUrl } from './database.ts';

const START = new Date('2026-11-12T05:00:00Z'); // 10:30 in India
let now = START;

let client: pg.Client;
let db: pg.Pool;
let keys: TestKeys;
let app: ReturnType<typeof buildApp>;
const onboarding = testOnboarding({ now: () => now });

beforeAll(async () => {
  client = await connect();
  db = new pg.Pool({ connectionString: testDatabaseUrl(), max: 4 });
  const testAuth = await createTestAuth();
  keys = testAuth.keys;
  app = buildApp({ db, auth: testAuth.auth, onboarding: onboarding.deps });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.end();
  await client.end();
});
beforeEach(() => {
  now = START;
  onboarding.sent.length = 0;
});

const form = {
  gymName: 'Iron Gym',
  address: '12 MG Road, Vijay Nagar',
  city: 'Indore',
  pincode: '452010',
  ownerPhone: '98765 43210',
  totalTrainees: 120,
  websiteOrInstagram: 'instagram.com/irongym',
};

async function call(method: 'GET' | 'POST', url: string, subject: string, payload?: object, instance = app) {
  const token = await signToken(keys, subject);
  return instance.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
}
const status = (subject: string) => call('GET', '/v1/gym/onboarding', subject);
const send = (subject: string, payload: object = form) => call('POST', '/v1/gym/onboarding/requests', subject, payload);
const enter = (subject: string, code: string) => call('POST', '/v1/gym/onboarding/code', subject, { code });

function wrongCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

describe('GET /v1/gym/onboarding', () => {
  it('says "none" for an account with no request, and how many requests are left today', async () => {
    const account = await insertAccount(client);
    const response = await status(account.subject);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'none', expiresAt: null, triesLeft: null, requestsLeftToday: 3, codeLength: 6, gymName: null });
  });

  it('refuses a request without a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/gym/onboarding' });
    expect(response.statusCode).toBe(401);
  });
});

describe('sending a gym request', () => {
  it('saves it as Pending for 7 days, emails the approval inbox, and keeps no plain code', async () => {
    const account = await insertAccount(client);
    const response = await send(account.subject);
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: 'pending',
      expiresAt: new Date(START.getTime() + 7 * 24 * 3600 * 1000).toISOString(),
      triesLeft: 5,
      requestsLeftToday: 2,
    });

    expect(onboarding.sent).toHaveLength(1);
    expect(onboarding.sent[0]).toMatchObject({ to: 'approvals@example.test', subject: 'Gym approval request: Iron Gym' });
    const code = onboarding.lastCode();
    expect(code).toMatch(/^[0-9]{6}$/);

    const { rows } = await client.query('select * from coach.gym_onboarding_requests where applicant_id = $1', [account.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'pending',
      gym_name: 'Iron Gym',
      city: 'Indore',
      pincode: '452010',
      owner_phone: '+919876543210',
      total_trainees: 120,
      wrong_tries: 0,
      extra_fields: { website_or_instagram: 'instagram.com/irongym' },
    });
    // Only a keyed hash is stored (invariant 11).
    expect(rows[0].code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows[0])).not.toContain(code);
    expect(JSON.stringify(response.json())).not.toContain(code);
  });

  it('refuses an invalid form and saves and sends nothing', async () => {
    const account = await insertAccount(client);
    const response = await send(account.subject, { ...form, pincode: '12', totalTrainees: 0, extra: 1 });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
    const fields = (response.json().error.details as { field: string }[]).map((detail) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(['pincode', 'totalTrainees', 'extra']));
    expect(onboarding.sent).toHaveLength(0);
    const { rows } = await client.query('select count(*)::int as n from coach.gym_onboarding_requests where applicant_id = $1', [account.id]);
    expect(rows[0].n).toBe(0);
  });

  it('refuses a Head Coach and a Coach, whatever the app shows (C-D25)', async () => {
    const head = await insertAccount(client, ['personal', 'head_coach']);
    const coach = await insertAccount(client, ['personal', 'coach']);
    const asHead = await send(head.subject);
    const asCoach = await send(coach.subject);
    expect(asHead.statusCode).toBe(409);
    expect(asHead.json().error).toMatchObject({ code: 'ALREADY_HEAD_COACH', message: 'This email is already registered as a Head Coach.' });
    expect(asCoach.statusCode).toBe(409);
    expect(asCoach.json().error).toMatchObject({ code: 'ALREADY_COACH', message: 'This email is already registered as a Coach.' });
    expect(onboarding.sent).toHaveLength(0);
  });

  it('allows 3 requests a day and refuses the 4th; the next India day starts again', async () => {
    const account = await insertAccount(client);
    for (let i = 0; i < 3; i++) expect((await send(account.subject)).statusCode).toBe(201);
    const fourth = await send(account.subject);
    expect(fourth.statusCode).toBe(429);
    expect(fourth.json().error.code).toBe('REQUEST_LIMIT_REACHED');
    expect(onboarding.sent).toHaveLength(3);
    expect((await status(account.subject)).json().requestsLeftToday).toBe(0);

    now = new Date(START.getTime() + 24 * 3600 * 1000);
    expect((await send(account.subject)).statusCode).toBe(201);
  });

  it('a new request replaces the old one: the old code stops working', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    const oldCode = onboarding.lastCode();
    await send(account.subject);
    const newCode = onboarding.lastCode();
    expect(newCode).not.toBe(oldCode);

    const { rows } = await client.query('select status from coach.gym_onboarding_requests where applicant_id = $1 order by created_at', [account.id]);
    expect(rows.map((row) => row.status).sort()).toEqual(['pending', 'replaced']);

    const attempt = await enter(account.subject, oldCode);
    expect(attempt.json()).toMatchObject({ result: 'wrong', triesLeft: 4 });
  });

  it('a failed email send changes nothing: the earlier request stays valid and the attempt does not count', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    const firstCode = onboarding.lastCode();

    onboarding.failNextSend();
    const failed = await send(account.subject, { ...form, gymName: 'Second Gym' });
    expect(failed.statusCode).toBe(503);
    expect(failed.json().error.code).toBe('APPROVAL_EMAIL_FAILED');
    expect(JSON.stringify(failed.json())).not.toContain('smtp');

    const { rows } = await client.query(
      'select status, gym_name from coach.gym_onboarding_requests where applicant_id = $1 order by created_at, status',
      [account.id],
    );
    expect(rows.map((row) => `${row.gym_name}:${row.status}`).sort()).toEqual(['Iron Gym:pending', 'Second Gym:not_sent']);
    expect((await status(account.subject)).json()).toMatchObject({ status: 'pending', requestsLeftToday: 2 });

    const approved = await enter(account.subject, firstCode);
    expect(approved.json()).toMatchObject({ result: 'approved', gymName: 'Iron Gym' });
  });
});

describe('entering the approval code', () => {
  it('a wrong code is counted; the 5th wrong code locks the request, even for the right code', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    const code = onboarding.lastCode();
    const wrong = wrongCode(code);

    for (const left of [4, 3, 2, 1]) {
      const response = await enter(account.subject, wrong);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ result: 'wrong', triesLeft: left, gymName: null });
    }
    expect((await status(account.subject)).json()).toMatchObject({ status: 'pending', triesLeft: 1 });

    expect((await enter(account.subject, wrong)).json()).toMatchObject({ result: 'locked' });
    expect((await enter(account.subject, code)).json()).toMatchObject({ result: 'locked' });
    expect((await status(account.subject)).json()).toMatchObject({ status: 'locked' });

    const roles = await client.query('select role from app.user_roles where user_id = $1', [account.id]);
    expect(roles.rows).toEqual([{ role: 'personal' }]);
  });

  it('a locked person can send a new request and use its code', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    const wrong = wrongCode(onboarding.lastCode());
    for (let i = 0; i < 5; i++) await enter(account.subject, wrong);

    expect((await send(account.subject)).statusCode).toBe(201);
    expect((await enter(account.subject, onboarding.lastCode())).json().result).toBe('approved');
  });

  it('after 7 days the request has expired and even the right code fails', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    const code = onboarding.lastCode();

    now = new Date(START.getTime() + 7 * 24 * 3600 * 1000 + 1000);
    expect((await status(account.subject)).json()).toMatchObject({ status: 'expired', expiresAt: null });
    expect((await enter(account.subject, code)).json()).toMatchObject({ result: 'expired' });
    const roles = await client.query('select role from app.user_roles where user_id = $1', [account.id]);
    expect(roles.rows).toEqual([{ role: 'personal' }]);
  });

  it('answers "none" when there is no request', async () => {
    const account = await insertAccount(client);
    expect((await enter(account.subject, '123456')).json()).toMatchObject({ result: 'none' });
  });

  it('refuses a code of the wrong length or shape without counting a try', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    for (const code of ['12345', '1234567', 'abcdef']) {
      const response = await enter(account.subject, code);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect((await status(account.subject)).json()).toMatchObject({ triesLeft: 5 });
  });

  it("someone else's code does not work for you", async () => {
    const owner = await insertAccount(client);
    const other = await insertAccount(client);
    await send(owner.subject);
    const code = onboarding.lastCode();
    await send(other.subject);
    // `other` has their own request; the owner's code is just a wrong code for them.
    expect((await enter(other.subject, code)).json()).toMatchObject({ result: 'wrong' });
    const roles = await client.query('select role from app.user_roles where user_id = $1', [other.id]);
    expect(roles.rows).toEqual([{ role: 'personal' }]);
  });

  it('the right code makes the person Head Coach of the gym, for good', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    const response = await enter(account.subject, onboarding.lastCode());
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ result: 'approved', triesLeft: null, gymName: 'Iron Gym' });

    const { rows } = await client.query(
      `select g.name, g.city, g.owner_phone, g.total_trainees, g.extra_fields, r.status, r.approved_at is not null as approved,
              (select array_agg(role order by role) from app.user_roles where user_id = $1) as roles
       from coach.gyms g join coach.gym_onboarding_requests r on r.id = g.request_id
       where g.head_coach_id = $1`,
      [account.id],
    );
    expect(rows).toEqual([
      {
        name: 'Iron Gym',
        city: 'Indore',
        owner_phone: '+919876543210',
        total_trainees: 120,
        extra_fields: { website_or_instagram: 'instagram.com/irongym' },
        status: 'approved',
        approved: true,
        roles: ['head_coach', 'personal'],
      },
    ]);

    // Approved for good: later reads answer approved, even after the 7 days have passed.
    now = new Date(START.getTime() + 30 * 24 * 3600 * 1000);
    expect((await status(account.subject)).json()).toMatchObject({ status: 'approved', gymName: 'Iron Gym' });
    expect((await call('GET', '/v1/me', account.subject)).json().roles).toEqual(['head_coach', 'personal']);
    // And a Head Coach can no longer send a request or enter a code.
    expect((await send(account.subject)).json().error.code).toBe('ALREADY_HEAD_COACH');
    expect((await enter(account.subject, '123456')).json().error.code).toBe('ALREADY_HEAD_COACH');
  });

  it('approval is one transaction: if the gym cannot be created, no role is added and the request stays Pending', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    const code = onboarding.lastCode();
    // A stray gym for this person (without the role) makes the gym insert fail.
    await client.query(
      `insert into coach.gyms (head_coach_id, name, address, city, pincode, owner_phone, total_trainees)
       values ($1, 'Stray', 'a', 'b', '123456', '+919999999999', 1)`,
      [account.id],
    );
    const response = await enter(account.subject, code);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ALREADY_HEAD_COACH');

    const roles = await client.query('select role from app.user_roles where user_id = $1', [account.id]);
    expect(roles.rows).toEqual([{ role: 'personal' }]);
    const request = await client.query('select status from coach.gym_onboarding_requests where applicant_id = $1', [account.id]);
    expect(request.rows).toEqual([{ status: 'pending' }]);
  });
});

describe('what is never written to the logs (invariant 11, 6)', () => {
  it('holds no code, phone, address or email in any log line', async () => {
    const lines: string[] = [];
    const testAuth = await createTestAuth();
    const logged = buildApp({
      db,
      auth: testAuth.auth,
      onboarding: onboarding.deps,
      log: { level: 'trace', stream: { write: (line) => void lines.push(line) } },
    });
    await logged.ready();
    const account = await insertAccount(client);
    const token = await signToken(testAuth.keys, account.subject);
    const headers = { authorization: `Bearer ${token}` };

    await logged.inject({ method: 'POST', url: '/v1/gym/onboarding/requests', headers, payload: form });
    const code = onboarding.lastCode();
    await logged.inject({ method: 'POST', url: '/v1/gym/onboarding/code', headers, payload: { code: wrongCode(code) } });
    await logged.inject({ method: 'POST', url: '/v1/gym/onboarding/code', headers, payload: { code } });
    await logged.close();

    const text = lines.join('\n');
    expect(text.length).toBeGreaterThan(0);
    for (const secret of [code, '9876543210', 'Vijay Nagar', 'Iron Gym', account.email, 'instagram.com']) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('deleting an account (contract rule 5)', () => {
  it('removes its requests and its gym', async () => {
    const account = await insertAccount(client);
    await send(account.subject);
    await enter(account.subject, onboarding.lastCode());
    await client.query('delete from app.users where id = $1', [account.id]);
    const { rows } = await client.query(
      `select (select count(*)::int from coach.gym_onboarding_requests where applicant_id = $1) as requests,
              (select count(*)::int from coach.gyms where head_coach_id = $1) as gyms`,
      [account.id],
    );
    expect(rows[0]).toEqual({ requests: 0, gyms: 0 });
  });
});
