// The error model (same codes and shape as the trainee API's error model): one error shape, fixed codes, and messages that
// never hold values, health data, email addresses, tokens or internals.
import type { ErrorBody, RequestErrorCode, ValidationDetail } from '@fitsphere-coach/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

const ERRORS: Record<RequestErrorCode, { status: number; message: string; retryable: boolean }> = {
  VALIDATION_FAILED: { status: 400, message: 'Some fields are not valid.', retryable: false },
  AGE_CONFIRMATION_REQUIRED: {
    status: 400,
    message: 'Confirm that you are 18 or older.',
    retryable: false,
  },
  AUTH_REQUIRED: { status: 401, message: 'Sign in again.', retryable: false },
  ACCOUNT_SETUP_REQUIRED: {
    status: 403,
    message: 'Finish setting up your account.',
    retryable: false,
  },
  EMAIL_NOT_VERIFIED: { status: 403, message: 'Verify your email first.', retryable: false },
  ROLE_NOT_ENABLED: {
    status: 403,
    message: 'This needs the Coach or Head Coach role.',
    retryable: false,
  },
  NOT_FOUND: { status: 404, message: 'Not available.', retryable: false },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'The request is too large.', retryable: false },
  RATE_LIMITED: { status: 429, message: 'Too many requests. Try again later.', retryable: true },
  ALREADY_HEAD_COACH: { status: 409, message: 'This email is already registered as a Head Coach.', retryable: false },
  ALREADY_COACH: { status: 409, message: 'This email is already registered as a Coach.', retryable: false },
  REQUEST_LIMIT_REACHED: {
    status: 429,
    message: "You have sent the most requests allowed today. Try again tomorrow.",
    retryable: false,
  },
  APPROVAL_EMAIL_FAILED: {
    status: 503,
    message: "Couldn't send your request. Try again.",
    retryable: true,
  },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong.', retryable: true },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: 'The service is unavailable. Try again later.',
    retryable: true,
  },
};

export class ApiError extends Error {
  readonly code: RequestErrorCode;
  readonly details: ValidationDetail[] | null;

  constructor(code: RequestErrorCode, details: ValidationDetail[] | null = null) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export function errorStatus(code: RequestErrorCode): number {
  return ERRORS[code].status;
}

export function errorBody(code: RequestErrorCode, requestId: string, details: ValidationDetail[] | null = null): ErrorBody {
  const { message, retryable } = ERRORS[code];
  return { error: { code, message, retryable, requestId, details } };
}

// Network failures and server states that mean the database cannot be reached right now, e.g.
// the Supabase project is paused.
const DATABASE_UNAVAILABLE = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  '08001',
  '08004',
  '08006',
  '53300',
  '57P01',
  '57P03',
]);

function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && DATABASE_UNAVAILABLE.has(code)) return true;
  // node-postgres reports pool and connection timeouts without a code.
  return /timeout exceeded when trying to connect|Connection terminated/i.test(error.message);
}

/** What may be logged about an unexpected error: its kind and where it happened, never its
 * message or detail, which can hold submitted values (invariant #7). */
export function loggableError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { errorName: typeof error };
  const code = (error as { code?: unknown }).code;
  return {
    errorName: error.name,
    errorCode: typeof code === 'string' ? code : null,
    stack: error.stack?.split('\n').slice(1).join('\n') ?? null,
  };
}

export function handleError(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  let code: RequestErrorCode;
  let details: ValidationDetail[] | null = null;
  if (error instanceof ApiError) {
    code = error.code;
    details = error.details;
  } else if ('statusCode' in error && error.statusCode === 413) {
    code = 'PAYLOAD_TOO_LARGE';
  } else if ('statusCode' in error && (error.statusCode === 400 || error.statusCode === 415)) {
    // Fastify's body parsing: not JSON, an empty JSON body, or another content type.
    code = 'VALIDATION_FAILED';
  } else if (isDatabaseUnavailable(error)) {
    code = 'SERVICE_UNAVAILABLE';
    request.log.error(loggableError(error), 'database unavailable');
  } else {
    code = 'INTERNAL_ERROR';
    request.log.error(loggableError(error), 'unexpected error');
  }
  if (code === 'AUTH_REQUIRED') void reply.header('WWW-Authenticate', 'Bearer');
  return reply.status(errorStatus(code)).send(errorBody(code, request.id, details));
}
