// Client management (CF04) against schemas app and coach on the test database: who sees whom,
// the profile, moving and removing a client. Synthetic data only.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { createTestAuth, signToken, type TestKeys } from '../helpers/auth.ts';
import { testOnboarding } from '../helpers/onboarding.ts';
import { connect, insertAccount, testDatabaseUrl } from './database.ts';

let client: pg.Client;
let db: pg.Pool;
let keys: TestKeys;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  client = await connect();
  db = new pg.Pool({ connectionString: testDatabaseUrl(), max: 4 });
  const testAuth = await createTestAuth();
  keys = testAuth.keys;
  app = buildApp({ db, auth: testAuth.auth, onboarding: testOnboarding().deps });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.end();
  await client.end();
});

async function call(method: 'GET' | 'POST', url: string, subject: string, payload?: object) {
  const token = await signToken(keys, subject);
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
}

async function name(userId: string, fullName: string) {
  await client.query('insert into coach.profiles (user_id, full_name) values ($1, $2)', [userId, fullName]);
}
async function link(kind: 'coach_trainee' | 'head_coach_coach', upper: string, lower: string, status: 'active' | 'ended' = 'active') {
  await client.query(
    `insert into app.links (kind, upper_user_id, lower_user_id, status, started_at, ended_at, end_reason)
     values ($1, $2, $3, $4, now(), $5, $6)`,
    [kind, upper, lower, status, status === 'ended' ? new Date() : null, status === 'ended' ? 'removed' : null],
  );
}
const activeCoach = async (traineeId: string) =>
  (await client.query(`select upper_user_id from app.links where kind = 'coach_trainee' and status = 'active' and lower_user_id = $1`, [traineeId])).rows.map(
    (row) => row.upper_user_id as string,
  );

/** A gym: a Head Coach, two Coaches, and trainees under each (and one under the Head Coach). */
async function gym() {
  const head = await insertAccount(client, ['personal', 'head_coach']);
  const ravi = await insertAccount(client, ['personal', 'coach']);
  const meera = await insertAccount(client, ['personal', 'coach']);
  await name(head.id, 'Asha Rao');
  await name(ravi.id, 'Ravi Kumar');
  await name(meera.id, 'Meera Joshi');
  await link('head_coach_coach', head.id, ravi.id);
  await link('head_coach_coach', head.id, meera.id);
  const own = await insertAccount(client);
  const underRavi = await insertAccount(client);
  const underMeera = await insertAccount(client);
  await link('coach_trainee', head.id, own.id);
  await link('coach_trainee', ravi.id, underRavi.id);
  await link('coach_trainee', meera.id, underMeera.id);
  return { head, ravi, meera, own, underRavi, underMeera };
}

