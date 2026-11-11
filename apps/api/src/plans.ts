// Training plans (CF06, SPEC-002): a coach's plan for one client.
//
// - A plan is made as a draft copy of a template, edited, then published. The client sees nothing
//   until publish (CTRN-004), and only once TCR-003 exists in the trainee app (C-D22): Publish answers
//   "not found" while `app.training_plans` is missing (ADR-0002 rule 2).
// - Only coaches who may see the client (an active link; Head Coach: the whole gym, C-D12) may open
//   or change their plan. Anyone else gets "not found". A plan whose link ended is not shown here;
//   read-only history waits for the consent text (TCR-001, C-D28).
// - Every create, edit, publish, end, restore and revert writes a change-log row (who, role, when) in
//   the same transaction as the change (C-D13, invariant 13).
import {
  planIsReady,
  type AssignPlanRequest,
  type PlanChange,
  type PlanContent,
  type PlanDetail,
  type PlanHistoryResponse,
  type PlanListResponse,
  type PlanStatus,
  type PlanSummary,
  type UpdatePlanRequest,
} from '@fitsphere-coach/shared';
import type pg from 'pg';
import type { Account } from './accounts.ts';
import { isHeadCoach, VISIBLE_UPPERS } from './clients.ts';
import { ApiError } from './errors.ts';
import { findTemplate, gymOf, NOT_FOUND, roleOf } from './workouts.ts';

type Queryable = Pick<pg.Pool, 'query'>;

type Row = {
  id: string;
  trainee_id: string;
  trainee_name: string;
  coach_id: string;
  coach_name: string | null;
  name: string;
  status: PlanStatus;
  start_date: string;
  content: PlanContent;
  version: number;
  live_version: number | null;
  updated_at: Date;
};

// The plan, with the client's current coach, only when the viewer may see that client. $1 = viewer,
// $2 = whether the viewer is the Head Coach (the VISIBLE_UPPERS parameters).
const SELECT_PLANS = `
  select p.id, p.trainee_id,
         coalesce(nullif(to_jsonb(u) ->> 'full_name', ''), u.email) as trainee_name,
         l.upper_user_id as coach_id, cp.full_name as coach_name,
         p.name, p.status, to_char(p.start_date, 'YYYY-MM-DD') as start_date,
         p.content, p.version, p.live_version, p.updated_at
  from coach.training_plans p
  join app.links l on l.lower_user_id = p.trainee_id and l.kind = 'coach_trainee' and l.status = 'active'
       and l.upper_user_id in (${VISIBLE_UPPERS})
  join app.users u on u.id = p.trainee_id
  left join coach.profiles cp on cp.user_id = l.upper_user_id`;

const toSummary = (row: Row): PlanSummary => ({
  id: row.id,
  traineeId: row.trainee_id,
  traineeName: row.trainee_name,
  coachId: row.coach_id,
  coachName: row.coach_name,
  name: row.name,
  status: row.status,
  startDate: row.start_date,
  weeks: row.content.weeks,
  liveVersion: row.live_version,
  version: row.version,
  updatedAt: row.updated_at.toISOString(),
});

async function findPlan(db: Queryable, viewer: Account, id: string): Promise<Row | null> {
  const { rows } = await db.query<Row>(`${SELECT_PLANS} where p.id = $3`, [viewer.id, isHeadCoach(viewer), id]);
  return rows[0] ?? null;
}

async function requirePlan(db: Queryable, viewer: Account, id: string): Promise<Row> {
  const plan = await findPlan(db, viewer, id);
  if (!plan) throw NOT_FOUND();
  return plan;
}

const today = async (db: Queryable): Promise<string> =>
  ((await db.query<{ d: string }>(`select ((now() at time zone 'Asia/Kolkata')::date)::text as d`)).rows[0] as { d: string }).d;

async function log(
  tx: Queryable,
  planId: string,
  viewer: Account,
  action: PlanChange['action'],
  version: number,
  summary: string | null = null,
) {
  await tx.query(
    `insert into coach.plan_changes (plan_id, action, version, actor_id, actor_role, summary) values ($1, $2, $3, $4, $5, $6)`,
    [planId, action, version, viewer.id, roleOf(viewer), summary],
  );
}

