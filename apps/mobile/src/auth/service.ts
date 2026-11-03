import {
  AGE_CONFIRMATION_TEXT_VERSION,
  COACH_TERMS_VERSION,
  isCoachAccount,
  type MeResponse,
} from '@fitsphere-coach/shared';
import { callApi } from '../api/client';

// Sign-up, log in, account setup and passwords (CAUTH-001…006). The app talks to Supabase Auth for
// the session (shared with the trainee app) and to the coach API for the account. Same approach
// as the trainee app's auth service, so both apps treat an account the same way.

type ErrorLike = { name?: string; code?: string | undefined; status?: number | undefined } | null;

export type MinimalSession = {
  access_token: string;
  user: { id: string; email?: string | undefined; user_metadata: Record<string, unknown> };
};

type SessionResult = Promise<{ data: { session: MinimalSession | null }; error: ErrorLike }>;

/** The part of supabase-js's `auth` client the app uses; tests pass a fake. */
export type AuthClient = {
  signUp(credentials: { email: string; password: string; options: { emailRedirectTo: string; data: object } }): Promise<{
    error: ErrorLike;
  }>;
  resend(params: { type: 'signup'; email: string; options: { emailRedirectTo: string } }): Promise<{ error: ErrorLike }>;
  signInWithPassword(credentials: { email: string; password: string }): SessionResult;
  signOut(options: { scope: 'local' | 'others' | 'global' }): Promise<{ error: ErrorLike }>;
  getSession(): SessionResult;
  refreshSession(): SessionResult;
  updateUser(attributes: { data?: object; password?: string }): Promise<{ error: ErrorLike }>;
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: ErrorLike }>;
  exchangeCodeForSession(code: string): SessionResult;
  onAuthStateChange(callback: (event: string, session: MinimalSession | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
};

export type AuthDeps = {
  client: AuthClient;
  apiUrl: string | undefined;
  /** Where email links open the app: `fitspherecoach://…` in a build, `exp://…` in Expo Go. */
  links: { verified: string; resetPassword: string };
  fetchImpl?: typeof fetch;
};

// supabase-js reports a request that never reached Supabase as AuthRetryableFetchError, status 0.
function isOffline(error: ErrorLike): boolean {
  return error?.name === 'AuthRetryableFetchError' && !error.status;
}

function isRateLimited(error: ErrorLike): boolean {
  return error?.status === 429 || error?.code === 'over_request_rate_limit' || error?.code === 'over_email_send_rate_limit';
}

export type SignUpInput = { fullName: string; email: string; password: string };

/**
 * Coach sign-up. The 18+ confirmation, the name and the coach terms version go into the sign-in
 * account's metadata, so account setup can send them once the email is confirmed (on any phone).
 * Whatever Supabase answers, the app shows the same "check your inbox" step (invariant 3); only a
 * request that never left the phone is reported.
 */
export async function signUp(deps: AuthDeps, input: SignUpInput): Promise<'sent' | 'offline' | 'unavailable'> {
  try {
    const { error } = await deps.client.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        emailRedirectTo: deps.links.verified,
        data: {
          age_confirmed: true,
          age_confirmation_text_version: AGE_CONFIRMATION_TEXT_VERSION,
          full_name: input.fullName.trim().replace(/\s+/g, ' '),
          coach_terms_version: COACH_TERMS_VERSION,
        },
      },
    });
    if (isOffline(error)) return 'offline';
    if (error && (error.status ?? 0) >= 500) return 'unavailable';
    return 'sent';
  } catch {
    return 'offline';
  }
}

/** Sends the verify email again; the screen shows the same text whatever happens. */
export async function resendVerification(deps: AuthDeps, email: string): Promise<'sent' | 'offline'> {
  try {
    const { error } = await deps.client.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: deps.links.verified },
    });
    return isOffline(error) ? 'offline' : 'sent';
  } catch {
    return 'offline';
  }
}

export type SignInResult = 'signedIn' | 'failed' | 'locked' | 'offline' | 'unavailable';

/** An unverified account gets the same failure text as a wrong password. */
export async function signIn(deps: AuthDeps, email: string, password: string): Promise<SignInResult> {
  try {
    const { data, error } = await deps.client.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (isOffline(error)) return 'offline';
    if (isRateLimited(error)) return 'locked';
    if (error && (error.status ?? 0) >= 500) return 'unavailable';
    return data.session ? 'signedIn' : 'failed';
  } catch {
    return 'offline';
  }
}

/** Where the app goes after log in (CF01-coach-auth-ui.md §2). */
export type AccountState =
  | { kind: 'coach'; me: MeResponse }
  /** Signed in with a FitSphere account that has not switched on coaching (CAUTH-001 AC4). */
  | { kind: 'coachingOff'; me: MeResponse | null; email: string | null }
  | { kind: 'emailNotVerified'; email: string | null }
  | { kind: 'signedOut' }
  | { kind: 'offline' }
  | { kind: 'unavailable' };

/**
 * Reads the account (`GET /v1/me`) and, for a coach sign-up whose account does not exist yet, sets
 * it up from the sign-up metadata (`POST /v1/me`). A token the API refuses is refreshed once; if
 * it is refused again, the phone signs out.
 */
