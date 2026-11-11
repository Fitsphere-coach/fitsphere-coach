// Inviting a trainee (CF04, SPEC-001 → coach-scope §3.4; TCR-001, ADR-0006, C-D18 to C-D24).
//
// The invitation lives in schema `app` (`app.coach_invitations`, built by Developer 1 from TCR-001)
// because the trainee app answers it. This module only writes it; it never accepts or declines for
// the trainee, and it never creates a link: the trainee's acceptance does (C-D23).
//
// **Off until TCR-001 is built** (C-D22): every route answers "not found" while
// TRAINEE_INVITES_ENABLED is false, so a missing table is never queried.
//
// Rules kept here:
// - a Coach invites under themselves; the Head Coach under themselves or a Coach of the gym (C-D21);
// - a trainee already in the gym is refused: "This trainee is already added." (C-D19). Someone in
//   another gym is not revealed: the invite goes out and the trainee's answer decides (invariant 3);
// - a Coach or the Head Coach of this gym cannot be invited as a trainee (C-D24);
// - the inviter always sees the same answer whether or not the email has a FitSphere account;
// - an invitation email goes only to an address with no account; an existing account sees it in the
//   FitSphere app (TCR-001 open question 4);
// - inviting the same email again replaces the pending invitation (this is "resend");
// - invitations per person per day are limited, by India date (invariant 4); the token is stored
//   only as a keyed hash.
import { randomBytes, randomUUID } from 'node:crypto';
import type { InvitationSummary, InviteClientRequest } from '@fitsphere-coach/shared';
import type pg from 'pg';
import type { Account } from './accounts.ts';
import { hashCode } from './approvalCode.ts';
import { ApiError } from './errors.ts';
import { inviteEmail } from './mailer.ts';
import type { OnboardingDeps } from './onboarding.ts';

type Queryable = Pick<pg.Pool, 'query'>;
const DAY_MS = 24 * 60 * 60 * 1000;

const NOT_FOUND = () => new ApiError('NOT_FOUND');

/** The viewer's gym: its Head Coach's id and the gym's name. Null if the viewer has none. */
async function gymOf(db: Queryable, viewer: Account): Promise<{ headCoachId: string; gymName: string } | null> {
  let headCoachId: string | null = null;
  if (viewer.roles.includes('head_coach')) headCoachId = viewer.id;
  else if (viewer.roles.includes('coach')) {
    const { rows } = await db.query<{ upper_user_id: string }>(
      `select upper_user_id from app.links where kind = 'head_coach_coach' and status = 'active' and lower_user_id = $1`,
      [viewer.id],
    );
    headCoachId = rows[0]?.upper_user_id ?? null;
  }
  if (!headCoachId) return null;
  const { rows } = await db.query<{ name: string }>('select name from coach.gyms where head_coach_id = $1', [headCoachId]);
  return rows[0] ? { headCoachId, gymName: rows[0].name } : null;
}

/** The people of a gym who can hold a client: the Head Coach and the gym's Coaches. */
const GYM_PEOPLE = `
  select $1::uuid as id
  union
  select l.lower_user_id from app.links l
  where l.kind = 'head_coach_coach' and l.status = 'active' and l.upper_user_id = $1`;

async function nameOf(db: Queryable, userId: string): Promise<string | null> {
  const { rows } = await db.query<{ full_name: string }>('select full_name from coach.profiles where user_id = $1', [userId]);
  return rows[0]?.full_name ?? null;
}

export function invitesEnabled(deps: OnboardingDeps): boolean {
  return deps.settings.traineeInvitesEnabled;
}

