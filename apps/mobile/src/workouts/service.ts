// Workout management calls (CF06). The server decides who sees and changes what; the app shows what
// it answers and decides from the error code, never the message.
import type {
  PlanDetail,
  PlanHistoryResponse,
  PlanListResponse,
  PlanSummary,
  TemplateDetail,
  TemplateRequest,
  TemplateSummary,
  UpdatePlanRequest,
} from '@fitsphere-coach/shared';
import { callApi } from '../api/client';
import { options, type AuthDeps } from '../auth/service';

export type Failure = 'offline' | 'unavailable' | 'signedOut' | 'notFound' | 'refused' | 'invalid' | 'draftExists' | 'notReady';
export type Result<T> = { kind: 'ok'; body: T } | { kind: Failure };

export async function call<T>(deps: AuthDeps, path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: unknown): Promise<Result<T>> {
  const session = (await deps.client.getSession()).data.session;
  if (!session) return { kind: 'signedOut' };
  const response = await callApi<T>(deps.apiUrl, path, { ...options(deps, session), method, ...(body === undefined ? {} : { body }) });
  if (response.kind === 'offline') return { kind: 'offline' };
  if (response.kind === 'ok') return { kind: 'ok', body: response.body };
  switch (response.code) {
    case 'NOT_FOUND':
      return { kind: 'notFound' };
    case 'NOT_PERMITTED':
    case 'ROLE_NOT_ENABLED':
      return { kind: 'refused' };
    case 'VALIDATION_FAILED':
      return { kind: 'invalid' };
    case 'PLAN_DRAFT_EXISTS':
      return { kind: 'draftExists' };
    case 'PLAN_NOT_READY':
      return { kind: 'notReady' };
    default:
      return { kind: 'unavailable' };
  }
}

const enc = encodeURIComponent;

export async function loadTemplates(
  deps: AuthDeps,
  filter: { q?: string; goal?: string; includeInactive?: boolean } = {},
): Promise<Result<TemplateSummary[]>> {
  const params = new URLSearchParams();
  if (filter.q?.trim()) params.set('q', filter.q.trim());
  if (filter.goal) params.set('goal', filter.goal);
  if (filter.includeInactive) params.set('includeInactive', 'true');
  const query = params.toString();
  const result = await call<{ templates: TemplateSummary[] }>(deps, `/workout-templates${query ? `?${query}` : ''}`);
  return result.kind === 'ok' ? { kind: 'ok', body: result.body.templates } : result;
}

export async function loadTemplate(deps: AuthDeps, id: string): Promise<Result<TemplateDetail>> {
  const result = await call<{ template: TemplateDetail }>(deps, `/workout-templates/${enc(id)}`);
  return result.kind === 'ok' ? { kind: 'ok', body: result.body.template } : result;
}

/** Creates a template, or edits one when `id` is given. */
export async function saveTemplate(deps: AuthDeps, request: TemplateRequest, id?: string): Promise<Result<TemplateDetail>> {
  const result = id
    ? await call<{ template: TemplateDetail }>(deps, `/workout-templates/${enc(id)}`, 'PUT', request)
    : await call<{ template: TemplateDetail }>(deps, '/workout-templates', 'POST', request);
  return result.kind === 'ok' ? { kind: 'ok', body: result.body.template } : result;
}

export async function copyTemplate(deps: AuthDeps, id: string): Promise<Result<TemplateDetail>> {
  const result = await call<{ template: TemplateDetail }>(deps, `/workout-templates/${enc(id)}/copy`, 'POST', {});
  return result.kind === 'ok' ? { kind: 'ok', body: result.body.template } : result;
}

export async function setTemplateActive(deps: AuthDeps, id: string, active: boolean): Promise<Result<null>> {
  const result = await call<unknown>(deps, `/workout-templates/${enc(id)}/${active ? 'activate' : 'deactivate'}`, 'POST', {});
  return result.kind === 'ok' ? { kind: 'ok', body: null } : result;
}

export async function loadPlans(deps: AuthDeps, filter: { q?: string; status?: string; coachId?: string } = {}): Promise<Result<PlanListResponse>> {
  const params = new URLSearchParams();
  if (filter.q?.trim()) params.set('q', filter.q.trim());
  if (filter.status) params.set('status', filter.status);
  if (filter.coachId) params.set('coachId', filter.coachId);
  const query = params.toString();
  return call<PlanListResponse>(deps, `/training-plans${query ? `?${query}` : ''}`);
}

export async function loadPlan(deps: AuthDeps, id: string): Promise<Result<PlanDetail>> {
  const result = await call<{ plan: PlanDetail }>(deps, `/training-plans/${enc(id)}`);
  return result.kind === 'ok' ? { kind: 'ok', body: result.body.plan } : result;
}

export async function assignPlans(deps: AuthDeps, templateId: string, traineeIds: string[], startDate: string): Promise<Result<PlanSummary[]>> {
  const result = await call<{ plans: PlanSummary[] }>(deps, '/training-plans', 'POST', { templateId, traineeIds, startDate });
  return result.kind === 'ok' ? { kind: 'ok', body: result.body.plans } : result;
}

export async function savePlan(deps: AuthDeps, id: string, request: UpdatePlanRequest): Promise<Result<PlanDetail>> {
  const result = await call<{ plan: PlanDetail }>(deps, `/training-plans/${enc(id)}`, 'PUT', request);
  return result.kind === 'ok' ? { kind: 'ok', body: result.body.plan } : result;
}

async function action(deps: AuthDeps, id: string, name: 'publish' | 'end' | 'discard'): Promise<Result<null>> {
  const result = await call<unknown>(deps, `/training-plans/${enc(id)}/${name}`, 'POST', {});
  return result.kind === 'ok' ? { kind: 'ok', body: null } : result;
}
export const publishPlan = (deps: AuthDeps, id: string) => action(deps, id, 'publish');
export const endPlan = (deps: AuthDeps, id: string) => action(deps, id, 'end');
export const discardPlan = (deps: AuthDeps, id: string) => action(deps, id, 'discard');

export async function restorePlan(deps: AuthDeps, id: string, version: number): Promise<Result<PlanDetail>> {
  const result = await call<{ plan: PlanDetail }>(deps, `/training-plans/${enc(id)}/restore`, 'POST', { version });
  return result.kind === 'ok' ? { kind: 'ok', body: result.body.plan } : result;
}

export const loadHistory = (deps: AuthDeps, id: string): Promise<Result<PlanHistoryResponse>> => call<PlanHistoryResponse>(deps, `/training-plans/${enc(id)}/history`);
