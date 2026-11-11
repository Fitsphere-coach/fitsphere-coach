import { AGE_CONFIRMATION_TEXT_VERSION, COACH_TERMS_VERSION } from '@fitsphere-coach/shared';
import { deps, errorBody, fakeApi, fakeClient, session } from '../testing/fakes';
import { changePassword, ensureAccount, requestPasswordReset, setNewPassword, signIn, signUp } from './service';
import { passwordOk, passwordRules } from './texts';

const offline = { name: 'AuthRetryableFetchError', status: 0 };
const coachMetadata = {
  age_confirmed: true,
  age_confirmation_text_version: AGE_CONFIRMATION_TEXT_VERSION,
  full_name: 'Asha Rao',
  coach_terms_version: COACH_TERMS_VERSION,
};
const me = (roles: string[], coach: { fullName: string } | null = { fullName: 'Asha Rao' }) => ({
  user: { id: '0b6f2a52-6f4b-4c38-9d1f-2b8e4c1a7d10', email: 'coach@example.test', createdAt: '2026-11-03T08:00:00Z' },
  roles,
  coach,
});

const onboarding = (status: 'none' | 'pending' | 'expired' | 'locked') => ({
  status,
  expiresAt: status === 'pending' ? '2026-11-19T08:50:00.000Z' : null,
  triesLeft: status === 'pending' ? 5 : null,
  requestsLeftToday: 3,
  codeLength: 6,
  gymName: null,
});

describe('passwordRules (CF01 §1)', () => {
  it('needs 8+ characters, a number and a letter', () => {
    expect(passwordRules('iron2').map((rule) => rule.met)).toEqual([false, true, true]);
    expect(passwordOk('irongym2026')).toBe(true);
    expect(passwordOk('12345678')).toBe(false);
    expect(passwordOk('a1'.repeat(37))).toBe(false);
  });
});

describe('signUp (CAUTH-006)', () => {
  it('sends the 18+ confirmation, the tidied name and the coach terms in the metadata', async () => {
    const { client, calls } = fakeClient();
    expect(await signUp(deps(client), { fullName: '  Asha   Rao ', email: ' Asha@IronGym.in ', password: 'irongym2026' })).toBe('sent');
    expect(calls[0]?.args[0]).toEqual({
      email: 'asha@irongym.in',
      password: 'irongym2026',
      options: { emailRedirectTo: 'fitspherecoach://verified', data: coachMetadata },
    });
  });

  it('shows the same next step whatever Supabase answers, except when the phone is offline', async () => {
    const taken = fakeClient({ signUp: async () => ({ error: { status: 422, code: 'user_already_exists' } }) });
    expect(await signUp(deps(taken.client), { fullName: 'Asha Rao', email: 'a@b.co', password: 'irongym2026' })).toBe('sent');
    const noNet = fakeClient({ signUp: async () => ({ error: offline }) });
    expect(await signUp(deps(noNet.client), { fullName: 'Asha Rao', email: 'a@b.co', password: 'irongym2026' })).toBe('offline');
  });

  it('goes straight on when Supabase confirms the account at once and sends no email (C-D9)', async () => {
    const confirmed = fakeClient({ signUp: async () => ({ data: { session: session() }, error: null }) });
    expect(await signUp(deps(confirmed.client), { fullName: 'Asha Rao', email: 'a@b.co', password: 'irongym2026' })).toBe('signedIn');
  });

  it('still asks to check the inbox when Supabase sends a link (no session) or the email is taken', async () => {
    const link = fakeClient({ signUp: async () => ({ data: { session: null }, error: null }) });
    expect(await signUp(deps(link.client), { fullName: 'Asha Rao', email: 'a@b.co', password: 'irongym2026' })).toBe('sent');
    const taken = fakeClient({
      signUp: async () => ({ data: { session: null }, error: { status: 422, code: 'user_already_exists' } }),
    });
    expect(await signUp(deps(taken.client), { fullName: 'Asha Rao', email: 'a@b.co', password: 'irongym2026' })).toBe('sent');
  });
});

describe('signIn (CAUTH-001)', () => {
  it('maps Supabase answers to one generic failure, the lockout, or offline', async () => {
    const fail = fakeClient({ signInWithPassword: async () => ({ data: { session: null }, error: { status: 400, code: 'invalid_credentials' } }) });
    expect(await signIn(deps(fail.client), 'a@b.co', 'x')).toBe('failed');
    const unverified = fakeClient({ signInWithPassword: async () => ({ data: { session: null }, error: { status: 400, code: 'email_not_confirmed' } }) });
    expect(await signIn(deps(unverified.client), 'a@b.co', 'x')).toBe('failed');
    const locked = fakeClient({ signInWithPassword: async () => ({ data: { session: null }, error: { status: 429, code: 'over_request_rate_limit' } }) });
    expect(await signIn(deps(locked.client), 'a@b.co', 'x')).toBe('locked');
    const noNet = fakeClient({ signInWithPassword: async () => ({ data: { session: null }, error: offline }) });
    expect(await signIn(deps(noNet.client), 'a@b.co', 'x')).toBe('offline');
    const ok = fakeClient();
    expect(await signIn(deps(ok.client), ' A@B.co ', 'x')).toBe('signedIn');
    expect(ok.calls[0]?.args[0]).toEqual({ email: 'a@b.co', password: 'x' });
  });
});

