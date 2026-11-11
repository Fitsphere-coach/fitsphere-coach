// Workout management (CF06) against schemas app and coach on the test database: templates, who sees
// and edits what, plans as drafts, publishing into app.training_plans (TCR-003 as proposed), versions
// and the change log. Synthetic data only.
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

async function call(method: 'GET' | 'POST' | 'PUT', url: string, subject: string, payload?: object) {
  const token = await signToken(keys, subject);
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
}

async function link(kind: 'coach_trainee' | 'head_coach_coach', upper: string, lower: string) {
  await client.query(
    `insert into app.links (kind, upper_user_id, lower_user_id, status, started_at) values ($1, $2, $3, 'active', now())`,
    [kind, upper, lower],
  );
}

/** A gym: a Head Coach, two Coaches, a trainee under each Coach. */
async function gym() {
  const head = await insertAccount(client, ['personal', 'head_coach']);
  const ravi = await insertAccount(client, ['personal', 'coach']);
  const meera = await insertAccount(client, ['personal', 'coach']);
  for (const [account, name] of [[head, 'Asha Rao'], [ravi, 'Ravi Kumar'], [meera, 'Meera Joshi']] as const) {
    await client.query('insert into coach.profiles (user_id, full_name) values ($1, $2)', [account.id, name]);
  }
  await link('head_coach_coach', head.id, ravi.id);
  await link('head_coach_coach', head.id, meera.id);
  const underRavi = await insertAccount(client);
  const underMeera = await insertAccount(client);
  await link('coach_trainee', ravi.id, underRavi.id);
  await link('coach_trainee', meera.id, underMeera.id);
  return { head, ravi, meera, underRavi, underMeera };
}

const exercise = (id = 'bench-press', over: object = {}) => ({
  exerciseId: id,
  group: null,
  sets: 3,
  repsMin: 8,
  repsMax: 10,
  weightG: 40_000,
  rpe: null,
  restS: 120,
  note: '',
  ...over,
});
const content = (over: object = {}) => ({
  weeks: 8,
  scheduleMode: 'weekdays',
  weeklyTarget: 4,
  dailyTarget: false,
  days: [
    { name: 'Push', weekday: 1, rest: false, exercises: [exercise(), exercise('overhead-press')] },
    { name: 'Rest', weekday: 2, rest: true, exercises: [] },
  ],
  ...over,
});
const template = (over: object = {}) => ({ name: 'Push / Pull / Legs', goal: 'muscle_gain', difficulty: 'intermediate', visibility: 'gym', content: content(), ...over });
const future = () => new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

async function makeTemplate(subject: string, over: object = {}) {
  const res = await call('POST', '/v1/workout-templates', subject, template(over));
  expect(res.statusCode).toBe(201);
  return res.json().template as { id: string };
}
async function assign(subject: string, templateId: string, traineeIds: string[]) {
  return call('POST', '/v1/training-plans', subject, { templateId, traineeIds, startDate: future() });
}
const planRow = async (id: string) => (await client.query('select * from coach.training_plans where id = $1', [id])).rows[0];
const startOf = async (id: string) => (await client.query("select to_char(start_date, 'YYYY-MM-DD') as d from coach.training_plans where id = $1", [id])).rows[0].d as string;
const changeActions = async (id: string) =>
  (await client.query('select action from coach.plan_changes where plan_id = $1 order by created_at, id', [id])).rows.map((r) => r.action as string);

describe('exercises', () => {
  it('lists the ten fixed exercises for a coach and refuses a trainee account', async () => {
    const g = await gym();
    const res = await call('GET', '/v1/exercises', g.ravi.subject);
    expect(res.statusCode).toBe(200);
    expect(res.json().exercises).toHaveLength(10);
    const trainee = await call('GET', '/v1/exercises', g.underRavi.subject);
    expect(trainee.statusCode).toBe(403);
    expect(trainee.json().error.code).toBe('ROLE_NOT_ENABLED');
  });
});

