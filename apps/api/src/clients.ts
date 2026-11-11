// Client management (CF04, SPEC-001 → coach-scope §3.4): who a coach may see, and moving and
// removing a client. A "client" is a trainee with an active `coach_trainee` link in schema `app`.
//
// Who sees whom (invariants 1, 14; C-D12, C-D18):
// - a Coach sees only the trainees linked to them;
// - the Head Coach sees the trainees linked to them and to every Coach of their gym, and which Coach
//   each belongs to. A gym's Coaches are the users the Head Coach has an active `head_coach_coach`
//   link to (interim until CF03 adds gym membership, ADR-0006);
// - nobody sees anyone else's trainee: the answer is "not found", never "not yours".
// Only the person higher up removes or moves: the Head Coach moves; the Head Coach or the trainee's own
// Coach removes. Moving needs no new consent (C-D26). Removal ends the link and deletes nothing (C-D28).
// Former clients (ended links) are not shown here: their read-only history switches on only after the
// consent text covers it (TCR-001, C-D28).
import type { ClientListResponse, ClientProfile, ClientSummary } from '@fitsphere-coach/shared';
import type pg from 'pg';
import type { Account } from './accounts.ts';
import { ApiError } from './errors.ts';

type Queryable = Pick<pg.Pool, 'query'>;

const isHeadCoach = (account: Account) => account.roles.includes('head_coach');

/** The coaches the viewer may see clients of: themselves, plus the gym's Coaches for the Head Coach. */
const VISIBLE_UPPERS = `
  select $1::uuid as id
  union
  select l.lower_user_id from app.links l
  where $2::boolean and l.kind = 'head_coach_coach' and l.status = 'active' and l.upper_user_id = $1`;

const LAST_LOGGED = `
  greatest(
    (select max(m.recorded_at) from app.meals m where m.user_id = l.lower_user_id and m.deleted_at is null),
    (select max(w.recorded_at) from app.workouts w where w.user_id = l.lower_user_id and w.deleted_at is null),
    (select max(b.recorded_at) from app.weigh_ins b where b.user_id = l.lower_user_id)
  )`;

type Row = {
  trainee_id: string;
  email: string;
  coach_id: string;
  coach_name: string | null;
  started_at: Date;
  last_logged_at: Date | null;
};

const toSummary = (row: Row): ClientSummary => ({
  id: row.trainee_id,
  // The trainee's name arrives with TCR-001 (app.users.full_name); until then, their email.
  name: row.email,
  coachId: row.coach_id,
  coachName: row.coach_name,
  startedAt: row.started_at.toISOString(),
  lastLoggedAt: row.last_logged_at ? row.last_logged_at.toISOString() : null,
});

const SELECT_CLIENTS = `
  select l.lower_user_id as trainee_id, u.email, l.upper_user_id as coach_id, p.full_name as coach_name,
         l.started_at, ${LAST_LOGGED} as last_logged_at
  from app.links l
  join app.users u on u.id = l.lower_user_id
  left join coach.profiles p on p.user_id = l.upper_user_id
  where l.kind = 'coach_trainee' and l.status = 'active'
    and l.upper_user_id in (${VISIBLE_UPPERS})`;

export async function listClients(
  db: Queryable,
  viewer: Account,
  filter: { q?: string | undefined; coachId?: string | undefined },
): Promise<ClientListResponse> {
  const head = isHeadCoach(viewer);
  const { rows } = await db.query<Row>(
    `${SELECT_CLIENTS}
       and ($3::text is null or u.email ilike '%' || $3 || '%')
       and ($4::uuid is null or l.upper_user_id = $4)
     order by lower(u.email)`,
    [viewer.id, head, filter.q?.trim() || null, filter.coachId ?? null],
  );
  return { clients: rows.map(toSummary), coaches: head ? await gymCoaches(db, viewer) : [] };
}

/** The Head Coach's gym Coaches with their names. Empty for anyone else. */
async function gymCoaches(db: Queryable, viewer: Account): Promise<ClientListResponse['coaches']> {
  const { rows } = await db.query<{ id: string; full_name: string | null }>(
    `select l.lower_user_id as id, p.full_name
     from app.links l left join coach.profiles p on p.user_id = l.lower_user_id
     where l.kind = 'head_coach_coach' and l.status = 'active' and l.upper_user_id = $1
     order by lower(coalesce(p.full_name, ''))`,
    [viewer.id],
  );
  return rows.map((row) => ({ id: row.id, name: row.full_name }));
}

