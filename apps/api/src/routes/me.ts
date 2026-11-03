// GET and POST /v1/me (CAUTH-001, CAUTH-005, CAUTH-006).
// - GET: who is signed in, their roles and their coach details; the app routes on it after log in.
// - POST: sets the account up for the coach app. Same rules as the trainee API's account setup:
//   no account without the 18+ confirmation (REQ-ACC-010) and a confirmed email, and the email
//   comes from Supabase Auth, never from the request.
import { API_BASE_PATH, meSetupRequestSchema, validationDetails } from '@fitsphere-coach/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireIdentity } from '../access.ts';
import { findAccount, meBody, setUpCoachAccount } from '../accounts.ts';
import type { Auth } from '../auth.ts';
import { ApiError } from '../errors.ts';

export function registerMeRoutes(app: FastifyInstance, deps: { db: pg.Pool | Pick<pg.Pool, 'query'>; auth: Auth }) {
  app.get(`${API_BASE_PATH}/me`, { config: { access: 'signedIn' } }, async (request) => {
    const account = await findAccount(deps.db, requireIdentity(request).subject);
    if (!account) throw new ApiError('ACCOUNT_SETUP_REQUIRED');
    request.account = account;
    return meBody(account);
  });

  app.post(`${API_BASE_PATH}/me`, { config: { access: 'signedIn' } }, async (request, reply) => {
    const identity = requireIdentity(request);
    const body: unknown = request.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new ApiError('VALIDATION_FAILED');
    if ((body as { ageConfirmed?: unknown }).ageConfirmed !== true) throw new ApiError('AGE_CONFIRMATION_REQUIRED');
    const parsed = meSetupRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, body));

    const user = await deps.auth.readSignedInUser(identity);
    if (!user.emailConfirmed || !user.email) throw new ApiError('EMAIL_NOT_VERIFIED');

    if (!('connect' in deps.db)) throw new Error('Account setup needs a database pool');
    const created = await setUpCoachAccount(deps.db, {
      subject: identity.subject,
      email: user.email,
      ageConfirmationTextVersion: parsed.data.ageConfirmationTextVersion,
      fullName: parsed.data.fullName,
      coachTermsVersion: parsed.data.coachTermsVersion,
    });
    const account = await findAccount(deps.db, identity.subject);
    if (!account) throw new Error('Account missing after setup');
    request.account = account;
    return reply.status(created ? 201 : 200).send(meBody(account));
  });
}
