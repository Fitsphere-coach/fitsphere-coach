import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isCoachAccount, meResponseSchema, meSetupRequestSchema, validationDetails } from './contracts.ts';

describe('isCoachAccount', () => {
  it('is true only with Coach or Head Coach switched on', () => {
    expect(isCoachAccount(['personal'])).toBe(false);
    expect(isCoachAccount([])).toBe(false);
    expect(isCoachAccount(['personal', 'coach'])).toBe(true);
    expect(isCoachAccount(['head_coach'])).toBe(true);
  });
});

describe('meResponseSchema', () => {
  it('accepts the trainee API shape and refuses unknown roles', () => {
    const user = { id: '0b6f2a52-6f4b-4c38-9d1f-2b8e4c1a7d10', email: 'a@example.test', createdAt: '2026-11-03T08:00:00Z' };
    expect(meResponseSchema.safeParse({ user, roles: ['coach'], coach: { fullName: 'Asha Rao' } }).success).toBe(true);
    expect(meResponseSchema.safeParse({ user, roles: ['personal'], coach: null }).success).toBe(true);
    expect(meResponseSchema.safeParse({ user, roles: ['admin'], coach: null }).success).toBe(false);
  });
});

describe('meSetupRequestSchema', () => {
  it('tidies the name and refuses names outside 2 to 60 characters', () => {
    const base = { ageConfirmed: true, ageConfirmationTextVersion: 'v', coachTermsVersion: 'v' };
    const parsed = meSetupRequestSchema.safeParse({ ...base, fullName: '  Asha   Rao ' });
    expect(parsed.success && parsed.data.fullName).toBe('Asha Rao');
    expect(meSetupRequestSchema.safeParse({ ...base, fullName: ' A ' }).success).toBe(false);
    expect(meSetupRequestSchema.safeParse({ ...base, fullName: 'x'.repeat(61) }).success).toBe(false);
  });
});

describe('validationDetails', () => {
  it('names missing, unknown and out-of-range fields', () => {
    const schema = z.strictObject({ name: z.string(), age: z.int().min(18) });
    const input = { age: 10, extra: 1 };
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(validationDetails(result.error, input)).toEqual(
      expect.arrayContaining([
        { field: 'name', issue: 'required' },
        { field: 'age', issue: 'out_of_range' },
        { field: 'extra', issue: 'unknown_field' },
      ]),
    );
  });
});