export async function ensureAccount(deps: AuthDeps): Promise<AccountState> {
  let session = (await deps.client.getSession()).data.session;
  if (!session) return { kind: 'signedOut' };

  let me = await callApi<MeResponse>(deps.apiUrl, '/me', options(deps, session));
  if (me.kind === 'error' && me.status === 401) {
    session = (await deps.client.refreshSession()).data.session;
    if (!session) return signOutLocally(deps);
    me = await callApi<MeResponse>(deps.apiUrl, '/me', options(deps, session));
    if (me.kind === 'error' && me.status === 401) return signOutLocally(deps);
  }
  if (me.kind === 'offline') return { kind: 'offline' };
  const email = session.user.email ?? null;

  const metadata = session.user.user_metadata;
  const setup = coachSetupFrom(metadata);
  const needsSetup =
    (me.kind === 'error' && me.code === 'ACCOUNT_SETUP_REQUIRED') || (me.kind === 'ok' && me.body.coach === null);
  if (me.kind === 'error' && me.code !== 'ACCOUNT_SETUP_REQUIRED') return { kind: 'unavailable' };

  if (needsSetup && setup) {
    const created = await callApi<MeResponse>(deps.apiUrl, '/me', {
      ...options(deps, session),
      method: 'POST',
      body: setup,
    });
    if (created.kind === 'offline') return { kind: 'offline' };
    if (created.kind === 'error') {
      if (created.code === 'EMAIL_NOT_VERIFIED') return { kind: 'emailNotVerified', email };
      return { kind: 'unavailable' };
    }
    return route(created.body, email);
  }
  if (me.kind === 'ok') return route(me.body, email);
  // Signed in, but no account and no coach sign-up details (e.g. made in another app).
  return { kind: 'coachingOff', me: null, email };
}

function route(me: MeResponse, email: string | null): AccountState {
  return isCoachAccount(me.roles) ? { kind: 'coach', me } : { kind: 'coachingOff', me, email };
}

/** The coach sign-up details saved in the metadata, or null when this was not a coach sign-up. */
function coachSetupFrom(metadata: Record<string, unknown>) {
  const { age_confirmed, age_confirmation_text_version, full_name, coach_terms_version } = metadata;
  if (
    age_confirmed !== true ||
    typeof age_confirmation_text_version !== 'string' ||
    typeof full_name !== 'string' ||
    typeof coach_terms_version !== 'string'
  ) {
    return null;
  }
  return {
    ageConfirmed: true,
    ageConfirmationTextVersion: age_confirmation_text_version,
    fullName: full_name,
    coachTermsVersion: coach_terms_version,
  };
}

/**
 * Opens the verify link: trades its one-time code for a session. The code works only on the phone
 * that signed up (it holds the PKCE verifier); on another phone the email is still verified, and
 * the coach logs in instead.
 */
export async function openVerifyLink(deps: AuthDeps, code: string | undefined): Promise<'ready' | 'logIn' | 'offline'> {
  if (!code) return 'logIn';
  try {
    const { data, error } = await deps.client.exchangeCodeForSession(code);
    if (isOffline(error)) return 'offline';
    return data.session ? 'ready' : 'logIn';
  } catch {
    return 'logIn';
  }
}

/** Forgot password: whatever Supabase answers, the app shows the same neutral text (invariant 3). */
export async function requestPasswordReset(deps: AuthDeps, email: string): Promise<'sent' | 'offline'> {
  try {
    const { error } = await deps.client.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: deps.links.resetPassword,
    });
    return isOffline(error) ? 'offline' : 'sent';
  } catch {
    return 'offline';
  }
}

/** Opens the reset link: trades its one-time code for a session (same phone only, as above). */
export async function startPasswordReset(deps: AuthDeps, code: string | undefined): Promise<'ready' | 'expired' | 'offline'> {
  if (!code) return 'expired';
  try {
    const { data, error } = await deps.client.exchangeCodeForSession(code);
    if (isOffline(error)) return 'offline';
    return data.session ? 'ready' : 'expired';
  } catch {
    return 'expired';
  }
}

export type NewPasswordResult = 'changed' | 'samePassword' | 'failed' | 'offline';

/** Sets the new password after a reset link, then signs out every other session (CAUTH-003). */
export async function setNewPassword(deps: AuthDeps, password: string): Promise<NewPasswordResult> {
  try {
    const { error } = await deps.client.updateUser({ password });
    if (error) {
      if (isOffline(error)) return 'offline';
      return error.code === 'same_password' ? 'samePassword' : 'failed';
    }
    await deps.client.signOut({ scope: 'others' }).catch(() => undefined);
    return 'changed';
  } catch {
    return 'offline';
  }
}

export type ChangePasswordResult = 'changed' | 'wrongPassword' | 'samePassword' | 'failed' | 'offline';

/**
 * Change password (CAUTH-004). The current password is checked by signing in again; then the new
 * password is set and other devices are signed out. This phone stays signed in. The password is
 * the same for both FitSphere apps (CAUTH-005).
 */
export async function changePassword(deps: AuthDeps, email: string, current: string, next: string): Promise<ChangePasswordResult> {
  const check = await signIn(deps, email, current);
  if (check === 'offline') return 'offline';
  if (check === 'failed') return 'wrongPassword';
  if (check !== 'signedIn') return 'failed';
  return setNewPassword(deps, next);
}

/** Log out on this phone (CAUTH-004): the server session ends and the stored tokens are cleared. */
export async function logOut(deps: AuthDeps): Promise<void> {
  await deps.client.signOut({ scope: 'local' }).catch(() => undefined);
}

export async function signOutLocally(deps: AuthDeps): Promise<{ kind: 'signedOut' }> {
  await logOut(deps);
  return { kind: 'signedOut' };
}

function options(deps: AuthDeps, session: MinimalSession) {
  return { token: session.access_token, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) };
}
