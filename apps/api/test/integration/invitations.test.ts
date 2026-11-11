// Inviting a trainee (CF04, TCR-001) against the app schema plus the tables TCR-001 proposes
// (test/fixtures/proposed-app). Synthetic data only; no real email is sent.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { createTestAuth, signToken, type TestKeys } from '../helpers/auth.ts';
import { TEST_SETTINGS, testOnboarding } from '../helpers/onboarding.ts';
import { connect, insertAccount, testDatabaseUrl } from './database.ts';

let client: pg.Client;
let db: pg.Pool;
let keys: TestKeys;
let auth: Awaited<ReturnType<typeof createTestAuth>>['auth'];
const on = testOnboarding();
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  client = await connect();
  db = new pg.Pool({ connectionString: testDatabaseUrl(), max: 4 });
  const testAuth = await createTestAuth();
  keys = testAuth.keys;
  auth = testAuth.auth;
  app = buildApp({ db, auth, onboarding: on.deps });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.end();
  await client.end();
});

async function call(method: 'GET' | 'POST', url: string, subject: string, payload?: object, instance = app) {
  const token = await signToken(keys, subject);
  return instance.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
}
const invite = (subject: string, payload: object) => call('POST', '/v1/clients/invitations', subject, payload);
const newEmail = () => `new-${randomUUID()}@example.test`;

async function link(upper: string, lower: string, kind = 'coach_trainee') {
  await client.query(`insert into app.links (kind, upper_user_id, lower_user_id, status, started_at) values ($1, $2, $3, 'active', now())`, [kind, upper, lower]);
}
async function name(userId: string, fullName: string) {
  await client.query('insert into coach.profiles (user_id, full_name) values ($1, $2)', [userId, fullName]);
}
async function gym(label = 'Iron Gym') {
  const head = await insertAccount(client, ['personal', 'head_coach']);
  const ravi = await insertAccount(client, ['personal', 'coach']);
  const meera = await insertAccount(client, ['personal', 'coach']);
  await name(head.id, 'Asha Rao');
  await name(ravi.id, 'Ravi Kumar');
  await name(meera.id, 'Meera Joshi');
  await link(head.id, ravi.id, 'head_coach_coach');
  await link(head.id, meera.id, 'head_coach_coach');
  await client.query(
    `insert into coach.gyms (head_coach_id, name, address, city, pincode, owner_phone, total_trainees) values ($1, $2, 'a', 'b', '123456', '+919999999999', 10)`,
    [head.id, label],
  );
  return { head, ravi, meera };
}
const pending = async (email: string) =>
  (await client.query('select * from app.coach_invitations where invitee_email = $1 order by created_at', [email])).rows;

