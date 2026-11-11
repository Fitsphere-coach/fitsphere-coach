// Gym onboarding routes (CF02). For any signed-in account: the server decides what it may do
// (a Head Coach or Coach is refused a gym request, C-D25), not the access rule alone.
//   GET  /v1/gym/onboarding           where this account is (none, pending, expired, locked, approved)
//   POST /v1/gym/onboarding/requests  send the gym form; the code goes to FitSphere's inbox
//   POST /v1/gym/onboarding/code      enter the code FitSphere gave the owner
import { API_BASE_PATH, approvalCodeSchema, gymRequestSchema, validationDetails } from '@fitsphere-coach/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';
import { readOnboarding, submitGymRequest, verifyApprovalCode, type OnboardingDeps } from '../onboarding.ts';

export function registerGymRoutes(app: FastifyInstance, deps: { db: pg.Pool | Pick<pg.Pool, 'query'>; onboarding: OnboardingDeps }) {
  function pool(): pg.Pool {
    if (!('connect' in deps.db)) throw new Error('Gym onboarding needs a database pool');
    return deps.db;
  }

  app.get(`${API_BASE_PATH}/gym/onboarding`, { config: { access: 'account' } }, async (request) =>
    readOnboarding(deps.db, requireAccount(request), deps.onboarding),
  );

  app.post(`${API_BASE_PATH}/gym/onboarding/requests`, { config: { access: 'account' } }, async (request, reply) => {
    const body: unknown = request.body;
    const parsed = gymRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, body));
    const status = await submitGymRequest(pool(), requireAccount(request), parsed.data, deps.onboarding, request.log);
    return reply.status(201).send(status);
  });

  app.post(`${API_BASE_PATH}/gym/onboarding/code`, { config: { access: 'account' } }, async (request) => {
    const body: unknown = request.body;
    const parsed = approvalCodeSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, body));
    return verifyApprovalCode(pool(), requireAccount(request), parsed.data.code, deps.onboarding);
  });
}
