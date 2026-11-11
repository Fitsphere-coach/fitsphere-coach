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
  'NOT_PERMITTED',
  'ALREADY_HEAD_COACH',
  'ALREADY_COACH',
  'REQUEST_LIMIT_REACHED',
  'APPROVAL_EMAIL_FAILED',
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

// --- Gym onboarding (CF02, coach-scope §4, ADR-0004) ---

export const GYM_NAME_MAX = 100;
export const GYM_ADDRESS_MAX = 200;
export const GYM_CITY_MAX = 60;
export const GYM_TRAINEES_MAX = 100_000;

const trimmed = (min: number, max: number) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(min).max(max));

/** An Indian mobile or landline number: digits, with an optional +91 or 0 in front. */
export const ownerPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+91|0)?[0-9]{10}$/))
  .transform((value) => `+91${value.slice(-10)}`);

/** POST /v1/gym/onboarding/requests: the gym form. More fields arrive later (coach-scope Q6). */
export const gymRequestSchema = z.strictObject({
  gymName: trimmed(2, GYM_NAME_MAX),
  address: trimmed(2, GYM_ADDRESS_MAX),
  city: trimmed(2, GYM_CITY_MAX),
  pincode: z.string().regex(/^[0-9]{6}$/),
  ownerPhone: ownerPhoneSchema,
  totalTrainees: z.number().int().min(1).max(GYM_TRAINEES_MAX),
  /** Optional: a link FitSphere can use to check the gym. Kept in the open extra fields. */
  websiteOrInstagram: trimmed(0, 200).optional(),
});
export type GymRequest = z.input<typeof gymRequestSchema>;
/** The form after trimming and phone clean-up: what the server stores. */
export type GymRequestParsed = z.output<typeof gymRequestSchema>;

/** The approval code: digits only. The server also checks the length it is set to. */
export const approvalCodeSchema = z.strictObject({ code: z.string().regex(/^[0-9]{4,8}$/) });

/**
 * Where a person without a Coach or Head Coach role is in gym onboarding (coach-scope §4.2a):
 * `none` and `expired` and `locked` go to the gym form (or a message first), `pending` goes to
 * "Enter your approval code", `approved` goes into the app.
 */
export const ONBOARDING_STATUSES = ['none', 'pending', 'expired', 'locked', 'approved'] as const;

export const onboardingStatusSchema = z.object({
  status: z.enum(ONBOARDING_STATUSES),
  /** Of the pending request; null otherwise. */
  expiresAt: instantSchema.nullable(),
  /** Wrong codes left on the pending request; null otherwise. */
  triesLeft: z.number().int().nullable(),
  /** Gym requests the person may still send today (India date). */
  requestsLeftToday: z.number().int(),
  /** How many digits the approval code has (a server setting, 4 to 8). */
  codeLength: z.number().int(),
  gymName: z.string().nullable(),
});
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;

/** POST /v1/gym/onboarding/code: what happened to the code (wrong codes are answers, not errors). */
export const CODE_RESULTS = ['approved', 'wrong', 'locked', 'expired', 'none'] as const;
export const codeResultSchema = z.object({
  result: z.enum(CODE_RESULTS),
  triesLeft: z.number().int().nullable(),
  gymName: z.string().nullable(),
});
export type CodeResult = z.infer<typeof codeResultSchema>;

// --- Client management (CF04, SPEC-001 → coach-scope §3.4) ---
// "Client" is the coach-app word for a trainee linked to a Coach or the Head Coach.

export const clientSummarySchema = z.object({
  /** The trainee's account id. */
  id: idSchema,
  /** The trainee's name when the FitSphere app holds one (TCR-001); until then, their email. */
  name: z.string(),
  coachId: idSchema,
  /** The coach's name; null if that coach has not set a name. */
  coachName: z.string().nullable(),
  startedAt: instantSchema,
  lastLoggedAt: instantSchema.nullable(),
});
export type ClientSummary = z.infer<typeof clientSummarySchema>;

export const clientListResponseSchema = z.object({
  clients: z.array(clientSummarySchema),
  /** The gym's coaches the viewer may filter or move by: the Head Coach sees them, a Coach sees none. */
  coaches: z.array(z.object({ id: idSchema, name: z.string().nullable() })),
});
export type ClientListResponse = z.infer<typeof clientListResponseSchema>;

export const clientProfileSchema = clientSummarySchema.extend({
  /** Latest weigh-in in kilograms (stored in grams); null with none. */
  latestWeightKg: z.number().nullable(),
  targets: z.object({
    calories: z.number().int().nullable(),
    proteinG: z.number().int().nullable(),
    weeklyWorkouts: z.number().int().nullable(),
  }),
  /** Workouts logged this India week (Monday to Sunday). */
  workoutsThisWeek: z.number().int(),
});
export type ClientProfile = z.infer<typeof clientProfileSchema>;

/** POST /v1/clients/{id}/move: the Head Coach moves a client to a coach of the gym, or to themselves. */
export const moveClientRequestSchema = z.strictObject({ coachId: idSchema });
export type MoveClientRequest = z.infer<typeof moveClientRequestSchema>;

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