describe('who sees whom', () => {
  it('a Coach sees only their own clients; the Head Coach sees every client of the gym, with each Coach', async () => {
    const g = await gym();
    const asRavi = await call('GET', '/v1/clients', g.ravi.subject);
    expect(asRavi.statusCode).toBe(200);
    expect(asRavi.json().clients.map((c: { id: string }) => c.id)).toEqual([g.underRavi.id]);
    expect(asRavi.json().coaches).toEqual([]);

    const asHead = await call('GET', '/v1/clients', g.head.subject);
    const byId = Object.fromEntries(asHead.json().clients.map((c: { id: string; coachName: string; coachId: string }) => [c.id, c]));
    expect(Object.keys(byId).sort()).toEqual([g.own.id, g.underRavi.id, g.underMeera.id].sort());
    expect(byId[g.underRavi.id]).toMatchObject({ coachName: 'Ravi Kumar', coachId: g.ravi.id, name: g.underRavi.email });
    expect(byId[g.own.id]).toMatchObject({ coachName: 'Asha Rao', coachId: g.head.id });
    expect(asHead.json().coaches).toEqual([
      { id: g.meera.id, name: 'Meera Joshi' },
      { id: g.ravi.id, name: 'Ravi Kumar' },
    ]);
  });

  it("another gym's Head Coach and Coach see none of it", async () => {
    const g = await gym();
    const other = await gym();
    for (const viewer of [other.head, other.ravi]) {
      const ids = (await call('GET', '/v1/clients', viewer.subject)).json().clients.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(g.underRavi.id);
      expect((await call('GET', `/v1/clients/${g.underRavi.id}`, viewer.subject)).statusCode).toBe(404);
    }
  });

  it("a Coach cannot open another Coach's or the Head Coach's client: the answer is not found", async () => {
    const g = await gym();
    for (const id of [g.underMeera.id, g.own.id]) {
      const response = await call('GET', `/v1/clients/${id}`, g.ravi.subject);
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    }
    expect((await call('GET', `/v1/clients/${g.underRavi.id}`, g.ravi.subject)).statusCode).toBe(200);
    expect((await call('GET', `/v1/clients/${g.underMeera.id}`, g.head.subject)).statusCode).toBe(200);
  });

  it('a former client (ended link) is not listed or opened', async () => {
    const g = await gym();
    const gone = await insertAccount(client);
    await link('coach_trainee', g.ravi.id, gone.id, 'ended');
    expect((await call('GET', '/v1/clients', g.ravi.subject)).json().clients.map((c: { id: string }) => c.id)).not.toContain(gone.id);
    expect((await call('GET', `/v1/clients/${gone.id}`, g.head.subject)).statusCode).toBe(404);
  });

  it('refuses an account with no coach role, a missing token, and a malformed id', async () => {
    const trainee = await insertAccount(client);
    expect((await call('GET', '/v1/clients', trainee.subject)).json().error.code).toBe('ROLE_NOT_ENABLED');
    expect((await app.inject({ method: 'GET', url: '/v1/clients' })).statusCode).toBe(401);
    const g = await gym();
    expect((await call('GET', '/v1/clients/not-an-id', g.head.subject)).statusCode).toBe(404);
  });

  it('searches by email and filters by coach', async () => {
    const g = await gym();
    const bySearch = await call('GET', `/v1/clients?q=${encodeURIComponent(g.underMeera.email.slice(0, 12))}`, g.head.subject);
    expect(bySearch.json().clients.map((c: { id: string }) => c.id)).toEqual([g.underMeera.id]);
    const byCoach = await call('GET', `/v1/clients?coachId=${g.ravi.id}`, g.head.subject);
    expect(byCoach.json().clients.map((c: { id: string }) => c.id)).toEqual([g.underRavi.id]);
    expect((await call('GET', '/v1/clients?coachId=nope', g.head.subject)).statusCode).toBe(400);
  });
});

describe('the profile', () => {
  it('shows the latest weight, targets, workouts this week and the last log', async () => {
    const g = await gym();
    const id = g.underRavi.id;
    await client.query(`insert into app.weigh_ins (user_id, day, weight_grams, recorded_at) values ($1, current_date - 3, 83000, now() - interval '3 days'), ($1, current_date - 1, 82400, now() - interval '1 day')`, [id]);
    await client.query(
      `insert into app.targets (user_id, kind, value, set_at) values ($1, 'calories', 2100, now()), ($1, 'protein', 140, now()), ($1, 'weekly_workouts', 4, now())`,
      [id],
    );
    await client.query(`insert into app.workouts (user_id, id, day, exercises, recorded_at) values ($1, $2, (now() at time zone 'Asia/Kolkata')::date, '[]', now())`, [id, randomUUID()]);

    const response = await call('GET', `/v1/clients/${id}`, g.ravi.subject);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id,
      name: g.underRavi.email,
      coachName: 'Ravi Kumar',
      latestWeightKg: 82.4,
      targets: { calories: 2100, proteinG: 140, weeklyWorkouts: 4 },
      workoutsThisWeek: 1,
    });
    expect(response.json().lastLoggedAt).toBeTruthy();
  });

  it('is empty, not an error, for a client who has logged nothing', async () => {
    const g = await gym();
    const response = await call('GET', `/v1/clients/${g.underRavi.id}`, g.head.subject);
    expect(response.json()).toMatchObject({ latestWeightKg: null, targets: { calories: null, proteinG: null, weeklyWorkouts: null }, workoutsThisWeek: 0, lastLoggedAt: null });
  });
});

