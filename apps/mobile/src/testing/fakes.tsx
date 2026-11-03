// Test doubles: a fake Supabase auth client and a fake coach API, plus a wrapper with the app's
// providers. Synthetic data only.
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountProvider } from '../account/AccountProvider';
import { AuthProvider } from '../auth/AuthProvider';
import type { AuthClient, AuthDeps, MinimalSession } from '../auth/service';
import { ThemeProvider } from '../theme';

type ErrorLike = { name?: string; code?: string; status?: number } | null;

export function session(metadata: Record<string, unknown> = {}, token = 'token-1'): MinimalSession {
  return { access_token: token, user: { id: 'user-1', email: 'coach@example.test', user_metadata: metadata } };
}

export function fakeClient(overrides: Partial<AuthClient> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const record =
    <T,>(method: string, result: T) =>
    async (...args: unknown[]) => {
      calls.push({ method, args });
      return result;
    };
  const ok = { error: null as ErrorLike };
  const client: AuthClient = {
    signUp: record('signUp', ok),
    resend: record('resend', ok),
    signInWithPassword: record('signInWithPassword', { data: { session: session() }, error: null }),
    signOut: record('signOut', ok),
    getSession: record('getSession', { data: { session: null }, error: null }),
    refreshSession: record('refreshSession', { data: { session: null }, error: null }),
    updateUser: record('updateUser', ok),
    resetPasswordForEmail: record('resetPasswordForEmail', ok),
    exchangeCodeForSession: record('exchangeCodeForSession', { data: { session: session() }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    ...overrides,
  };
  return { client, calls };
}

/** Answers coach API calls from a list of responses, in order, and records the requests. */
export function fakeApi(responses: { status: number; body: unknown }[]) {
  const requests: { url: string; method: string; body: unknown; auth: string | null }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    requests.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init?.headers).get('authorization'),
    });
    const next = responses.shift() ?? { status: 500, body: null };
    return Response.json(next.body, { status: next.status });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

export function errorBody(code: string) {
  return { error: { code, message: 'x', retryable: false, requestId: 'r', details: null } };
}

export function deps(client: AuthClient, fetchImpl?: typeof fetch): AuthDeps {
  return {
    client,
    apiUrl: 'http://api.test',
    links: { verified: 'fitspherecoach://verified', resetPassword: 'fitspherecoach://reset-password' },
    ...(fetchImpl ? { fetchImpl } : {}),
  };
}

export function Providers({ authDeps, children }: { authDeps: AuthDeps; children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <AuthProvider deps={authDeps}>
          <AccountProvider>{children}</AccountProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