/** Key order does not matter to jsonb, so compare content with sorted keys. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

/** Runs `work` in a transaction, so a plan change and its log row succeed or fail together (DB-1). */
export async function transaction<T>(db: pg.Pool, work: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
  const tx = await db.connect();
  try {
    await tx.query('begin');
    const result = await work(tx);
    await tx.query('commit');
    return result;
  } catch (error) {
    await tx.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    tx.release();
  }
}

export async function listPlans(
  db: Queryable,
  viewer: Account,
  filter: { q?: string | undefined; status?: string | undefined; coachId?: string | undefined },
): Promise<PlanListResponse> {
  const head = isHeadCoach(viewer);
  const { rows } = await db.query<Row>(
    `${SELECT_PLANS}
     where ($3::text is null or p.status = $3)
       and ($4::uuid is null or l.upper_user_id = $4)
       and ($5::text is null or p.name ilike '%' || $5 || '%' or u.email ilike '%' || $5 || '%'
            or to_jsonb(u) ->> 'full_name' ilike '%' || $5 || '%')
     order by case p.status when 'draft' then 0 when 'active' then 1 else 2 end, p.updated_at desc`,
    [viewer.id, head, filter.status ?? null, filter.coachId ?? null, filter.q?.trim() || null],
  );
  const coaches = head
    ? (
        await db.query<{ id: string; full_name: string | null }>(
          `select l.lower_user_id as id, p.full_name from app.links l left join coach.profiles p on p.user_id = l.lower_user_id
           where l.kind = 'head_coach_coach' and l.status = 'active' and l.upper_user_id = $1
           order by lower(coalesce(p.full_name, ''))`,
          [viewer.id],
        )
      ).rows.map((row) => ({ id: row.id, name: row.full_name }))
    : [];
  return { plans: rows.map(toSummary), coaches };
}

async function appPlansExist(db: Queryable): Promise<boolean> {
  return (await db.query(`select to_regclass('app.training_plans') as t`)).rows[0]?.t !== null;
}

async function lastChange(db: Queryable, planId: string): Promise<PlanChange | null> {
  return (await changes(db, planId, 1))[0] ?? null;
}

async function changes(db: Queryable, planId: string, limit: number): Promise<PlanChange[]> {
  const { rows } = await db.query<{
    id: string;
    action: PlanChange['action'];
    version: number;
    actor_id: string;
    actor_name: string | null;
    actor_role: PlanChange['actorRole'];
    summary: string | null;
    created_at: Date;
  }>(
    `select c.id, c.action, c.version, c.actor_id, p.full_name as actor_name, c.actor_role, c.summary, c.created_at
     from coach.plan_changes c left join coach.profiles p on p.user_id = c.actor_id
     where c.plan_id = $1 order by c.created_at desc, c.id desc limit $2`,
    [planId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    version: row.version,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    summary: row.summary,
    at: row.created_at.toISOString(),
  }));
}

export async function getPlan(db: Queryable, viewer: Account, id: string): Promise<PlanDetail> {
  const row = await requirePlan(db, viewer, id);
  return {
    ...toSummary(row),
    content: row.content,
    lastChange: await lastChange(db, id),
    canPublish: row.status !== 'ended' && (await appPlansExist(db)),
  };
}

export async function planHistory(db: Queryable, viewer: Account, id: string): Promise<PlanHistoryResponse> {
  await requirePlan(db, viewer, id);
  const { rows } = await db.query<{ version: number }>('select version from coach.plan_versions where plan_id = $1 order by version desc', [id]);
  return { changes: await changes(db, id, 200), publishedVersions: rows.map((row) => row.version) };
}