describe('moving a client (Head Coach only, C-D21, C-D26)', () => {
  it('ends the old link as "switched" and starts the new one, keeping one active coach', async () => {
    const g = await gym();
    const response = await call('POST', `/v1/clients/${g.underRavi.id}/move`, g.head.subject, { coachId: g.meera.id });
    expect(response.statusCode).toBe(204);
    expect(await activeCoach(g.underRavi.id)).toEqual([g.meera.id]);
    const { rows } = await client.query(`select status, end_reason from app.links where kind = 'coach_trainee' and lower_user_id = $1 order by created_at`, [g.underRavi.id]);
    expect(rows).toEqual([
      { status: 'ended', end_reason: 'switched' },
      { status: 'active', end_reason: null },
    ]);
    // The new Coach sees the client; the old Coach no longer does.
    expect((await call('GET', `/v1/clients/${g.underRavi.id}`, g.meera.subject)).statusCode).toBe(200);
    expect((await call('GET', `/v1/clients/${g.underRavi.id}`, g.ravi.subject)).statusCode).toBe(404);
  });

  it('can move a client under the Head Coach themselves', async () => {
    const g = await gym();
    expect((await call('POST', `/v1/clients/${g.underMeera.id}/move`, g.head.subject, { coachId: g.head.id })).statusCode).toBe(204);
    expect(await activeCoach(g.underMeera.id)).toEqual([g.head.id]);
  });

  it('refuses a Coach, a coach outside the gym, the same coach, and an unknown client', async () => {
    const g = await gym();
    const other = await gym();
    const asCoach = await call('POST', `/v1/clients/${g.underRavi.id}/move`, g.ravi.subject, { coachId: g.meera.id });
    expect(asCoach.statusCode).toBe(403);
    expect(asCoach.json().error.code).toBe('NOT_PERMITTED');
    expect((await call('POST', `/v1/clients/${g.underRavi.id}/move`, g.head.subject, { coachId: other.ravi.id })).json().error.code).toBe('VALIDATION_FAILED');
    expect((await call('POST', `/v1/clients/${g.underRavi.id}/move`, g.head.subject, { coachId: g.ravi.id })).json().error.code).toBe('VALIDATION_FAILED');
    expect((await call('POST', `/v1/clients/${g.underRavi.id}/move`, other.head.subject, { coachId: other.ravi.id })).statusCode).toBe(404);
    expect((await call('POST', `/v1/clients/${g.underRavi.id}/move`, g.head.subject, { coachId: 'x', extra: 1 })).statusCode).toBe(400);
    expect(await activeCoach(g.underRavi.id)).toEqual([g.ravi.id]);
  });
});

describe('removing a client (C-D18, C-D28)', () => {
  it('the Head Coach removes any client of the gym; the link ends as "removed" and no data is deleted', async () => {
    const g = await gym();
    await client.query(`insert into app.weigh_ins (user_id, day, weight_grams, recorded_at) values ($1, current_date, 82000, now())`, [g.underMeera.id]);
    expect((await call('POST', `/v1/clients/${g.underMeera.id}/remove`, g.head.subject)).statusCode).toBe(204);
    const { rows } = await client.query(`select status, end_reason from app.links where kind = 'coach_trainee' and lower_user_id = $1`, [g.underMeera.id]);
    expect(rows).toEqual([{ status: 'ended', end_reason: 'removed' }]);
    expect((await client.query('select count(*)::int as n from app.weigh_ins where user_id = $1', [g.underMeera.id])).rows[0].n).toBe(1);
    expect((await client.query('select count(*)::int as n from app.users where id = $1', [g.underMeera.id])).rows[0].n).toBe(1);
    expect((await call('GET', `/v1/clients/${g.underMeera.id}`, g.meera.subject)).statusCode).toBe(404);
  });

  it("a Coach removes their own client but cannot remove another Coach's or the Head Coach's", async () => {
    const g = await gym();
    for (const id of [g.underMeera.id, g.own.id]) {
      expect((await call('POST', `/v1/clients/${id}/remove`, g.ravi.subject)).statusCode).toBe(404);
      expect(await activeCoach(id)).toHaveLength(1);
    }
    expect((await call('POST', `/v1/clients/${g.underRavi.id}/remove`, g.ravi.subject)).statusCode).toBe(204);
    expect(await activeCoach(g.underRavi.id)).toEqual([]);
  });

  it('a removed client can be added again later (a new link)', async () => {
    const g = await gym();
    await call('POST', `/v1/clients/${g.underRavi.id}/remove`, g.head.subject);
    await link('coach_trainee', g.meera.id, g.underRavi.id);
    expect(await activeCoach(g.underRavi.id)).toEqual([g.meera.id]);
  });
});
