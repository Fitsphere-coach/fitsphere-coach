// Schemas shared by the coach app and the coach API. They match the trainee app's contracts
// (fitsphere/packages/shared/src/contracts.ts) wherever both apps see the same data, so one
// account looks the same from either API.
// Request schemas are strict: unknown fields are refused. Response schemas accept added fields.
import { z } from 'zod';

/** Every API route starts with this path. */
export const API_BASE_PATH = '/v1';

// --- Error codes (same codes and shape as the trainee API's error model) ---

export const REQUEST_ERROR_CODES = [
  'VALIDATION_FAILED',
  'AGE_CONFIRMATION_REQUIRED',
  'AUTH_REQUIRED',
  'ACCOUNT_SETUP_REQUIRED',
  'EMAIL_NOT_VERIFIED',
  'ROLE_NOT_ENABLED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;
export type RequestErrorCode = (typeof REQUEST_ERROR_CODES)[number];

export const VALIDATION_ISSUES = [
  'required',
  'invalid_format',
  'out_of_range',
  'unknown_field',
  'too_many',
] as const;
export type ValidationIssue = (typeof VALIDATION_ISSUES)[number];

export const idSchema = z.uuid();
/** ISO 8601 in UTC with `Z`. */
export const instantSchema = z.iso.datetime();

export const validationDetailSchema = z.strictObject({
  field: z.string(),
  issue: z.enum(VALIDATION_ISSUES),
});
export type ValidationDetail = z.infer<typeof validationDetailSchema>;

export const errorBodySchema = z.object({
  error: z.object({
    code: z.enum(REQUEST_ERROR_CODES),
    message: z.string(),
    retryable: z.boolean(),
    requestId: z.string(),
    details: z.array(validationDetailSchema).nullable(),
  }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

// --- Health ---

export const healthResponseSchema = z.object({ status: z.literal('ok'), service: z.literal('coach-api') });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

// --- Account: GET /v1/me ---

/** The same roles as the trainee app (app.user_roles). */
export const ROLES = ['personal', 'coach', 'head_coach'] as const;
export type Role = (typeof ROLES)[number];
export const COACH_ROLES = ['coach', 'head_coach'] as const satisfies readonly Role[];

/**
 * Version of the "I am 18 or older" text. The coach app shows the trainee app's exact text, so it
 * records the trainee app's version (fitsphere/packages/shared: AGE_CONFIRMATION_TEXT_VERSION).
 */
export const AGE_CONFIRMATION_TEXT_VERSION = '2026-10-27';
/** Version of the Terms, Privacy Policy and Coach data terms accepted at coach sign-up. */
export const COACH_TERMS_VERSION = '2026-11-03';

export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 60;
export const fullNameSchema = z
  .string()
  .transform((name) => name.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(FULL_NAME_MIN).max(FULL_NAME_MAX));

/** POST /v1/me: set up the signed-in user's account for the coach app (CAUTH-006). */
export const meSetupRequestSchema = z.strictObject({
  ageConfirmed: z.boolean(),
  ageConfirmationTextVersion: z.string().min(1).max(32),
  fullName: fullNameSchema,
  coachTermsVersion: z.string().min(1).max(32),
});
export type MeSetupRequest = z.input<typeof meSetupRequestSchema>;

export const meResponseSchema = z.object({
  user: z.object({ id: idSchema, email: z.string(), createdAt: instantSchema }),
  roles: z.array(z.enum(ROLES)),
  /** Null until the account has been set up in the coach app (name and coach terms). */
  coach: z.object({ fullName: z.string() }).nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** Whether an account can use the coach app (it has switched on Coach or Head Coach). */
export function isCoachAccount(roles: readonly Role[]): boolean {
  return roles.some((role) => (COACH_ROLES as readonly Role[]).includes(role));
}

// --- Validation details from a Zod error (same rules as the trainee API) ---

export function validationDetails(error: z.ZodError, input: unknown): ValidationDetail[] {
  return error.issues.flatMap((issue): ValidationDetail[] => {
    const field = formatPath(issue.path);
    switch (issue.code) {
      case 'unrecognized_keys':
        return issue.keys.map((key) => ({ field: formatPath([...issue.path, key]), issue: 'unknown_field' }));
      case 'invalid_type':
        return [{ field, issue: isMissing(input, issue.path) ? 'required' : 'invalid_format' }];
      case 'too_big':
        return [{ field, issue: issue.origin === 'array' ? 'too_many' : 'out_of_range' }];
      case 'too_small':
        return [{ field, issue: 'out_of_range' }];
      default:
        return [{ field, issue: 'invalid_format' }];
    }
  });
}

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) => (typeof key === 'number' ? `[${key}]` : `${index === 0 ? '' : '.'}${String(key)}`))
    .join('');
}

function isMissing(input: unknown, path: readonly PropertyKey[]): boolean {
  let current = input;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) return true;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current === undefined || current === null;
}
