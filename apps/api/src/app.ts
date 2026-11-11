import { randomUUID } from 'node:crypto';
import { API_BASE_PATH, type HealthResponse } from '@fitsphere-coach/shared';
import Fastify, { LogController } from 'fastify';
import type pg from 'pg';
import { registerAccess } from './access.ts';
import type { Auth } from './auth.ts';
import { errorBody, handleError } from './errors.ts';
import type { OnboardingDeps } from './onboarding.ts';
import { registerClientRoutes } from './routes/clients.ts';
import { registerGymRoutes } from './routes/gym.ts';
import { registerMeRoutes } from './routes/me.ts';

export type LogOptions = { level: string; stream?: { write(line: string): void } };

export type AppDeps = {
  /** A pool; tests that never set up accounts may pass a stand-in with `query` only. */
  db: pg.Pool | Pick<pg.Pool, 'query'>;
  auth: Auth;
  /** Gym onboarding (CF02): the checked settings and the approval-email sender. */
  onboarding: OnboardingDeps;
  /** Leave out for no logs (most tests). */
  log?: LogOptions;
};

// Never logged (invariant 6): bodies, headers including Authorization, tokens, email addresses and
// query values. The API writes only its own fields, and these paths are removed as a second guard.
const REDACTED = ['req', 'res', 'headers', 'body', 'query', 'params', 'email', 'token', 'authorization'];

export function buildApp(deps: AppDeps) {
  const app = Fastify({
    logger: deps.log
      ? {
          level: deps.log.level,
          ...(deps.log.stream ? { stream: deps.log.stream } : {}),
          redact: { paths: [...REDACTED, ...REDACTED.map((path) => `*.${path}`)], remove: true },
        }
      : false,
    // Fastify's default request log includes the full URL with query values; the API writes its
    // own request line below instead.
    logController: new LogController({ disableRequestLogging: true, requestIdLogLabel: 'requestId' }),
    bodyLimit: 100 * 1024,
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    exposeHeadRoutes: false,
  });

  registerAccess(app, deps);
  app.setErrorHandler(handleError);
  app.setNotFoundHandler((request, reply) => reply.status(404).send(errorBody('NOT_FOUND', request.id)));
  app.addHook('onSend', async (request, reply) => {
    void reply.header('X-Request-Id', request.id);
  });
  // One line per request: the route pattern, never the filled-in path or query.
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        route: request.is404 ? null : request.routeOptions.url,
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        userId: request.account?.id ?? null,
      },
      'request',
    );
  });

  app.get(`${API_BASE_PATH}/health`, { config: { access: 'public' } }, async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'coach-api',
  }));
  registerMeRoutes(app, deps);
  registerGymRoutes(app, deps);
  registerClientRoutes(app, deps);

  return app;
}
