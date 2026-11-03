// FitSphere accounts, read from the shared schema `app` (app.users, app.user_roles). The trainee
// repo owns these tables; this API reads them, and later writes only what the shared database
// contract allows (rule 4).
import type { MeResponse, Role } from '@fitsphere-coach/shared';
import type pg from 'pg';

export type Account = { id: string; email: string; createdAt: Date; roles: Role[] };

type Queryable = Pick<pg.Pool, 'query'>;

export async function findAccount(db: Queryable, subject: string): Promise<Account | null> {
  const { rows } = await db.query<{ id: string; email: string; created_at: Date; roles: Role[] }>(
    `select u.id, u.email, u.created_at,
            coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
     from app.users u left join app.user_roles r on r.user_id = u.id
     where u.auth_subject = $1
     group by u.id`,
    [subject],
  );
  const row = rows[0];
  return row ? { id: row.id, email: row.email, createdAt: row.created_at, roles: row.roles } : null;
}

export function meBody(account: Account): MeResponse {
  return {
    user: { id: account.id, email: account.email, createdAt: account.createdAt.toISOString() },
    roles: account.roles,
  };
}
