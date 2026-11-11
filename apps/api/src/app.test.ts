// The API without a database: access rules, token checks and the error shape.
import { randomUUID } from 'node:crypto';
import { errorBodySchema, meResponseSchema } from '@fitsphere-coach/shared';
import { describe, expect, it } from 'vitest';
import { createTestAuth, createTestKeys, signToken, TEST_ISSUER } from '../test/helpers/auth.ts';
import { testOnboarding } from '../test/helpers/onboarding.ts';
import { buildApp } from './app.ts';

type Row = { id: string; email: string; created_at: Date; roles: string[]; full_name?: string | null };

/** A stand-in for the database: answers the account lookup from a map keyed by auth subject. */
function fakeDb(accounts: Map<string, Row>) {
  return {
    query: async (_sql: string, params?: unknown[]) => {
      const row = accounts.get(String(params?.[0]));
      return { rows: row ? [{ full_name: null, ...row }] : [] };
    },
  } as never;
}

async function setup(accounts = new Map<string, Row>()) {
  const { auth, keys } = await createTestAuth();
  const app = buildApp({ db: fakeDb(accounts), auth, onboarding: testOnboarding().deps });
  await app.ready();
  return { app, keys, accounts };
}

describe('GET /v1/health', () => {
  it('answers without a token', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'coach-api' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });
});

describe('access rules', () => {
  it('every route declares one, and only health is public', async () => {
    const { app } = await setup();
    expect(app.registeredRoutes.length).toBeGreaterThan(0);
    for (const route of app.registeredRoutes) {
      expect(route.access === 'public').toBe(route.url === '/v1/health');
    }
  });

  it('a route without an access rule cannot be registered', async () => {
    const { app } = await setup();
    const { auth } = await createTestAuth();
    const other = buildApp({ db: fakeDb(new Map()), auth, onboarding: testOnboarding().deps });
    expect(() => other.get('/v1/oops', async () => ({}))).toThrow(/no access rule/);
    await app.close();
  });

  it('an unknown path answers 404 in the error shape', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'GET', url: '/v1/nothing-here' });
    expect(response.statusCode).toBe(404);
    expect(errorBodySchema.parse(response.json()).error.code).toBe('NOT_FOUND');
  });
});

describe('GET /v1/me', () => {
  it('refuses a missing, malformed, foreign or expired token with 401', async () => {
    const { app, keys } = await setup();
    const subject = randomUUID();
    const { keys: otherKeys } = await createTestKeys('other');
    const tokens = [
      undefined,
      'Bearer',
      `Bearer ${await signToken(otherKeys, subject)}`,
      `Bearer ${await signToken(keys, subject, { issuer: `${TEST_ISSUER}/other` })}`,
      `Bearer ${await signToken(keys, subject, { expiresAt: Math.floor(Date.now() / 1000) - 60 })}`,
      `Bearer ${await signToken(keys, subject, { claims: { is_anonymous: true } })}`,
    ];
    for (const authorization of tokens) {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: authorization ? { authorization } : {},
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
      expect(response.headers['www-authenticate']).toBe('Bearer');
    }
  });

  it('answers ACCOUNT_SETUP_REQUIRED when the signed-in user has no FitSphere account', async () => {
    const { app, keys } = await setup();
    const token = await signToken(keys, randomUUID());
    const response = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('returns the account and its roles', async () => {
    const subject = randomUUID();
    const accounts = new Map<string, Row>([
      [subject, { id: randomUUID(), email: 'coach@example.test', created_at: new Date('2026-11-03T08:00:00Z'), roles: ['coach', 'personal'] }],
    ]);
    const { app, keys } = await setup(accounts);
    const token = await signToken(keys, subject);
    const response = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(200);
    const body = meResponseSchema.parse(response.json());
    expect(body.roles).toEqual(['coach', 'personal']);
    expect(body.coach).toBeNull();
    expect(body.user.createdAt).toBe('2026-11-03T08:00:00.000Z');
  });
});

describe('POST /v1/me (validation before any database call)', () => {
  async function post(payload: unknown) {
    const { app, keys } = await setup();
    const token = await signToken(keys, randomUUID());
    return app.inject({ method: 'POST', url: '/v1/me', headers: { authorization: `Bearer ${token}` }, payload: payload as object });
  }
  const valid = { ageConfirmed: true, ageConfirmationTextVersion: '2026-10-27', fullName: 'Asha Rao', coachTermsVersion: '2026-11-03' };

  it('refuses without the 18+ confirmation', async () => {
    const response = await post({ ...valid, ageConfirmed: false });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('AGE_CONFIRMATION_REQUIRED');
  });

  it('refuses a name that is too short, a missing terms version and unknown fields', async () => {
    const response = await post({ ageConfirmed: true, ageConfirmationTextVersion: 'v', fullName: ' A ', email: 'x@example.test' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual(
      expect.arrayContaining([
        { field: 'fullName', issue: 'out_of_range' },
        { field: 'coachTermsVersion', issue: 'required' },
        { field: 'email', issue: 'unknown_field' },
      ]),
    );
  });

  it('refuses an unconfirmed or unknown Supabase user with EMAIL_NOT_VERIFIED or AUTH_REQUIRED', async () => {
    const { app, keys, supabase } = await setupWithSupabase();
    const subject = randomUUID();
    supabase.users.set(subject, { email: 'new@example.test', confirmed: false });
    const token = await signToken(keys, subject);
    const unconfirmed = await app.inject({ method: 'POST', url: '/v1/me', headers: { authorization: `Bearer ${token}` }, payload: valid });
    expect(unconfirmed.json().error.code).toBe('EMAIL_NOT_VERIFIED');
    const stranger = await signToken(keys, randomUUID());
    const unknown = await app.inject({ method: 'POST', url: '/v1/me', headers: { authorization: `Bearer ${stranger}` }, payload: valid });
    expect(unknown.statusCode).toBe(401);
  });
});

async function setupWithSupabase() {
  const { auth, keys, supabase } = await createTestAuth();
  const app = buildApp({ db: fakeDb(new Map()), auth, onboarding: testOnboarding().deps });
  await app.ready();
  return { app, keys, supabase };
}
