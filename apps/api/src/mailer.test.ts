// ADR-0005: what the approval email holds, who it is from and to. A fake sender is used; no test
// sends a real email.
import { describe, expect, it } from 'vitest';
import { approvalEmail } from './mailer.ts';
import { TEST_SETTINGS } from '../test/helpers/onboarding.ts';

const data = {
  code: '482915',
  gymName: 'Iron Gym',
  address: '12 MG Road',
  city: 'Indore',
  pincode: '452010',
  ownerPhone: '+919876543210',
  totalTrainees: 120,
  websiteOrInstagram: 'instagram.com/irongym',
  applicantName: 'Asha Rao',
  applicantEmail: 'asha@example.test',
  requestedAt: new Date('2026-11-12T08:50:00Z'),
  expiresAt: new Date('2026-11-19T08:50:00Z'),
};

describe('approvalEmail', () => {
  it('goes from FitSphere Coach to the approval inbox', () => {
    const email = approvalEmail(TEST_SETTINGS, data);
    expect(email.to).toBe('approvals@example.test');
    expect(email.fromAddress).toBe('sender@example.test');
    expect(email.fromName).toBe('FitSphere Coach');
    expect(email.subject).toBe('Gym approval request: Iron Gym');
  });

  it('holds the gym details, the person, the times in India time, and the code', () => {
    const { text } = approvalEmail(TEST_SETTINGS, data);
    expect(text).toContain('Gym name: Iron Gym');
    expect(text).toContain('Address: 12 MG Road, Indore 452010');
    expect(text).toContain('Total trainees: 120');
    expect(text).toContain('Owner phone: +919876543210');
    expect(text).toContain('Website or Instagram: instagram.com/irongym');
    expect(text).toContain('Requested by: Asha Rao <asha@example.test>');
    expect(text).toContain('IST');
    expect(text).toContain('Approval code: 482915');
  });

  it('leaves out the website line when none was given, and holds nothing secret', () => {
    const { text } = approvalEmail(TEST_SETTINGS, { ...data, websiteOrInstagram: null });
    expect(text).not.toContain('Website or Instagram');
    expect(text).not.toContain(TEST_SETTINGS.smtpAppPassword);
    expect(text).not.toContain(TEST_SETTINGS.approvalCodeSecret);
  });
});