describe('ensureAccount (CF01 §2 routing)', () => {
  it('is signed out without a session', async () => {
    const { client } = fakeClient();
    expect((await ensureAccount(deps(client))).kind).toBe('signedOut');
  });

  it('sets up a new coach sign-up from the metadata, then routes to gym onboarding (CF02)', async () => {
    const { client } = fakeClient({ getSession: async () => ({ data: { session: session(coachMetadata) }, error: null }) });
    const api = fakeApi([
      { status: 403, body: errorBody('ACCOUNT_SETUP_REQUIRED') },
      { status: 201, body: me(['personal']) },
      { status: 200, body: onboarding('none') },
    ]);
    const state = await ensureAccount(deps(client, api.fetchImpl));
    expect(state).toMatchObject({ kind: 'onboarding', status: { status: 'none' } });
    expect(api.requests[2]).toMatchObject({ method: 'GET', url: 'http://api.test/v1/gym/onboarding', auth: 'Bearer token-1' });
    expect(api.requests[1]).toMatchObject({
      method: 'POST',
      url: 'http://api.test/v1/me',
      auth: 'Bearer token-1',
      body: { ageConfirmed: true, ageConfirmationTextVersion: AGE_CONFIRMATION_TEXT_VERSION, fullName: 'Asha Rao', coachTermsVersion: COACH_TERMS_VERSION },
    });
  });

  it('goes to the coach app for an account with Coach or Head Coach', async () => {
    const { client } = fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) });
    const api = fakeApi([{ status: 200, body: me(['head_coach', 'personal']) }]);
    expect((await ensureAccount(deps(client, api.fetchImpl))).kind).toBe('coach');
    expect(api.requests).toHaveLength(1);
  });

  it('sends a trainee account without coach sign-up details to gym onboarding, setting nothing up (CF02)', async () => {
    const { client } = fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) });
    const api = fakeApi([
      { status: 200, body: me(['personal'], null) },
      { status: 200, body: onboarding('none') },
    ]);
    const state = await ensureAccount(deps(client, api.fetchImpl));
    expect(state).toMatchObject({ kind: 'onboarding', email: 'coach@example.test', status: { status: 'none' } });
    expect(api.requests.map((request) => request.method)).toEqual(['GET', 'GET']);
  });

  it('keeps "coaching is off" for a sign-in with no FitSphere account and no sign-up details', async () => {
    const { client } = fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) });
    const api = fakeApi([{ status: 403, body: errorBody('ACCOUNT_SETUP_REQUIRED') }]);
    expect(await ensureAccount(deps(client, api.fetchImpl))).toMatchObject({ kind: 'coachingOff', me: null });
  });

  it('shows the state the server gives for a pending request, and offline or unavailable when it cannot', async () => {
    const signedIn = fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) });
    const pending = fakeApi([
      { status: 200, body: me(['personal'], null) },
      { status: 200, body: onboarding('pending') },
    ]);
    expect(await ensureAccount(deps(signedIn.client, pending.fetchImpl))).toMatchObject({ kind: 'onboarding', status: { status: 'pending', triesLeft: 5 } });

    const broken = fakeApi([
      { status: 200, body: me(['personal'], null) },
      { status: 500, body: errorBody('INTERNAL_ERROR') },
    ]);
    expect((await ensureAccount(deps(signedIn.client, broken.fetchImpl))).kind).toBe('unavailable');
  });

  it('reports an unverified email', async () => {
    const { client } = fakeClient({ getSession: async () => ({ data: { session: session(coachMetadata) }, error: null }) });
    const api = fakeApi([
      { status: 403, body: errorBody('ACCOUNT_SETUP_REQUIRED') },
      { status: 403, body: errorBody('EMAIL_NOT_VERIFIED') },
    ]);
    expect((await ensureAccount(deps(client, api.fetchImpl))).kind).toBe('emailNotVerified');
  });

  it('refreshes a refused token once, then signs out', async () => {
    const { client, calls } = fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) });
    const api = fakeApi([{ status: 401, body: errorBody('AUTH_REQUIRED') }]);
    expect((await ensureAccount(deps(client, api.fetchImpl))).kind).toBe('signedOut');
    expect(calls.map((call) => call.method)).toEqual(['refreshSession', 'signOut']);
  });
});

describe('passwords (CAUTH-003, CAUTH-004)', () => {
  it('reset requests use the coach app link and the same answer for every email', async () => {
    const { client, calls } = fakeClient({ resetPasswordForEmail: async (...args) => {
      calls.push({ method: 'reset', args });
      return { error: { status: 400 } };
    } });
    expect(await requestPasswordReset(deps(client), ' A@B.co ')).toBe('sent');
    expect(calls[0]?.args).toEqual(['a@b.co', { redirectTo: 'fitspherecoach://reset-password' }]);
  });

  it('a new password signs out the other devices', async () => {
    const { client, calls } = fakeClient();
    expect(await setNewPassword(deps(client), 'irongym2027')).toBe('changed');
    expect(calls.map((call) => call.method)).toEqual(['updateUser', 'signOut']);
    expect(calls[1]?.args[0]).toEqual({ scope: 'others' });
  });

  it('change password checks the current one first', async () => {
    const wrong = fakeClient({ signInWithPassword: async () => ({ data: { session: null }, error: { status: 400 } }) });
    expect(await changePassword(deps(wrong.client), 'a@b.co', 'bad', 'irongym2027')).toBe('wrongPassword');
    const same = fakeClient({ updateUser: async () => ({ error: { status: 422, code: 'same_password' } }) });
    expect(await changePassword(deps(same.client), 'a@b.co', 'irongym2026', 'irongym2026')).toBe('samePassword');
  });
});
