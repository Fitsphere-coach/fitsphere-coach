// ADR-0008 validation: the server refuses to start for each missing or out-of-range variable, it
// starts with the values in .env.example, and no error message shows a value.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { loadSettings, SettingsError } from './settings.ts';

const valid = {
  APPROVAL_INBOX: 'approvals@example.test',
  SENDER_EMAIL: 'sender@example.test',
  SENDER_DISPLAY_NAME: 'FitSphere Coach',
  APPROVAL_CODE_LENGTH: '6',
  GYM_REQUEST_VALID_DAYS: '7',
  APPROVAL_WRONG_TRIES: '5',
  GYM_REQUESTS_PER_DAY: '3',
  APPROVAL_CODE_SECRET: 'x'.repeat(32),
  SMTP_APP_PASSWORD: 'app-password',
};

function problemsOf(env: Record<string, string | undefined>): string[] {
  try {
    loadSettings(env);
  } catch (error) {
    if (error instanceof SettingsError) return error.problems;
    throw error;
  }
  return [];
}

describe('loadSettings', () => {
  it('reads valid values', () => {
    expect(loadSettings(valid)).toMatchObject({
      approvalInbox: 'approvals@example.test',
      approvalCodeLength: 6,
      gymRequestValidDays: 7,
      approvalWrongTries: 5,
      gymRequestsPerDay: 3,
    });
  });

  it('starts with the values in .env.example', () => {
    const example = parseEnv(readFileSync(new URL('../.env.example', import.meta.url), 'utf8'));
    // The example holds no secrets, so the two secrets are added here.
    const settings = loadSettings({ ...example, APPROVAL_CODE_SECRET: 'x'.repeat(32), SMTP_APP_PASSWORD: 'p' });
    expect(settings.approvalCodeLength).toBe(6);
    expect(settings.gymRequestValidDays).toBe(7);
    expect(settings.approvalWrongTries).toBe(5);
    expect(settings.gymRequestsPerDay).toBe(3);
  });

  it.each(Object.keys(valid))('refuses to start without %s, and names it', (name) => {
    const env: Record<string, string | undefined> = { ...valid };
    delete env[name];
    expect(problemsOf(env)).toEqual([`${name} is missing`]);
  });

  it.each([
    ['APPROVAL_CODE_LENGTH', '3'],
    ['APPROVAL_CODE_LENGTH', '9'],
    ['APPROVAL_CODE_LENGTH', 'six'],
    ['GYM_REQUEST_VALID_DAYS', '0'],
    ['GYM_REQUEST_VALID_DAYS', '31'],
    ['APPROVAL_WRONG_TRIES', '0'],
    ['APPROVAL_WRONG_TRIES', '11'],
    ['GYM_REQUESTS_PER_DAY', '0'],
    ['GYM_REQUESTS_PER_DAY', '11'],
    ['GYM_REQUESTS_PER_DAY', '2.5'],
    ['APPROVAL_INBOX', 'not-an-email'],
    ['SENDER_EMAIL', 'also not'],
    ['SENDER_DISPLAY_NAME', 'x'.repeat(51)],
    ['APPROVAL_CODE_SECRET', 'too-short'],
  ])('refuses %s = %s', (name, value) => {
    const problems = problemsOf({ ...valid, [name]: value });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
  });

  it('accepts the edges of every range', () => {
    expect(
      loadSettings({
        ...valid,
        APPROVAL_CODE_LENGTH: '4',
        GYM_REQUEST_VALID_DAYS: '30',
        APPROVAL_WRONG_TRIES: '1',
        GYM_REQUESTS_PER_DAY: '10',
      }),
    ).toMatchObject({ approvalCodeLength: 4, gymRequestValidDays: 30, approvalWrongTries: 1, gymRequestsPerDay: 10 });
  });

  it('reports every problem at once and never shows a value', () => {
    const env = { ...valid, APPROVAL_CODE_LENGTH: '99', APPROVAL_CODE_SECRET: 'short-secret-value', SMTP_APP_PASSWORD: '' };
    let message = '';
    try {
      loadSettings(env);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('APPROVAL_CODE_LENGTH');
    expect(message).toContain('APPROVAL_CODE_SECRET');
    expect(message).toContain('SMTP_APP_PASSWORD');
    expect(message).not.toContain('short-secret-value');
    expect(message).not.toContain('99');
  });
});
