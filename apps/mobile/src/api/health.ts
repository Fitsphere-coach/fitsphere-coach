// Checks that the phone can reach the coach API (CF00). Real calls with a token come in CF01.
import { API_BASE_PATH, healthResponseSchema } from '@fitsphere-coach/shared';

export type ApiStatus = 'not-configured' | 'reachable' | 'unreachable';

export async function checkApi(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<ApiStatus> {
  if (!apiUrl) return 'not-configured';
  try {
    const response = await fetchImpl(`${apiUrl}${API_BASE_PATH}/health`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return 'unreachable';
    return healthResponseSchema.safeParse(await response.json()).success ? 'reachable' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