/** One visible client's summary, or null when the viewer may not see them (answered as not found). */
async function findClient(db: Queryable, viewer: Account, traineeId: string): Promise<Row | null> {
  const { rows } = await db.query<Row>(`${SELECT_CLIENTS} and l.lower_user_id = $3`, [viewer.id, isHeadCoach(viewer), traineeId]);
  return rows[0] ?? null;
}

const NOT_FOUND = () => new ApiError('NOT_FOUND');

export async function clientProfile(db: Queryable, viewer: Account, traineeId: string): Promise<ClientProfile> {
  const client = await findClient(db, viewer, traineeId);
  if (!client) throw NOT_FOUND();

  const { rows: weights } = await db.query<{ weight_grams: number }>(
    'select weight_grams from app.weigh_ins where user_id = $1 order by day desc limit 1',
    [traineeId],
  );
  const { rows: targetRows } = await db.query<{ kind: string; value: number }>(
    `select kind, value from app.targets where user_id = $1 and kind in ('calories', 'protein', 'weekly_workouts')`,
    [traineeId],
  );
  const target = (kind: string) => targetRows.find((row) => row.kind === kind)?.value ?? null;
  // The India week, Monday to Sunday (invariant 4): `day` is the day the trainee chose.
  const { rows: workouts } = await db.query<{ n: number }>(
    `select count(*)::int as n from app.workouts
     where user_id = $1 and deleted_at is null
       and day >= date_trunc('week', (now() at time zone 'Asia/Kolkata')::date)::date`,
    [traineeId],
  );
  return {
    ...toSummary(client),
    latestWeightKg: weights[0] ? weights[0].weight_grams / 1000 : null,
    targets: { calories: target('calories'), proteinG: target('protein'), weeklyWorkouts: target('weekly_workouts') },
    workoutsThisWeek: workouts[0]?.n ?? 0,
  };
}

/** Removes a client: ends the link, deletes nothing. The Head Coach or the client's own Coach may. */
export async function removeClient(db: pg.Pool, viewer: Account, traineeId: string): Promise<void> {
  const client = await findClient(db, viewer, traineeId);
  if (!client) throw NOT_FOUND();
  // A Coach removes only their own; `findClient` already limits a Coach to their own trainees.
  const { rowCount } = await db.query(
    `update app.links set status = 'ended', ended_at = now(), end_reason = 'removed'
     where kind = 'coach_trainee' and status = 'active' and lower_user_id = $1 and upper_user_id = $2`,
    [traineeId, client.coach_id],
  );
  if (!rowCount) throw NOT_FOUND();
}

/**
 * The Head Coach moves a client to another Coach of the gym, or to themselves (C-D21). In one
 * transaction the old link ends (reason "switched") and a new one starts; no new consent (C-D26).
 */
export async function moveClient(db: pg.Pool, viewer: Account, traineeId: string, coachId: string): Promise<void> {
  if (!isHeadCoach(viewer)) throw new ApiError('NOT_PERMITTED');
  const client = await findClient(db, viewer, traineeId);
  if (!client) throw NOT_FOUND();
  const target = await db.query(
    `select 1 where $2::uuid = $1::uuid
       or exists (select 1 from app.links where kind = 'head_coach_coach' and status = 'active' and upper_user_id = $1 and lower_user_id = $2)`,
    [viewer.id, coachId],
  );
  if (target.rowCount === 0 || coachId === client.coach_id) {
    throw new ApiError('VALIDATION_FAILED', [{ field: 'coachId', issue: 'invalid_format' }]);
  }

  const tx = await db.connect();
  try {
    await tx.query('begin');
    const ended = await tx.query(
      `update app.links set status = 'ended', ended_at = now(), end_reason = 'switched'
       where kind = 'coach_trainee' and status = 'active' and lower_user_id = $1 and upper_user_id = $2`,
      [traineeId, client.coach_id],
    );
    if (!ended.rowCount) throw NOT_FOUND();
    await tx.query(
      `insert into app.links (kind, upper_user_id, lower_user_id, status, started_at)
       values ('coach_trainee', $1, $2, 'active', now())`,
      [coachId, traineeId],
    );
    await tx.query('commit');
  } catch (error) {
    await tx.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    tx.release();
  }
}
