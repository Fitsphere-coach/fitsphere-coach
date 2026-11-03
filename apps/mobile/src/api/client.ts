import { API_BASE_PATH, errorBodySchema } from '@fitsphere-coach/shared';

// Calls the FitSphere API (same conventions as the trainee API). The app decides from the error code, never the
// message (same error model as the trainee API).

export type ApiResult<T> =
  | { kind: 'ok'; status: number; body: T }
  | { kind: 'error'; status: number; code: string | null }
  | { kind: 'offline' };

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string;
  body?: unknown;
  fetchImpl?: typeof fetch;
};

const TIMEOUT_MS = 15_000;

export async function callApi<T>(apiUrl: string | undefined, path: string, options: Options = {}): Promise<ApiResult<T>> {
  if (!apiUrl) return { kind: 'offline' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${apiUrl}${API_BASE_PATH}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });
    const json: unknown = await response.json().catch(() => null);
    if (response.ok) return { kind: 'ok', status: response.status, body: json as T };
    const parsed = errorBodySchema.safeParse(json);
    return { kind: 'error', status: response.status, code: parsed.success ? parsed.data.error.code : null };
  } catch {
    return { kind: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
