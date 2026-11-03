// FitSphere accounts. The account itself lives in the shared schema `app` (app.users,
// app.user_roles), which the trainee repo owns; the coach's own details live in schema `coach`.
//
// Account creation follows the trainee API exactly (fitsphere/apps/api/src/accounts.ts,
// `createAccount`): the same columns, the server's time as the 18+ confirmation time, and the
// Personal Training User role. So an account made here is the same as one made in the trainee app,
// and the trainee app keeps working for that person (decision C-D7).
import type { MeResponse, Role } from '@fitsphere-coach/shared';
import type pg from 'pg';

export type Account = { id: string; email: string; createdAt: Date; roles: Role[]; fullName: string | null };

type Queryable = Pick<pg.Pool, 'query'>;

export async function findAccount(db: Queryable, subject: string): Promise<Account | null> {
  const { rows } = await db.query<{ id: string; email: string; created_at: Date; roles: Role[]; full_name: string | null }>(
    `select u.id, u.email, u.created_at, p.full_name,
            coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
     from app.users u
     left join app.user_roles r on r.user_id = u.id
     left join coach.profiles p on p.user_id = u.id
     where u.auth_subject = $1
     group by u.id, p.full_name`,
    [subject],
  );
  const row = rows[0];
  return row
    ? { id: row.id, email: row.email, createdAt: row.created_at, roles: row.roles, fullName: row.full_name }
    : null;
}

export type SetupInput = {
  subject: string;
  email: string;
  ageConfirmationTextVersion: string;
  fullName: string;
  coachTermsVersion: string;
};

/**
 * Sets up the account for the coach app in one transaction:
 * 1. creates the FitSphere account if it does not exist yet, exactly as the trainee API does;
 * 2. saves the coach's name (a later setup updates it);
 * 3. records the coach terms version (once per version).
 * Returns whether step 1 created the account.
 */
export async function setUpCoachAccount(db: pg.Pool, input: SetupInput): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<{ id: string }>(
      `insert into app.users (auth_subject, email, age_confirmed_at, age_confirmation_text_version)
       values ($1, $2, now(), $3)
       on conflict (auth_subject) do nothing
       returning id`,
      [input.subject, input.email, input.ageConfirmationTextVersion],
    );
    const createdId = rows[0]?.id;
    if (createdId) {
      await client.query(`insert into app.user_roles (user_id, role) values ($1, 'personal')`, [createdId]);
    }
    const { rows: users } = await client.query<{ id: string }>('select id from app.users where auth_subject = $1', [
      input.subject,
    ]);
    const userId = users[0]?.id;
    if (!userId) throw new Error('Account missing after setup');
    await client.query(
      `insert into coach.profiles (user_id, full_name) values ($1, $2)
       on conflict (user_id) do update set full_name = excluded.full_name, updated_at = now()`,
      [userId, input.fullName],
    );
    await client.query(
      `insert into coach.terms_acceptances (user_id, terms_version) values ($1, $2)
       on conflict do nothing`,
      [userId, input.coachTermsVersion],
    );
    await client.query('commit');
    return createdId !== undefined;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export function meBody(account: Account): MeResponse {
  return {
    user: { id: account.id, email: account.email, createdAt: account.createdAt.toISOString() },
    roles: account.roles,
    coach: account.fullName === null ? null : { fullName: account.fullName },
  };
}
