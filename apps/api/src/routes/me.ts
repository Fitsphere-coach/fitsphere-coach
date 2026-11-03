// GET /v1/me: who is signed in, and which roles the account has switched on. The coach app uses it
// after log in to decide where to go (CF01 UI doc §2). Account creation is CF01's work.
import { API_BASE_PATH } from '@fitsphere-coach/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireIdentity } from '../access.ts';
import { findAccount, meBody } from '../accounts.ts';
import { ApiError } from '../errors.ts';

export function registerMeRoutes(app: FastifyInstance, deps: { db: Pick<pg.Pool, 'query'> }) {
  app.get(`${API_BASE_PATH}/me`, { config: { access: 'signedIn' } }, async (request) => {
    const account = await findAccount(deps.db, requireIdentity(request).subject);
    if (!account) throw new ApiError('ACCOUNT_SETUP_REQUIRED');
    request.account = account;
    return meBody(account);
  });
}
