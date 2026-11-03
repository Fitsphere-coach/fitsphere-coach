// Tokens signed by a key made for each test run; the API under test trusts only that key, and no
// test calls Supabase. Same approach as the trainee repo's test helper.
import { createLocalJWKSet, decodeJwt, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { createSupabaseAuth, type Auth } from '../../src/auth.ts';

export const TEST_SUPABASE_URL = 'https://project-ref.supabase.test';
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;

export type TestKeys = { privateKey: CryptoKey; kid: string };

export async function createTestKeys(kid = 'test-key') {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256' };
  return { keys: { privateKey, kid }, keySet: createLocalJWKSet({ keys: [jwk] }) };
}

type TokenOptions = { issuer?: string; audience?: string; expiresAt?: number; claims?: Record<string, unknown> };

export function signToken(keys: TestKeys, subject: string, options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: 'authenticated', is_anonymous: false, ...options.claims })
    .setProtectedHeader({ alg: 'ES256', kid: keys.kid })
    .setSubject(subject)
    .setIssuer(options.issuer ?? TEST_ISSUER)
    .setAudience(options.audience ?? 'authenticated')
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 3600)
    .sign(keys.privateKey);
}

/** Supabase Auth's `GET /auth/v1/user`, answered from a map of made-up users. */
export function fakeSupabaseUsers() {
  const users = new Map<string, { email: string; confirmed: boolean }>();
  const fetchImpl: typeof fetch = async (_input, init) => {
    const header = new Headers(init?.headers).get('authorization') ?? '';
    const subject = decodeJwt(header.replace(/^Bearer /, '')).sub ?? '';
    const user = users.get(subject);
    if (!user) return Response.json({ msg: 'invalid token' }, { status: 401 });
    return Response.json({
      id: subject,
      email: user.email,
      email_confirmed_at: user.confirmed ? '2026-11-03T03:00:00Z' : null,
    });
  };
  return { users, fetch: fetchImpl };
}

/** The API's auth module on a local key and the fake Supabase. */
export async function createTestAuth(): Promise<{ auth: Auth; keys: TestKeys; supabase: ReturnType<typeof fakeSupabaseUsers> }> {
  const { keys, keySet } = await createTestKeys();
  const supabase = fakeSupabaseUsers();
  const auth = createSupabaseAuth({
    supabaseUrl: TEST_SUPABASE_URL,
    publishableKey: 'sb_publishable_test',
    keySet,
    fetch: supabase.fetch,
  });
  return { auth, keys, supabase };
}
