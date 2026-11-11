// Workout templates (CF06, SPEC-002 → coach-scope §6). A gym is its Head Coach (`coach.gyms`).
//
// Who sees and changes what (invariants 1, 14; owner answer 2026-11-11):
// - a template is visible to its author, and, when gym-wide, to every coach of the gym;
// - any coach may create a gym-wide template; its author and the Head Coach may edit or deactivate it;
// - a personal template is visible and editable by its author only;
// - anything else is "not found", never "not yours".
// Assigning a template copies it into a plan (plans.ts), so editing a template never changes a plan.
import {
  type PlanContent,
  type TemplateDetail,
  type TemplateInput,
  type TemplateSummary,
} from '@fitsphere-coach/shared';
import type pg from 'pg';
import type { Account } from './accounts.ts';
import { isHeadCoach } from './clients.ts';
import { ApiError } from './errors.ts';

type Queryable = Pick<pg.Pool, 'query'>;

export const NOT_FOUND = () => new ApiError('NOT_FOUND');

/** The gym a coach works in: the Head Coach's own, or the gym of the Head Coach linked to a Coach. */
export async function gymOf(db: Queryable, viewer: Account): Promise<string> {
  if (isHeadCoach(viewer)) return viewer.id;
  const { rows } = await db.query<{ upper_user_id: string }>(
    `select upper_user_id from app.links
     where kind = 'head_coach_coach' and status = 'active' and lower_user_id = $1 limit 1`,
    [viewer.id],
  );
  if (!rows[0]) throw new ApiError('NOT_PERMITTED');
  return rows[0].upper_user_id;
}

export const roleOf = (viewer: Account): 'head_coach' | 'coach' => (isHeadCoach(viewer) ? 'head_coach' : 'coach');

type Row = {
  id: string;
  gym_head_coach_id: string;
  created_by: string;
  visibility: TemplateSummary['visibility'];
  name: string;
  goal: TemplateSummary['goal'];
  difficulty: TemplateSummary['difficulty'];
  content: PlanContent;
  active: boolean;
  updated_at: Date;
};

const COLUMNS = 'id, gym_head_coach_id, created_by, visibility, name, goal, difficulty, content, active, updated_at';
const VISIBLE = `gym_head_coach_id = $1 and (visibility = 'gym' or created_by = $2)`;

function canEdit(viewer: Account, row: Row): boolean {
  if (row.created_by === viewer.id) return true;
  return row.visibility === 'gym' && isHeadCoach(viewer) && row.gym_head_coach_id === viewer.id;
}

function toSummary(viewer: Account, row: Row): TemplateSummary {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    difficulty: row.difficulty,
    visibility: row.visibility,
    active: row.active,
    days: row.content.days.length,
    exercises: row.content.days.reduce((total, day) => total + day.exercises.length, 0),
    canEdit: canEdit(viewer, row),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listTemplates(
  db: Queryable,
  viewer: Account,
  filter: { q?: string | undefined; goal?: string | undefined; difficulty?: string | undefined; includeInactive?: boolean },
): Promise<TemplateSummary[]> {
  const gym = await gymOf(db, viewer);
  const { rows } = await db.query<Row>(
    `select ${COLUMNS} from coach.workout_templates
     where ${VISIBLE}
       and ($3::boolean or active)
       and ($4::text is null or name ilike '%' || $4 || '%')
       and ($5::text is null or goal = $5)
       and ($6::text is null or difficulty = $6)
     order by active desc, updated_at desc`,
    [gym, viewer.id, filter.includeInactive ?? false, filter.q?.trim() || null, filter.goal ?? null, filter.difficulty ?? null],
  );
  return rows.map((row) => toSummary(viewer, row));
}

/** A visible template row, or null (answered as not found). Also used when assigning. */
export async function findTemplate(db: Queryable, viewer: Account, id: string): Promise<Row | null> {
  const gym = await gymOf(db, viewer);
  const { rows } = await db.query<Row>(`select ${COLUMNS} from coach.workout_templates where id = $3 and ${VISIBLE}`, [gym, viewer.id, id]);
  return rows[0] ?? null;
}

export async function getTemplate(db: Queryable, viewer: Account, id: string): Promise<TemplateDetail> {
  const row = await findTemplate(db, viewer, id);
  if (!row) throw NOT_FOUND();
  return { ...toSummary(viewer, row), content: row.content };
}

export async function createTemplate(db: Queryable, viewer: Account, request: TemplateInput): Promise<TemplateDetail> {
  const gym = await gymOf(db, viewer);
  const { rows } = await db.query<Row>(
    `insert into coach.workout_templates (gym_head_coach_id, created_by, visibility, name, goal, difficulty, content)
     values ($1, $2, $3, $4, $5, $6, $7) returning ${COLUMNS}`,
    [gym, viewer.id, request.visibility, request.name.trim(), request.goal, request.difficulty, JSON.stringify(request.content)],
  );
  const row = rows[0] as Row;
  return { ...toSummary(viewer, row), content: row.content };
}

export async function updateTemplate(db: Queryable, viewer: Account, id: string, request: TemplateInput): Promise<TemplateDetail> {
  const row = await findTemplate(db, viewer, id);
  if (!row) throw NOT_FOUND();
  if (!canEdit(viewer, row)) throw new ApiError('NOT_PERMITTED');
  // Only the author may change who can use it; the Head Coach edits the content of a gym template.
  if (request.visibility !== row.visibility && row.created_by !== viewer.id) throw new ApiError('NOT_PERMITTED');
  const { rows } = await db.query<Row>(
    `update coach.workout_templates
     set visibility = $2, name = $3, goal = $4, difficulty = $5, content = $6, updated_at = now()
     where id = $1 returning ${COLUMNS}`,
    [id, request.visibility, request.name.trim(), request.goal, request.difficulty, JSON.stringify(request.content)],
  );
  const updated = rows[0] as Row;
  return { ...toSummary(viewer, updated), content: updated.content };
}

/** A copy is always the copier's own personal template, so the original is never touched. */
export async function copyTemplate(db: Queryable, viewer: Account, id: string): Promise<TemplateDetail> {
  const row = await findTemplate(db, viewer, id);
  if (!row) throw NOT_FOUND();
  const name = `${row.name.slice(0, 73)} (copy)`;
  const { rows } = await db.query<Row>(
    `insert into coach.workout_templates (gym_head_coach_id, created_by, visibility, name, goal, difficulty, content)
     values ($1, $2, 'personal', $3, $4, $5, $6) returning ${COLUMNS}`,
    [row.gym_head_coach_id, viewer.id, name, row.goal, row.difficulty, JSON.stringify(row.content)],
  );
  const copy = rows[0] as Row;
  return { ...toSummary(viewer, copy), content: copy.content };
}

/** Deactivates or restores a template. Plans already made from it are not changed. */
export async function setTemplateActive(db: Queryable, viewer: Account, id: string, active: boolean): Promise<void> {
  const row = await findTemplate(db, viewer, id);
  if (!row) throw NOT_FOUND();
  if (!canEdit(viewer, row)) throw new ApiError('NOT_PERMITTED');
  await db.query('update coach.workout_templates set active = $2, updated_at = now() where id = $1', [id, active]);
}