describe('inviting a trainee', () => {
  it('a Coach invites under themselves: saved Pending for 7 days, emailed, token only as a hash', async () => {
    const g = await gym();
    const email = newEmail();
    on.sent.length = 0;
    const response = await invite(g.ravi.subject, { email: `  ${email.toUpperCase()} ` });
    expect(response.statusCode).toBe(201);
    expect(response.json().invitation).toMatchObject({ email, coachId: g.ravi.id, coachName: 'Ravi Kumar' });

    const rows = await pending(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'pending',
      gym_head_coach_id: g.head.id,
      assigned_coach_id: g.ravi.id,
      invited_by_id: g.ravi.id,
      gym_name: 'Iron Gym',
      assigned_coach_name: 'Ravi Kumar',
      head_coach_name: 'Asha Rao',
      invitee_user_id: null,
    });
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(rows[0].expires_at).getTime() - new Date(rows[0].created_at).getTime()).toBeGreaterThan(6.9 * 24 * 3600 * 1000);

    expect(on.sent).toHaveLength(1);
    expect(on.sent[0]).toMatchObject({ to: email, subject: 'Iron Gym invited you to FitSphere' });
    const token = /Invitation code: (\S+)/.exec(on.sent[0]?.text ?? '')?.[1] ?? '';
    expect(token.length).toBeGreaterThan(20);
    expect(JSON.stringify(rows[0])).not.toContain(token);
    expect(JSON.stringify(response.json())).not.toContain(token);
  });

  it('the Head Coach invites under themselves or under a Coach of the gym; a Coach cannot pick another', async () => {
    const g = await gym();
    const other = await gym('Other Gym');
    const a = newEmail();
    const b = newEmail();
    expect((await invite(g.head.subject, { email: a })).json().invitation.coachId).toBe(g.head.id);
    expect((await invite(g.head.subject, { email: b, coachId: g.meera.id })).json().invitation).toMatchObject({ coachId: g.meera.id, coachName: 'Meera Joshi' });
    expect((await invite(g.ravi.subject, { email: newEmail(), coachId: g.meera.id })).json().error.code).toBe('NOT_PERMITTED');
    const outside = await invite(g.head.subject, { email: newEmail(), coachId: other.ravi.id });
    expect(outside.statusCode).toBe(400);
    expect(outside.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('answers the same, and sends no email, when the address already has a FitSphere account (invariant 3)', async () => {
    const g = await gym();
    const existing = await insertAccount(client);
    on.sent.length = 0;
    const withAccount = await invite(g.ravi.subject, { email: existing.email });
    const without = await invite(g.ravi.subject, { email: newEmail() });
    expect(withAccount.statusCode).toBe(201);
    expect(Object.keys(withAccount.json().invitation).sort()).toEqual(Object.keys(without.json().invitation).sort());
    expect(on.sent).toHaveLength(1); // only the new address was emailed
    expect((await pending(existing.email))[0]).toMatchObject({ invitee_user_id: existing.id });
  });

  it('refuses a trainee already in the gym: "This trainee is already added." (C-D19)', async () => {
    const g = await gym();
    const underMeera = await insertAccount(client);
    await link(g.meera.id, underMeera.id);
    on.sent.length = 0;
    // Whoever invites: the Head Coach, the trainee's own Coach, or a different Coach of the gym.
    for (const inviter of [g.head, g.meera, g.ravi]) {
      const response = await invite(inviter.subject, { email: underMeera.email });
      expect(response.statusCode).toBe(409);
      expect(response.json().error).toMatchObject({ code: 'ALREADY_ADDED', message: 'This trainee is already added.' });
    }
    expect(on.sent).toHaveLength(0);
    expect(await pending(underMeera.email)).toHaveLength(0);
  });

  it("does not reveal a trainee who is in another gym: the invite goes out", async () => {
    const g = await gym();
    const other = await gym('Other Gym');
    const theirs = await insertAccount(client);
    await link(other.ravi.id, theirs.id);
    expect((await invite(g.ravi.subject, { email: theirs.email })).statusCode).toBe(201);
  });

  it('refuses the Head Coach and the Coaches of the gym as trainees (C-D24)', async () => {
    const g = await gym();
    for (const person of [g.head, g.ravi, g.meera]) {
      const response = await invite(g.ravi.subject, { email: person.email });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('CANNOT_INVITE_EMAIL');
    }
    // A Coach of another gym may be invited (they can be a trainee elsewhere).
    const other = await gym('Other Gym');
    expect((await invite(g.ravi.subject, { email: other.ravi.email })).statusCode).toBe(201);
  });

  it('inviting the same email again replaces the pending invitation (resend)', async () => {
    const g = await gym();
    const email = newEmail();
    await invite(g.ravi.subject, { email });
    await invite(g.head.subject, { email, coachId: g.meera.id });
    const rows = await pending(email);
    expect(rows.map((row) => row.status).sort()).toEqual(['cancelled', 'pending']);
    expect(rows.find((row) => row.status === 'pending')?.assigned_coach_id).toBe(g.meera.id);
  });

  it('limits invitations per person per day (India date)', async () => {
    const g = await gym();
    const limited = buildApp({ db, auth, onboarding: testOnboarding({ settings: { ...TEST_SETTINGS, invitesPerDay: 2 } }).deps });
    await limited.ready();
    expect((await call('POST', '/v1/clients/invitations', g.ravi.subject, { email: newEmail() }, limited)).statusCode).toBe(201);
    expect((await call('POST', '/v1/clients/invitations', g.ravi.subject, { email: newEmail() }, limited)).statusCode).toBe(201);
    const third = await call('POST', '/v1/clients/invitations', g.ravi.subject, { email: newEmail() }, limited);
    expect(third.statusCode).toBe(429);
    expect(third.json().error.code).toBe('INVITE_LIMIT_REACHED');
    // Another person is not affected.
    expect((await call('POST', '/v1/clients/invitations', g.meera.subject, { email: newEmail() }, limited)).statusCode).toBe(201);
    await limited.close();
  });

  it('a failed email changes nothing', async () => {
    const g = await gym();
    const email = newEmail();
    on.failNextSend();
    const response = await invite(g.ravi.subject, { email });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('INVITE_EMAIL_FAILED');
    expect(JSON.stringify(response.json())).not.toContain('smtp');
    expect(await pending(email)).toHaveLength(0);
  });

  it('refuses an invalid email and unknown fields, and an account with no gym', async () => {
    const g = await gym();
    expect((await invite(g.ravi.subject, { email: 'not-an-email' })).statusCode).toBe(400);
    expect((await invite(g.ravi.subject, { email: newEmail(), role: 'coach' })).statusCode).toBe(400);
    const lone = await insertAccount(client, ['personal', 'coach']);
    expect((await invite(lone.subject, { email: newEmail() })).json().error.code).toBe('NOT_PERMITTED');
    const trainee = await insertAccount(client);
    expect((await invite(trainee.subject, { email: newEmail() })).json().error.code).toBe('ROLE_NOT_ENABLED');
  });
});

describe('listing and cancelling invitations', () => {
  it('a Coach sees their own pending invitations; the Head Coach sees the gym; expired and answered ones are not shown', async () => {
    const g = await gym();
    const a = newEmail();
    const b = newEmail();
    const accepted = newEmail();
    const expired = newEmail();
    await invite(g.ravi.subject, { email: a });
    await invite(g.meera.subject, { email: b });
    await invite(g.ravi.subject, { email: accepted });
    await invite(g.ravi.subject, { email: expired });
    await client.query(`update app.coach_invitations set status = 'accepted' where invitee_email = $1`, [accepted]);
    await client.query(`update app.coach_invitations set expires_at = now() - interval '1 minute' where invitee_email = $1`, [expired]);

    const asRavi = (await call('GET', '/v1/clients', g.ravi.subject)).json();
    expect(asRavi.canInvite).toBe(true);
    expect(asRavi.invitations.map((i: { email: string }) => i.email)).toEqual([a]);
    const asHead = (await call('GET', '/v1/clients', g.head.subject)).json();
    expect(asHead.invitations.map((i: { email: string }) => i.email).sort()).toEqual([a, b].sort());
    expect(asHead.invitations.find((i: { email: string }) => i.email === b)).toMatchObject({ coachName: 'Meera Joshi' });
  });

  it('cancels a pending invitation: the inviter or the Head Coach, not another Coach', async () => {
    const g = await gym();
    const email = newEmail();
    const id = (await invite(g.ravi.subject, { email })).json().invitation.id as string;
    expect((await call('POST', `/v1/clients/invitations/${id}/cancel`, g.meera.subject)).statusCode).toBe(404);
    expect((await pending(email))[0]?.status).toBe('pending');
    expect((await call('POST', `/v1/clients/invitations/${id}/cancel`, g.ravi.subject)).statusCode).toBe(204);
    expect((await pending(email))[0]?.status).toBe('cancelled');
    expect((await call('POST', `/v1/clients/invitations/${id}/cancel`, g.ravi.subject)).statusCode).toBe(404);

    const second = (await invite(g.meera.subject, { email: newEmail() })).json().invitation.id as string;
    expect((await call('POST', `/v1/clients/invitations/${second}/cancel`, g.head.subject)).statusCode).toBe(204);
    const other = await gym('Other Gym');
    const third = (await invite(g.ravi.subject, { email: newEmail() })).json().invitation.id as string;
    expect((await call('POST', `/v1/clients/invitations/${third}/cancel`, other.head.subject)).statusCode).toBe(404);
  });
});

describe('while TRAINEE_INVITES_ENABLED is false (the trainee app is not ready, C-D22)', () => {
  it('every invitation route answers not found, the list says inviting is off, and nothing is queried', async () => {
    const g = await gym();
    const off = buildApp({ db, auth, onboarding: testOnboarding({ settings: { ...TEST_SETTINGS, traineeInvitesEnabled: false } }).deps });
    await off.ready();
    const email = newEmail();
    expect((await call('POST', '/v1/clients/invitations', g.ravi.subject, { email }, off)).statusCode).toBe(404);
    expect((await call('POST', `/v1/clients/invitations/${randomUUID()}/cancel`, g.ravi.subject, undefined, off)).statusCode).toBe(404);
    const list = (await call('GET', '/v1/clients', g.ravi.subject, undefined, off)).json();
    expect(list).toMatchObject({ canInvite: false, invitations: [] });
    expect(await pending(email)).toHaveLength(0);
    await off.close();
  });
});

describe("the trainee's name (TCR-001 adds app.users.full_name)", () => {
  it('shows the name when the trainee has one, falls back to the email, and searches both', async () => {
    const g = await gym();
    const named = await insertAccount(client);
    const unnamed = await insertAccount(client);
    await client.query('update app.users set full_name = $2 where id = $1', [named.id, 'Arjun Mehta']);
    await link(g.ravi.id, named.id);
    await link(g.ravi.id, unnamed.id);
    const list = (await call('GET', '/v1/clients', g.ravi.subject)).json().clients as { id: string; name: string }[];
    expect(list.find((c) => c.id === named.id)?.name).toBe('Arjun Mehta');
    expect(list.find((c) => c.id === unnamed.id)?.name).toBe(unnamed.email);
    const byName = (await call('GET', '/v1/clients?q=arjun%20meh', g.ravi.subject)).json().clients as { id: string }[];
    expect(byName.map((c) => c.id)).toEqual([named.id]);
  });
});
