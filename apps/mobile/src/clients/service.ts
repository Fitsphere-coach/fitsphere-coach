// Client management calls (CF04). The server decides who sees whom and who may move or remove;
// the app shows what it answers, and decides from the error code, never the message.
import type { ClientListResponse, ClientProfile } from '@fitsphere-coach/shared';
import { callApi } from '../api/client';
import { options, type AuthDeps } from '../auth/service';

export type Loaded<T> = { kind: 'ok'; body: T } | { kind: 'offline' | 'unavailable' | 'signedOut' | 'notFound' };

async function authed<T>(deps: AuthDeps, path: string, extra: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<Loaded<T> | { kind: 'done' } | { kind: 'refused' }> {
  const session = (await deps.client.getSession()).data.session;
  if (!session) return { kind: 'signedOut' };
  const response = await callApi<T>(deps.apiUrl, path, { ...options(deps, session), ...extra });
  if (response.kind === 'offline') return { kind: 'offline' };
  if (response.kind === 'ok') return response.status === 204 ? { kind: 'done' } : { kind: 'ok', body: response.body };
  if (response.status === 404) return { kind: 'notFound' };
  if (response.status === 403 || response.status === 400) return { kind: 'refused' };
  return { kind: 'unavailable' };
}

export async function loadClients(deps: AuthDeps, filter: { q?: string; coachId?: string } = {}): Promise<Loaded<ClientListResponse>> {
  const params = new URLSearchParams();
  if (filter.q?.trim()) params.set('q', filter.q.trim());
  if (filter.coachId) params.set('coachId', filter.coachId);
  const query = params.toString();
  const result = await authed<ClientListResponse>(deps, `/clients${query ? `?${query}` : ''}`);
  return result.kind === 'done' || result.kind === 'refused' ? { kind: 'unavailable' } : result;
}

export async function loadClientProfile(deps: AuthDeps, id: string): Promise<Loaded<ClientProfile>> {
  const result = await authed<ClientProfile>(deps, `/clients/${encodeURIComponent(id)}`);
  return result.kind === 'done' || result.kind === 'refused' ? { kind: 'unavailable' } : result;
}

export type ChangeResult = 'done' | 'refused' | 'notFound' | 'offline' | 'unavailable' | 'signedOut';

export async function moveClient(deps: AuthDeps, id: string, coachId: string): Promise<ChangeResult> {
  const result = await authed(deps, `/clients/${encodeURIComponent(id)}/move`, { method: 'POST', body: { coachId } });
  return result.kind === 'ok' ? 'done' : result.kind;
}

export async function removeClient(deps: AuthDeps, id: string): Promise<ChangeResult> {
  const result = await authed(deps, `/clients/${encodeURIComponent(id)}/remove`, { method: 'POST', body: {} });
  return result.kind === 'ok' ? 'done' : result.kind;
}

export type InviteResult = 'sent' | 'alreadyAdded' | 'cannotInvite' | 'limit' | 'emailFailed' | 'invalid' | 'refused' | 'offline' | 'unavailable' | 'signedOut';

/** Invites a trainee by email. The server decides everything; the same answer whether or not the email has an account. */
export async function inviteClient(deps: AuthDeps, email: string, coachId?: string): Promise<InviteResult> {
  const session = (await deps.client.getSession()).data.session;
  if (!session) return 'signedOut';
  const response = await callApi(deps.apiUrl, '/clients/invitations', {
    ...options(deps, session),
    method: 'POST',
    body: { email, ...(coachId ? { coachId } : {}) },
  });
  if (response.kind === 'ok') return 'sent';
  if (response.kind === 'offline') return 'offline';
  switch (response.code) {
    case 'ALREADY_ADDED':
      return 'alreadyAdded';
    case 'CANNOT_INVITE_EMAIL':
      return 'cannotInvite';
    case 'INVITE_LIMIT_REACHED':
      return 'limit';
    case 'INVITE_EMAIL_FAILED':
      return 'emailFailed';
    case 'VALIDATION_FAILED':
      return 'invalid';
    case 'NOT_PERMITTED':
    case 'NOT_FOUND':
      return 'refused';
    default:
      return 'unavailable';
  }
}

export async function cancelInvitation(deps: AuthDeps, id: string): Promise<ChangeResult> {
  const result = await authed(deps, `/clients/invitations/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} });
  return result.kind === 'ok' ? 'done' : result.kind;
}