export async function inviteClient(
  db: pg.Pool,
  viewer: Account,
  input: { email: string; coachId?: string | undefined },
  deps: OnboardingDeps,
  log: { warn(fields: object, message: string): void },
): Promise<InvitationSummary> {
  if (!invitesEnabled(deps)) throw NOT_FOUND();
  const { settings } = deps;
  const gym = await gymOf(db, viewer);
  if (!gym) throw new ApiError('NOT_PERMITTED');
  const now = deps.now ? deps.now() : new Date();
  const isHead = viewer.roles.includes('head_coach');

  // Who the client will be under.
  let assignedId = viewer.id;
  if (input.coachId && input.coachId !== viewer.id) {
    if (!isHead) throw new ApiError('NOT_PERMITTED');
    const { rowCount } = await db.query(`select 1 from (${GYM_PEOPLE}) people where id = $2`, [viewer.id, input.coachId]);
    if (!rowCount) throw new ApiError('VALIDATION_FAILED', [{ field: 'coachId', issue: 'invalid_format' }]);
    assignedId = input.coachId;
  }

  // A Coach or the Head Coach of this gym is not a trainee of it (C-D24).
  const people = await db.query(
    `select 1 from app.users u where u.email = $2 and u.id in (${GYM_PEOPLE})`,
    [gym.headCoachId, input.email],
  );
  if (people.rowCount) throw new ApiError('CANNOT_INVITE_EMAIL');

  // Already a trainee of this gym (C-D19). Another gym's trainee is not revealed.
  const added = await db.query(
    `select 1 from app.links l join app.users u on u.id = l.lower_user_id
     where l.kind = 'coach_trainee' and l.status = 'active' and u.email = $2
       and l.upper_user_id in (${GYM_PEOPLE})`,
    [gym.headCoachId, input.email],
  );
  if (added.rowCount) throw new ApiError('ALREADY_ADDED');

  const assignedName = await nameOf(db, assignedId);
  const headName = await nameOf(db, gym.headCoachId);
  const id = randomUUID();
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(now.getTime() + settings.traineeInviteValidDays * DAY_MS);

  const client = await db.connect();
  let open = false;
  try {
    await client.query('begin');
    open = true;
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`invite:${viewer.id}`]);

    const { rows: today } = await client.query<{ n: number }>(
      `select count(*)::int as n from app.coach_invitations
       where invited_by_id = $1
         and (created_at at time zone 'Asia/Kolkata')::date = ($2::timestamptz at time zone 'Asia/Kolkata')::date`,
      [viewer.id, now],
    );
    if ((today[0]?.n ?? 0) >= settings.invitesPerDay) throw new ApiError('INVITE_LIMIT_REACHED');

    // The same email again replaces the pending invitation: this is "resend".
    await client.query(
      `update app.coach_invitations set status = 'cancelled', responded_at = $3
       where gym_head_coach_id = $1 and invitee_email = $2 and status = 'pending'`,
      [gym.headCoachId, input.email, now],
    );
    const { rows: existing } = await client.query<{ id: string }>('select id from app.users where email = $1', [input.email]);
    const inviteeId = existing[0]?.id ?? null;
    await client.query(
      `insert into app.coach_invitations
         (id, gym_head_coach_id, assigned_coach_id, invited_by_id, invitee_email, invitee_user_id, token_hash,
          gym_name, assigned_coach_name, head_coach_name, created_at, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        gym.headCoachId,
        assignedId,
        viewer.id,
        input.email,
        inviteeId,
        hashCode(settings.approvalCodeSecret, id, token),
        gym.gymName,
        assignedName ?? 'Your coach',
        headName ?? 'Head coach',
        now,
        expiresAt,
      ],
    );

    // An existing account sees the invitation in the FitSphere app; only a new address is emailed.
    if (!inviteeId) {
      try {
        await deps.mailer.send(
          inviteEmail(settings, { inviteeEmail: input.email, gymName: gym.gymName, coachName: assignedName ?? 'Your coach', token, expiresAt }),
        );
      } catch {
        await client.query('rollback');
        open = false;
        log.warn({ event: 'invite_not_sent', userId: viewer.id }, 'invitation email not sent');
        throw new ApiError('INVITE_EMAIL_FAILED');
      }
    }
    await client.query('commit');
    open = false;
  } catch (error) {
    if (open) await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return { id, email: input.email, coachId: assignedId, coachName: assignedName, expiresAt: expiresAt.toISOString() };
}

/** Pending, not-yet-expired invitations the viewer may see: the Head Coach's gym, or a Coach's own. */
export async function listInvitations(db: Queryable, viewer: Account, deps: OnboardingDeps): Promise<InvitationSummary[]> {
  if (!invitesEnabled(deps)) return [];
  const gym = await gymOf(db, viewer);
  if (!gym) return [];
  const now = deps.now ? deps.now() : new Date();
  const { rows } = await db.query<{ id: string; invitee_email: string; assigned_coach_id: string; assigned_coach_name: string; expires_at: Date }>(
    `select id, invitee_email, assigned_coach_id, assigned_coach_name, expires_at
     from app.coach_invitations
     where gym_head_coach_id = $1 and status = 'pending' and expires_at > $2
       and ($3::boolean or invited_by_id = $4)
     order by created_at desc`,
    [gym.headCoachId, now, viewer.roles.includes('head_coach'), viewer.id],
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.invitee_email,
    coachId: row.assigned_coach_id,
    coachName: row.assigned_coach_name,
    expiresAt: row.expires_at.toISOString(),
  }));
}

/** Cancels a pending invitation: the Head Coach any in the gym, a Coach their own. */
export async function cancelInvitation(db: Queryable, viewer: Account, invitationId: string, deps: OnboardingDeps): Promise<void> {
  if (!invitesEnabled(deps)) throw NOT_FOUND();
  const gym = await gymOf(db, viewer);
  if (!gym) throw NOT_FOUND();
  const { rowCount } = await db.query(
    `update app.coach_invitations set status = 'cancelled', responded_at = now()
     where id = $1 and gym_head_coach_id = $2 and status = 'pending'
       and ($3::boolean or invited_by_id = $4)`,
    [invitationId, gym.headCoachId, viewer.roles.includes('head_coach'), viewer.id],
  );
  if (!rowCount) throw NOT_FOUND();
}

export type { InviteClientRequest };
