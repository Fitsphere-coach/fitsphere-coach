import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  approvalCodeSchema,
  codeResultSchema,
  gymRequestSchema,
  isCoachAccount,
  meResponseSchema,
  meSetupRequestSchema,
  onboardingStatusSchema,
  validationDetails,
} from './contracts.ts';

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

describe('gymRequestSchema (CF02)', () => {
  const form = { gymName: ' Iron   Gym ', address: '12 MG Road', city: 'Indore', pincode: '452010', ownerPhone: '98765 43210', totalTrainees: 120 };

  it('tidies the text and puts the phone in +91 form', () => {
    const parsed = gymRequestSchema.safeParse(form);
    expect(parsed.success && parsed.data).toMatchObject({ gymName: 'Iron Gym', ownerPhone: '+919876543210' });
    for (const phone of ['+91 98765-43210', '09876543210', '9876543210']) {
      const result = gymRequestSchema.safeParse({ ...form, ownerPhone: phone });
      expect(result.success && result.data.ownerPhone).toBe('+919876543210');
    }
  });

  it('refuses what the database would refuse', () => {
    for (const bad of [
      { gymName: 'A' },
      { gymName: 'x'.repeat(101) },
      { pincode: '12345' },
      { pincode: '12345a' },
      { ownerPhone: '12345' },
      { totalTrainees: 0 },
      { totalTrainees: 100001 },
      { totalTrainees: 1.5 },
      { city: '' },
    ]) {
      expect(gymRequestSchema.safeParse({ ...form, ...bad }).success).toBe(false);
    }
  });

  it('refuses unknown fields, and keeps the optional link only when given', () => {
    expect(gymRequestSchema.safeParse({ ...form, role: 'head_coach' }).success).toBe(false);
    expect(gymRequestSchema.safeParse({ ...form, websiteOrInstagram: ' instagram.com/irongym ' }).data).toMatchObject({ websiteOrInstagram: 'instagram.com/irongym' });
    expect(gymRequestSchema.safeParse(form).data).not.toHaveProperty('websiteOrInstagram');
  });
});

describe('approval code and onboarding answers (CF02)', () => {
  it('a code is digits only', () => {
    expect(approvalCodeSchema.safeParse({ code: '482915' }).success).toBe(true);
    expect(approvalCodeSchema.safeParse({ code: '48 2915' }).success).toBe(false);
    expect(approvalCodeSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
    expect(approvalCodeSchema.safeParse({ code: '482915', extra: 1 }).success).toBe(false);
  });

  it('describes the status and the code result', () => {
    const status = { status: 'pending', expiresAt: '2026-11-19T08:50:00.000Z', triesLeft: 5, requestsLeftToday: 2, codeLength: 6, gymName: null };
    expect(onboardingStatusSchema.safeParse(status).success).toBe(true);
    expect(onboardingStatusSchema.safeParse({ ...status, status: 'maybe' }).success).toBe(false);
    expect(codeResultSchema.safeParse({ result: 'wrong', triesLeft: 3, gymName: null }).success).toBe(true);
    expect(codeResultSchema.safeParse({ result: 'approved', triesLeft: null, gymName: 'Iron Gym' }).success).toBe(true);
    expect(codeResultSchema.safeParse({ result: 'granted', triesLeft: null, gymName: null }).success).toBe(false);
  });
});
