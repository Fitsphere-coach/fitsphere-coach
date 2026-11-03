// The one module that talks to Supabase Auth. The coach app and the trainee app share one Supabase
// project, so a token from either app's sign-in is checked the same way here as in the trainee API
// (fitsphere/apps/api/src/auth.ts). Replacing the sign-in provider means replacing this file.
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError } from './errors.ts';

/** Who signed in: the provider's user ID (the token's `sub`) and the token, kept only for calls to
 * Supabase Auth with the caller's own token. Neither is ever logged. */
export type Identity = { subject: string; token: string };

export type SignedInUser = { subject: string; email: string | null; emailConfirmed: boolean };

export type Auth = {
  /** Checks a Supabase access token. Throws AUTH_REQUIRED, or SERVICE_UNAVAILABLE when the
   * signing keys cannot be fetched. */
  verify(token: string): Promise<Identity>;
  /** Reads the signed-in user from Supabase Auth with the caller's own token (for the confirmed
   * email; Supabase tokens carry no "email verified" claim). */
  readSignedInUser(identity: Identity): Promise<SignedInUser>;
};

type Options = {
  supabaseUrl: string;
  publishableKey: string;
  /** The project's signing keys; tests pass their own. */
  keySet?: JWTVerifyGetKey;
  fetch?: typeof fetch;
};

// Asymmetric keys only: the legacy shared-secret (HS256) method is not accepted.
const ALGORITHMS = ['ES256', 'RS256'];
const SUPABASE_TIMEOUT_MS = 5000;

export function createSupabaseAuth(options: Options): Auth {
  const authUrl = `${options.supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  const keySet = options.keySet ?? createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));
  const fetchImpl = options.fetch ?? fetch;

  return {
    async verify(token) {
      let payload;
      try {
        ({ payload } = await jwtVerify(token, keySet, {
          issuer: authUrl,
          audience: 'authenticated',
          algorithms: ALGORITHMS,
          requiredClaims: ['sub', 'exp'],
        }));
      } catch (error) {
        throw keysUnavailable(error) ? new ApiError('SERVICE_UNAVAILABLE') : new ApiError('AUTH_REQUIRED');
      }
      if (payload.role !== 'authenticated' || payload.is_anonymous === true || !payload.sub) {
        throw new ApiError('AUTH_REQUIRED');
      }
      return { subject: payload.sub, token };
    },

    async readSignedInUser(identity) {
      let response: Response;
      try {
        response = await fetchImpl(`${authUrl}/user`, {
          headers: { apikey: options.publishableKey, Authorization: `Bearer ${identity.token}` },
          signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
        });
      } catch {
        throw new ApiError('SERVICE_UNAVAILABLE');
      }
      if (response.status === 401 || response.status === 403) throw new ApiError('AUTH_REQUIRED');
      if (!response.ok) throw new ApiError('SERVICE_UNAVAILABLE');
      const user = (await response.json()) as { id?: unknown; email?: unknown; email_confirmed_at?: unknown };
      if (user.id !== identity.subject) throw new ApiError('AUTH_REQUIRED');
      return {
        subject: identity.subject,
        email: typeof user.email === 'string' && user.email !== '' ? user.email.toLowerCase() : null,
        emailConfirmed: typeof user.email_confirmed_at === 'string' && user.email_confirmed_at !== '',
      };
    },
  };
}

// The key list could not be fetched or read: not the caller's fault.
function keysUnavailable(error: unknown): boolean {
  if (!(error instanceof errors.JOSEError)) return true;
  return error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid;
}