describe('templates: who sees and edits what', () => {
  it('a Coach creates a gym-wide template; the gym sees it, another gym does not', async () => {
    const g = await gym();
    const other = await gym();
    const made = await makeTemplate(g.ravi.subject);
    const asMeera = await call('GET', '/v1/workout-templates', g.meera.subject);
    expect(asMeera.json().templates.map((t: { id: string }) => t.id)).toContain(made.id);
    const asOther = await call('GET', '/v1/workout-templates', other.head.subject);
    expect(asOther.json().templates).toEqual([]);
    expect((await call('GET', `/v1/workout-templates/${made.id}`, other.ravi.subject)).statusCode).toBe(404);
  });

  it('a personal template is visible to its author only, even to the Head Coach', async () => {
    const g = await gym();
    const mine = await makeTemplate(g.ravi.subject, { visibility: 'personal', name: 'Mine' });
    expect((await call('GET', `/v1/workout-templates/${mine.id}`, g.ravi.subject)).statusCode).toBe(200);
    expect((await call('GET', `/v1/workout-templates/${mine.id}`, g.head.subject)).statusCode).toBe(404);
    expect((await call('GET', `/v1/workout-templates/${mine.id}`, g.meera.subject)).statusCode).toBe(404);
  });

  it("another Coach cannot edit a gym template (not permitted); its author and the Head Coach can", async () => {
    const g = await gym();
    const made = await makeTemplate(g.ravi.subject);
    const edit = (subject: string, name: string) => call('PUT', `/v1/workout-templates/${made.id}`, subject, template({ name }));
    const byMeera = await edit(g.meera.subject, 'Meera edit');
    expect(byMeera.statusCode).toBe(403);
    expect(byMeera.json().error.code).toBe('NOT_PERMITTED');
    expect((await edit(g.ravi.subject, 'Ravi edit')).statusCode).toBe(200);
    expect((await edit(g.head.subject, 'Head edit')).json().template.name).toBe('Head edit');
    // The Head Coach cannot change who can use someone else's template.
    const hide = await call('PUT', `/v1/workout-templates/${made.id}`, g.head.subject, template({ visibility: 'personal' }));
    expect(hide.statusCode).toBe(403);
  });

  it('copy makes a personal copy; deactivate hides it from the list and keeps plans made from it', async () => {
    const g = await gym();
    const made = await makeTemplate(g.head.subject);
    const copy = await call('POST', `/v1/workout-templates/${made.id}/copy`, g.meera.subject);
    expect(copy.statusCode).toBe(201);
    expect(copy.json().template).toMatchObject({ name: 'Push / Pull / Legs (copy)', visibility: 'personal', canEdit: true });

    const plans = await assign(g.ravi.subject, made.id, [g.underRavi.id]);
    expect(plans.statusCode).toBe(201);
    expect((await call('POST', `/v1/workout-templates/${made.id}/deactivate`, g.head.subject)).statusCode).toBe(204);
    const list = await call('GET', '/v1/workout-templates', g.meera.subject);
    expect(list.json().templates.map((t: { id: string }) => t.id)).not.toContain(made.id);
    const withInactive = await call('GET', '/v1/workout-templates?includeInactive=true', g.meera.subject);
    expect(withInactive.json().templates.map((t: { id: string }) => t.id)).toContain(made.id);
    expect((await planRow(plans.json().plans[0].id)).name).toBe('Push / Pull / Legs');
    expect((await assign(g.meera.subject, made.id, [g.underMeera.id])).statusCode).toBe(404);
  });

  it('refuses invalid content: a rest day with exercises, unknown exercise, repeated weekday, unknown field', async () => {
    const g = await gym();
    const bad = async (over: object) => (await call('POST', '/v1/workout-templates', g.ravi.subject, template(over))).statusCode;
    expect(await bad({ content: content({ days: [{ name: 'Rest', weekday: 1, rest: true, exercises: [exercise()] }] }) })).toBe(400);
    expect(await bad({ content: content({ days: [{ name: 'A', weekday: 1, rest: false, exercises: [exercise('nope')] }] }) })).toBe(400);
    expect(await bad({ content: content({ days: [{ name: 'A', weekday: 1, rest: false, exercises: [] }, { name: 'B', weekday: 1, rest: true, exercises: [] }] }) })).toBe(400);
    expect(await bad({ content: content({ days: [{ name: 'A', weekday: 1, rest: false, exercises: [exercise('bench-press', { repsMin: 10, repsMax: 8 })] }] }) })).toBe(400);
    expect(await bad({ extra: true })).toBe(400);
    expect(await bad({ content: content({ scheduleMode: 'rotating' }) })).toBe(400);
  });

  it('supports a rotating schedule with a daily target', async () => {
    const g = await gym();
    const res = await call('POST', '/v1/workout-templates', g.ravi.subject, template({
      content: content({ scheduleMode: 'rotating', dailyTarget: true, weeklyTarget: null, weeks: null, days: [{ name: 'Day 1', weekday: null, rest: false, exercises: [exercise()] }] }),
    }));
    expect(res.statusCode).toBe(201);
  });
});

