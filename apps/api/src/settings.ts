// Settings from environment variables (ADR-0008, C-D17). Checked once at start: a missing or
// out-of-range value stops the server with a message that names the variable and never shows its
// value (generic code practices DC-5, SE-1). `apps/api/.env.example` lists every variable with its
// starting value and allowed range.

export type Settings = {
  approvalInbox: string;
  senderEmail: string;
  senderDisplayName: string;
  approvalCodeLength: number;
  gymRequestValidDays: number;
  approvalWrongTries: number;
  gymRequestsPerDay: number;
  /** Trainee invitations (CF04, TCR-001): how long one stays valid, how many a person may send a day. */
  traineeInviteValidDays: number;
  invitesPerDay: number;
  /** Off until Developer 1 has built TCR-001 (C-D22); the invite routes answer not found while off. */
  traineeInvitesEnabled: boolean;
  /** Secrets (ADR-0004, ADR-0005). Never logged, never returned. */
  approvalCodeSecret: string;
  smtpAppPassword: string;
};

export class SettingsError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Settings are not valid:\n- ${problems.join('\n- ')}`);
    this.name = 'SettingsError';
    this.problems = problems;
  }
}

type Env = Record<string, string | undefined>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Shortest approval-code secret: 32 characters (for example 16 random bytes in hex). */
export const SECRET_MIN_LENGTH = 32;

export function loadSettings(env: Env): Settings {
  const problems: string[] = [];

  const text = (name: string, check: (value: string) => boolean, rule: string): string => {
    const value = env[name]?.trim();
    if (!value) {
      problems.push(`${name} is missing`);
      return '';
    }
    if (!check(value)) problems.push(`${name} is not valid (${rule})`);
    return value;
  };

  const whole = (name: string, min: number, max: number): number => {
    const value = env[name]?.trim();
    if (!value) {
      problems.push(`${name} is missing`);
      return min;
    }
    const number = /^[0-9]+$/.test(value) ? Number(value) : Number.NaN;
    if (!(number >= min && number <= max)) problems.push(`${name} must be a whole number from ${min} to ${max}`);
    return number;
  };

  const flag = (name: string): boolean => {
    const value = env[name]?.trim().toLowerCase();
    if (!value) {
      problems.push(`${name} is missing`);
      return false;
    }
    if (value !== 'true' && value !== 'false') {
      problems.push(`${name} must be true or false`);
      return false;
    }
    return value === 'true';
  };

  const secret = (name: string, minLength: number): string => {
    const value = env[name];
    if (!value) {
      problems.push(`${name} is missing`);
      return '';
    }
    if (value.length < minLength) problems.push(`${name} must be at least ${minLength} characters`);
    return value;
  };

  const settings: Settings = {
    approvalInbox: text('APPROVAL_INBOX', (value) => EMAIL.test(value), 'an email address'),
    senderEmail: text('SENDER_EMAIL', (value) => EMAIL.test(value), 'an email address'),
    senderDisplayName: text('SENDER_DISPLAY_NAME', (value) => value.length <= 50, '1 to 50 characters'),
    approvalCodeLength: whole('APPROVAL_CODE_LENGTH', 4, 8),
    gymRequestValidDays: whole('GYM_REQUEST_VALID_DAYS', 1, 30),
    approvalWrongTries: whole('APPROVAL_WRONG_TRIES', 1, 10),
    gymRequestsPerDay: whole('GYM_REQUESTS_PER_DAY', 1, 10),
    traineeInviteValidDays: whole('TRAINEE_INVITE_VALID_DAYS', 1, 30),
    invitesPerDay: whole('INVITES_PER_DAY', 1, 100),
    traineeInvitesEnabled: flag('TRAINEE_INVITES_ENABLED'),
    approvalCodeSecret: secret('APPROVAL_CODE_SECRET', SECRET_MIN_LENGTH),
    smtpAppPassword: secret('SMTP_APP_PASSWORD', 1),
  };

  if (problems.length > 0) throw new SettingsError(problems);
  return settings;
}
