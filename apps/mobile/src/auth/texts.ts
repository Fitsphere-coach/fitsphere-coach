// Texts and rules for sign-in (CF01-coach-auth-ui.md). They come from the app, never from
// Supabase, so they cannot reveal whether an address is registered (invariant 3).
export const TEXTS = {
  signInFailed: 'Email or password is incorrect. Check both and try again.',
  locked: 'Too many attempts. Try again in 5 minutes, or reset your password.',
  sessionExpired: 'You were signed out. Log in to pick up where you left off.',
  offline: "Couldn't reach FitSphere. Check your connection and try again.",
  tryLater: 'Something went wrong. Try again later.',
  ageConfirmation: 'I am 18 or older',
  ageHint: 'Tick "I am 18 or older" to continue.',
  nameHint: 'Trainees see this name on plans and targets you set.',
  nameRule: 'Enter your name (2 to 60 characters).',
  emailRule: 'Enter your email address.',
  emailFormat: 'Enter an email address like name@example.com.',
  passwordMismatch: "Passwords don't match.",
  wrongCurrentPassword: 'Current password is incorrect.',
  samePassword: 'Use a different password from your current one.',
  passwordUpdated: 'Password updated. Other devices are signed out.',
} as const;

export const PASSWORD_MIN = 8;
// Supabase accepts at most 72 bytes; the app keeps to 72 characters, as the trainee app does.
export const PASSWORD_MAX = 72;

export type PasswordRule = { label: string; met: boolean };

/** The three live rules (CF01 §1): 8+ characters, a number and a letter. */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', met: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { label: 'Includes a number', met: /[0-9]/.test(password) },
    { label: 'Includes a letter', met: /\p{L}/u.test(password) },
  ];
}

export function passwordOk(password: string): boolean {
  return passwordRules(password).every((rule) => rule.met);
}

/** Nothing typed asks for the address; something that isn't one shows what one looks like. */
export function emailProblem(email: string): string | null {
  if (email.trim() === '') return TEXTS.emailRule;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : TEXTS.emailFormat;
}

export function nameOk(name: string): boolean {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return trimmed.length >= 2 && trimmed.length <= 60;
}