describe('plans: drafts, visibility and the change log', () => {
  it('assigns a draft copy to chosen clients and logs it; a Coach cannot assign to a client who is not theirs', async () => {
    const g = await gym();
    const made = await makeTemplate(g.head.subject);
    expect((await assign(g.ravi.subject, made.id, [g.underMeera.id])).statusCode).toBe(404);
    const res = await assign(g.head.subject, made.id, [g.underRavi.id, g.underMeera.id]);
    expect(res.statusCode).toBe(201);
    const plans = res.json().plans as { id: string; status: string; version: number; coachName: string }[];
    expect(plans.map((p) => p.status)).toEqual(['draft', 'draft']);
    expect(plans.map((p) => p.coachName).sort()).toEqual(['Meera Joshi', 'Ravi Kumar']);
    expect(await changeActions(plans[0]!.id)).toEqual(['created']);
    // A second draft for the same client is refused, and nothing was created for the others.
    const again = await assign(g.head.subject, made.id, [g.underRavi.id]);
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('PLAN_DRAFT_EXISTS');
  });

  it('is all or none: a bad client in the list creates no draft at all', async () => {
    const g = await gym();
    const made = await makeTemplate(g.head.subject);
    const stranger = await insertAccount(client);
    const res = await assign(g.head.subject, made.id, [g.underRavi.id, stranger.id]);
    expect(res.statusCode).toBe(404);
    expect((await client.query('select 1 from coach.training_plans where trainee_id = $1', [g.underRavi.id])).rowCount).toBe(0);
  });

  it('refuses a start date in the past', async () => {
    const g = await gym();
    const made = await makeTemplate(g.head.subject);
    const res = await call('POST', '/v1/training-plans', g.head.subject, { templateId: made.id, traineeIds: [g.underRavi.id], startDate: '2020-01-01' });
    expect(res.statusCode).toBe(400);
  });

  it("a Coach sees only their clients' plans; the Head Coach sees the gym's; another gym sees none", async () => {
    const g = await gym();
    const other = await gym();
    const made = await makeTemplate(g.head.subject);
    const res = await assign(g.head.subject, made.id, [g.underRavi.id, g.underMeera.id]);
    const [forRavi, forMeera] = res.json().plans as { id: string; traineeId: string }[];
    const own = forRavi!.traineeId === g.underRavi.id ? forRavi! : forMeera!;
    const theirs = own === forRavi ? forMeera! : forRavi!;

    const asRavi = await call('GET', '/v1/training-plans', g.ravi.subject);
    expect(asRavi.json().plans.map((p: { id: string }) => p.id)).toEqual([own.id]);
    const asHead = await call('GET', '/v1/training-plans', g.head.subject);
    expect(asHead.json().plans).toHaveLength(2);
    expect(asHead.json().coaches).toHaveLength(2);

    expect((await call('GET', `/v1/training-plans/${theirs.id}`, g.ravi.subject)).statusCode).toBe(404);
    expect((await call('PUT', `/v1/training-plans/${theirs.id}`, g.ravi.subject, { name: 'x', startDate: future(), content: content() })).statusCode).toBe(404);
    expect((await call('POST', `/v1/training-plans/${theirs.id}/publish`, g.ravi.subject)).statusCode).toBe(404);
    expect((await call('GET', `/v1/training-plans/${own.id}`, other.head.subject)).statusCode).toBe(404);
    expect((await call('GET', `/v1/training-plans/${own.id}/history`, other.ravi.subject)).statusCode).toBe(404);
  });

  it('a plan whose link ended is no longer visible', async () => {
    const g = await gym();
    const made = await makeTemplate(g.head.subject);
    const id = (await assign(g.ravi.subject, made.id, [g.underRavi.id])).json().plans[0].id as string;
    await client.query(`update app.links set status = 'ended', ended_at = now(), end_reason = 'removed' where lower_user_id = $1`, [g.underRavi.id]);
    expect((await call('GET', `/v1/training-plans/${id}`, g.ravi.subject)).statusCode).toBe(404);
  });

  it('editing bumps the version and logs who and when; an unchanged save logs nothing', async () => {
    const g = await gym();
    const made = await makeTemplate(g.head.subject);
    const id = (await assign(g.ravi.subject, made.id, [g.underRavi.id])).json().plans[0].id as string;
    const body = { name: 'Arjun block 1', startDate: future(), content: content({ weeks: 6 }) };
    const edited = await call('PUT', `/v1/training-plans/${id}`, g.head.subject, body);
    expect(edited.statusCode).toBe(200);
    expect(edited.json().plan).toMatchObject({ name: 'Arjun block 1', version: 2, weeks: 6, status: 'draft' });
    expect(edited.json().plan.lastChange).toMatchObject({ action: 'edited', actorName: 'Asha Rao', actorRole: 'head_coach' });
    const same = await call('PUT', `/v1/training-plans/${id}`, g.head.subject, body);
    expect(same.json().plan.version).toBe(2);
    expect(await changeActions(id)).toEqual(['created', 'edited']);
    // Editing the template afterwards never changes the plan.
    await call('PUT', `/v1/workout-templates/${made.id}`, g.head.subject, template({ name: 'Changed' }));
    expect((await planRow(id)).name).toBe('Arjun block 1');
  });

  it('discarding a never-published draft deletes it', async () => {
    const g = await gym();
    const made = await makeTemplate(g.head.subject);
    const id = (await assign(g.ravi.subject, made.id, [g.underRavi.id])).json().plans[0].id as string;
    expect((await call('POST', `/v1/training-plans/${id}/discard`, g.ravi.subject)).statusCode).toBe(204);
    expect(await planRow(id)).toBeUndefined();
  });
});