/** Draft copies of a template for each chosen client. All or none: one bad client stops the request. */
export async function assignPlans(db: pg.Pool, viewer: Account, request: AssignPlanRequest): Promise<PlanSummary[]> {
  const gym = await gymOf(db, viewer);
  const template = await findTemplate(db, viewer, request.templateId);
  if (!template || !template.active) throw NOT_FOUND();
  if (request.startDate < (await today(db))) {
    throw new ApiError('VALIDATION_FAILED', [{ field: 'startDate', issue: 'out_of_range' }]);
  }
  const traineeIds = [...new Set(request.traineeIds)];

  const ids = await transaction(db, async (tx) => {
    const created: string[] = [];
    for (const traineeId of traineeIds) {
      // The client must be one the viewer may see (a Coach: their own; the Head Coach: the gym's).
      const { rowCount } = await tx.query(
        `select 1 from app.links l where l.kind = 'coach_trainee' and l.status = 'active' and l.lower_user_id = $3
           and l.upper_user_id in (${VISIBLE_UPPERS})`,
        [viewer.id, isHeadCoach(viewer), traineeId],
      );
      if (!rowCount) throw NOT_FOUND();
      const existing = await tx.query(`select 1 from coach.training_plans where trainee_id = $1 and status = 'draft'`, [traineeId]);
      if (existing.rowCount) throw new ApiError('PLAN_DRAFT_EXISTS');
      const { rows } = await tx.query<{ id: string }>(
        `insert into coach.training_plans (trainee_id, gym_head_coach_id, created_by, template_id, name, status, start_date, content)
         values ($1, $2, $3, $4, $5, 'draft', $6, $7) returning id`,
        [traineeId, gym, viewer.id, template.id, template.name, request.startDate, JSON.stringify(template.content)],
      );
      const id = (rows[0] as { id: string }).id;
      await log(tx, id, viewer, 'created', 1, `From template ${template.name}`.slice(0, 200));
      created.push(id);
    }
    return created;
  });

  const plans: PlanSummary[] = [];
  for (const id of ids) plans.push(toSummary(await requirePlan(db, viewer, id)));
  return plans;
}

/** Edits the working copy. A live plan keeps what the client sees until the next publish (CTRN-004). */
export async function updatePlan(db: pg.Pool, viewer: Account, id: string, request: UpdatePlanRequest): Promise<PlanDetail> {
  await transaction(db, async (tx) => {
    const plan = await requirePlanForUpdate(tx, viewer, id);
    if (plan.status === 'ended') throw new ApiError('NOT_PERMITTED');
    if (request.startDate !== plan.start_date) {
      // The start date moves only on a draft, and never into the past.
      if (plan.status !== 'draft' || request.startDate < (await today(tx))) {
        throw new ApiError('VALIDATION_FAILED', [{ field: 'startDate', issue: 'out_of_range' }]);
      }
    }
    const changed =
      request.name.trim() !== plan.name ||
      request.startDate !== plan.start_date ||
      canonical(request.content) !== canonical(plan.content);
    if (!changed) return;
    const version = plan.version + 1;
    await tx.query(
      `update coach.training_plans set name = $2, start_date = $3, content = $4, version = $5, updated_at = now() where id = $1`,
      [id, request.name.trim(), request.startDate, JSON.stringify(request.content), version],
    );
    await log(tx, id, viewer, 'edited', version);
  });
  return getPlan(db, viewer, id);
}

/** The plan row, locked for this transaction, when the viewer may see the client. */
async function requirePlanForUpdate(tx: pg.PoolClient, viewer: Account, id: string): Promise<Row> {
  await requirePlan(tx, viewer, id);
  const { rows } = await tx.query<Row>(`${SELECT_PLANS} where p.id = $3 for update of p`, [viewer.id, isHeadCoach(viewer), id]);
  if (!rows[0]) throw NOT_FOUND();
  return rows[0];
}

