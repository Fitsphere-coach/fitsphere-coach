// Gym onboarding calls (CF02): send the gym form, enter the approval code. The server decides
// everything (who may send a request, whether a code is right, when it locks); the app only shows
// what the server answers, from the error code and never the message.
import type { CodeResult, GymRequest } from '@fitsphere-coach/shared';
import { callApi } from '../api/client';
import { options, type AuthDeps } from '../auth/service';

export type SendRequestResult = 'sent' | 'emailFailed' | 'limit' | 'alreadyHeadCoach' | 'alreadyCoach' | 'invalid' | 'offline' | 'unavailable' | 'signedOut';

/** Sends the gym form. The code goes to FitSphere's inbox, never to this phone. */
export async function sendGymRequest(deps: AuthDeps, form: GymRequest): Promise<SendRequestResult> {
  const session = (await deps.client.getSession()).data.session;
  if (!session) return 'signedOut';
  const response = await callApi(deps.apiUrl, '/gym/onboarding/requests', { ...options(deps, session), method: 'POST', body: form });
  if (response.kind === 'ok') return 'sent';
  if (response.kind === 'offline') return 'offline';
  switch (response.code) {
    case 'APPROVAL_EMAIL_FAILED':
      return 'emailFailed';
    case 'REQUEST_LIMIT_REACHED':
      return 'limit';
    case 'ALREADY_HEAD_COACH':
      return 'alreadyHeadCoach';
    case 'ALREADY_COACH':
      return 'alreadyCoach';
    case 'VALIDATION_FAILED':
      return 'invalid';
    default:
      return 'unavailable';
  }
}

export type EnterCodeResult =
  | { kind: 'answer'; answer: CodeResult }
  | { kind: 'invalid' | 'alreadyHeadCoach' | 'alreadyCoach' | 'offline' | 'unavailable' | 'signedOut' };

/** Enters the code FitSphere gave the gym owner. A wrong code is an answer, not an error. */
export async function enterApprovalCode(deps: AuthDeps, code: string): Promise<EnterCodeResult> {
  const session = (await deps.client.getSession()).data.session;
  if (!session) return { kind: 'signedOut' };
  const response = await callApi<CodeResult>(deps.apiUrl, '/gym/onboarding/code', { ...options(deps, session), method: 'POST', body: { code } });
  if (response.kind === 'ok') return { kind: 'answer', answer: response.body };
  if (response.kind === 'offline') return { kind: 'offline' };
  switch (response.code) {
    case 'VALIDATION_FAILED':
      return { kind: 'invalid' };
    case 'ALREADY_HEAD_COACH':
      return { kind: 'alreadyHeadCoach' };
    case 'ALREADY_COACH':
      return { kind: 'alreadyCoach' };
    default:
      return { kind: 'unavailable' };
  }
}