describe('plans: publish, versions and ending', () => {
  async function draft(g: Awaited<ReturnType<typeof gym>>, traineeId = g.underRavi.id) {
    const made = await makeTemplate(g.head.subject);
    return (await assign(g.ravi.subject, made.id, [traineeId])).json().plans[0].id as string;
  }
  const publish = (subject: string, id: string) => call('POST', `/v1/training-plans/${id}/publish`, subject);
  const appRow = async (id: string) => (await client.query('select * from app.training_plans where id = $1', [id])).rows[0];

  it('publishes into the trainee app table, records version 1 and the log, and is idempotent', async () => {
    const g = await gym();
    const id = await draft(g);
    expect((await call('GET', `/v1/training-plans/${id}`, g.ravi.subject)).json().plan.canPublish).toBe(true);
    expect((await publish(g.ravi.subject, id)).statusCode).toBe(204);
    expect(await planRow(id)).toMatchObject({ status: 'active', live_version: 1, version: 1 });
    expect(await appRow(id)).toMatchObject({
      user_id: g.underRavi.id, status: 'active', version: 1, schedule_mode: 'weekdays', weekly_target: 4, set_by_user_id: g.ravi.id, set_by_role: 'coach',
    });
    expect((await appRow(id)).days).toHaveLength(2);
    expect((await publish(g.ravi.subject, id)).statusCode).toBe(204);
    expect(await changeActions(id)).toEqual(['created', 'published']);
  });

  it('refuses to publish a plan with no training day or an empty training day', async () => {
    const g = await gym();
    const id = await draft(g);
    const empty = content({ days: [{ name: 'Push', weekday: 1, rest: false, exercises: [] }] });
    await call('PUT', `/v1/training-plans/${id}`, g.ravi.subject, { name: 'P', startDate: future(), content: empty });
    const res = await publish(g.ravi.subject, id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PLAN_NOT_READY');
    expect(await appRow(id)).toBeUndefined();
  });

  it('a new plan replaces the live one in one step; the old one ends', async () => {
    const g = await gym();
    const first = await draft(g);
    await publish(g.ravi.subject, first);
    const second = await draft(g);
    expect((await publish(g.head.subject, second)).statusCode).toBe(204);
    expect(await planRow(first)).toMatchObject({ status: 'ended' });
    expect((await appRow(first)).status).toBe('ended');
    expect(await planRow(second)).toMatchObject({ status: 'active' });
    expect((await appRow(second)).set_by_role).toBe('head_coach');
    expect(await changeActions(first)).toEqual(['created', 'published', 'ended']);
  });

  it('edits to a live plan are unpublished until the next publish; the trainee row keeps the live version', async () => {
    const g = await gym();
    const id = await draft(g);
    await publish(g.ravi.subject, id);
    const edit = await call('PUT', `/v1/training-plans/${id}`, g.ravi.subject, { name: 'Block 1 v2', startDate: await startOf(id), content: content({ weeks: 12 }) });
    expect(edit.statusCode).toBe(200);
    expect(edit.json().plan).toMatchObject({ status: 'active', version: 2, liveVersion: 1 });
    expect(await appRow(id)).toMatchObject({ version: 1, name: 'Push / Pull / Legs', weeks: 8 });
    await publish(g.ravi.subject, id);
    expect(await appRow(id)).toMatchObject({ version: 2, name: 'Block 1 v2', weeks: 12 });
    const history = (await call('GET', `/v1/training-plans/${id}/history`, g.head.subject)).json();
    expect(history.publishedVersions).toEqual([2, 1]);
    expect(history.changes.map((c: { action: string }) => c.action)).toEqual(['published', 'edited', 'published', 'created']);
  });

  it('discard throws away unpublished changes of a live plan; restore opens an old version as a new draft', async () => {
    const g = await gym();
    const id = await draft(g);
    await publish(g.ravi.subject, id);
    const start = await startOf(id);
    await call('PUT', `/v1/training-plans/${id}`, g.ravi.subject, { name: 'Temp', startDate: start, content: content({ weeks: 3 }) });
    expect((await call('POST', `/v1/training-plans/${id}/discard`, g.ravi.subject)).statusCode).toBe(204);
    expect(await planRow(id)).toMatchObject({ name: 'Push / Pull / Legs', version: 1, live_version: 1 });
    expect((await planRow(id)).content.weeks).toBe(8);

    await call('PUT', `/v1/training-plans/${id}`, g.ravi.subject, { name: 'Block 2', startDate: start, content: content({ weeks: 10 }) });
    await publish(g.ravi.subject, id);
    const restored = await call('POST', `/v1/training-plans/${id}/restore`, g.ravi.subject, { version: 1 });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().plan.content.weeks).toBe(8);
    expect(restored.json().plan).toMatchObject({ version: 3, liveVersion: 2 });
    expect(await appRow(id)).toMatchObject({ version: 2, weeks: 10 });
    expect((await call('POST', `/v1/training-plans/${id}/restore`, g.ravi.subject, { version: 9 })).statusCode).toBe(404);
  });

  it('ending a live plan ends it for the trainee; an ended plan cannot be edited or published', async () => {
    const g = await gym();
    const id = await draft(g);
    await publish(g.ravi.subject, id);
    expect((await call('POST', `/v1/training-plans/${id}/end`, g.ravi.subject)).statusCode).toBe(204);
    expect((await appRow(id)).status).toBe('ended');
    expect((await publish(g.ravi.subject, id)).statusCode).toBe(403);
    const edit = await call('PUT', `/v1/training-plans/${id}`, g.ravi.subject, { name: 'x', startDate: future(), content: content() });
    expect(edit.statusCode).toBe(403);
    expect((await call('POST', `/v1/training-plans/${id}/end`, g.ravi.subject)).statusCode).toBe(403);
  });

  it('Publish is off (not found) while the trainee app table does not exist', async () => {
    const g = await gym();
    const id = await draft(g);
    await client.query('alter table app.training_plans rename to training_plans_hidden');
    try {
      expect((await call('GET', `/v1/training-plans/${id}`, g.ravi.subject)).json().plan.canPublish).toBe(false);
      expect((await publish(g.ravi.subject, id)).statusCode).toBe(404);
    } finally {
      await client.query('alter table app.training_plans_hidden rename to training_plans');
    }
    expect(await planRow(id)).toMatchObject({ status: 'draft' });
  });

  it('a plan change and its log row succeed together: a failed publish leaves nothing behind', async () => {
    const g = await gym();
    const id = await draft(g);
    // The trainee app rejects the row, so the whole publish must roll back.
    await client.query('alter table app.training_plans add constraint reject_all check (false) not valid');
    try {
      expect((await publish(g.ravi.subject, id)).statusCode).toBe(500);
    } finally {
      await client.query('alter table app.training_plans drop constraint reject_all');
    }
    expect(await planRow(id)).toMatchObject({ status: 'draft', live_version: null });
    expect(await changeActions(id)).toEqual(['created']);
    expect((await client.query('select 1 from coach.plan_versions where plan_id = $1', [id])).rowCount).toBe(0);
  });
});