export async function publishPlan(db: pg.Pool, viewer: Account, id: string): Promise<void> {
  // Off until the trainee app has the table (TCR-003): the same answer as a route that does not exist.
  if (!(await appPlansExist(db))) throw NOT_FOUND();
  await transaction(db, async (tx) => {
    const plan = await requirePlanForUpdate(tx, viewer, id);
    if (plan.status === 'ended') throw new ApiError('NOT_PERMITTED');
    if (!planIsReady(plan.content)) throw new ApiError('PLAN_NOT_READY');
    if (plan.status === 'active' && plan.live_version === plan.version) return; // nothing new to publish

    if (plan.status === 'draft') {
      // One live plan per client: the one being replaced ends in this same transaction.
      const old = await tx.query<{ id: string; version: number }>(
        `update coach.training_plans set status = 'ended', ended_at = now(), updated_at = now()
         where trainee_id = $1 and status = 'active' returning id, coalesce(live_version, version) as version`,
        [plan.trainee_id],
      );
      for (const row of old.rows) {
        await tx.query(`update app.training_plans set status = 'ended', ended_at = now() where id = $1`, [row.id]);
        await log(tx, row.id, viewer, 'ended', row.version, 'Replaced by a new plan');
      }
    }

    await tx.query(
      `update coach.training_plans
       set status = 'active', live_version = version, published_at = now(), updated_at = now() where id = $1`,
      [id],
    );
    await tx.query(`insert into coach.plan_versions (plan_id, version, name, content, published_by) values ($1, $2, $3, $4, $5)`, [
      id,
      plan.version,
      plan.name,
      JSON.stringify(plan.content),
      viewer.id,
    ]);
    await tx.query(
      `insert into app.training_plans
         (id, user_id, version, name, status, weeks, schedule_mode, weekly_target, daily_target, start_date, days,
          set_by_user_id, set_by_role, published_at)
       values ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10, $11, $12, now())
       on conflict (id) do update set
         version = excluded.version, name = excluded.name, status = 'active', weeks = excluded.weeks,
         schedule_mode = excluded.schedule_mode, weekly_target = excluded.weekly_target,
         daily_target = excluded.daily_target, start_date = excluded.start_date, days = excluded.days,
         set_by_user_id = excluded.set_by_user_id, set_by_role = excluded.set_by_role,
         published_at = excluded.published_at`,
      [
        id,
        plan.trainee_id,
        plan.version,
        plan.name,
        plan.content.weeks,
        plan.content.scheduleMode,
        plan.content.weeklyTarget,
        plan.content.dailyTarget,
        plan.start_date,
        JSON.stringify(plan.content.days),
        viewer.id,
        roleOf(viewer),
      ],
    );
    await log(tx, id, viewer, 'published', plan.version);
  });
}

/** Ends a live plan. The client keeps their history; the Training tab returns to their own logging. */
export async function endPlan(db: pg.Pool, viewer: Account, id: string): Promise<void> {
  await transaction(db, async (tx) => {
    const plan = await requirePlanForUpdate(tx, viewer, id);
    if (plan.status !== 'active') throw new ApiError('NOT_PERMITTED');
    await tx.query(`update coach.training_plans set status = 'ended', ended_at = now(), updated_at = now() where id = $1`, [id]);
    if (await appPlansExist(tx)) {
      await tx.query(`update app.training_plans set status = 'ended', ended_at = now() where id = $1`, [id]);
    }
    await log(tx, id, viewer, 'ended', plan.live_version ?? plan.version);
  });
}

/**
 * Discards a draft that was never published (the plan is deleted), or throws away the unpublished
 * changes of a live plan (its working copy goes back to what the client sees).
 */
export async function discardPlan(db: pg.Pool, viewer: Account, id: string): Promise<void> {
  await transaction(db, async (tx) => {
    const plan = await requirePlanForUpdate(tx, viewer, id);
    if (plan.status === 'ended') throw new ApiError('NOT_PERMITTED');
    if (plan.status === 'draft') {
      await tx.query('delete from coach.training_plans where id = $1', [id]);
      return;
    }
    if (plan.live_version === null || plan.version === plan.live_version) return;
    const live = await tx.query<{ name: string; content: PlanContent }>('select name, content from coach.plan_versions where plan_id = $1 and version = $2', [id, plan.live_version]);
    if (!live.rows[0]) throw NOT_FOUND();
    await tx.query(`update coach.training_plans set name = $2, content = $3, version = $4, updated_at = now() where id = $1`, [
      id,
      live.rows[0].name,
      JSON.stringify(live.rows[0].content),
      plan.live_version,
    ]);
    await log(tx, id, viewer, 'reverted', plan.live_version, 'Unpublished changes discarded');
  });
}

/** Opens an earlier published version as a new draft of the working copy. */
export async function restorePlan(db: pg.Pool, viewer: Account, id: string, version: number): Promise<PlanDetail> {
  await transaction(db, async (tx) => {
    const plan = await requirePlanForUpdate(tx, viewer, id);
    if (plan.status === 'ended') throw new ApiError('NOT_PERMITTED');
    const old = await tx.query<{ name: string; content: PlanContent }>('select name, content from coach.plan_versions where plan_id = $1 and version = $2', [id, version]);
    if (!old.rows[0]) throw NOT_FOUND();
    const next = plan.version + 1;
    await tx.query(`update coach.training_plans set name = $2, content = $3, version = $4, updated_at = now() where id = $1`, [
      id,
      old.rows[0].name,
      JSON.stringify(old.rows[0].content),
      next,
    ]);
    await log(tx, id, viewer, 'restored', next, `Restored version ${version}`);
  });
  return getPlan(db, viewer, id);
}
