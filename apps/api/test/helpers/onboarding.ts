// Gym onboarding test doubles: made-up settings and a mailer that records what it would send.
// No test sends a real email. Synthetic values only.
import type { OnboardingDeps } from '../../src/onboarding.ts';
import type { Mailer, OutgoingEmail } from '../../src/mailer.ts';
import type { Settings } from '../../src/settings.ts';

export const TEST_SETTINGS: Settings = {
  approvalInbox: 'approvals@example.test',
  senderEmail: 'sender@example.test',
  senderDisplayName: 'FitSphere Coach',
  approvalCodeLength: 6,
  gymRequestValidDays: 7,
  approvalWrongTries: 5,
  gymRequestsPerDay: 3,
  traineeInviteValidDays: 7,
  invitesPerDay: 20,
  traineeInvitesEnabled: true,
  approvalCodeSecret: 'test-secret-test-secret-test-secret-1234',
  smtpAppPassword: 'test-app-password',
};

export function fakeMailer() {
  const sent: OutgoingEmail[] = [];
  let failNext = false;
  const mailer: Mailer = {
    async send(email) {
      if (failNext) {
        failNext = false;
        throw new Error('smtp down');
      }
      sent.push(email);
    },
  };
  return {
    mailer,
    sent,
    failNextSend() {
      failNext = true;
    },
    /** The code in the most recent email, as FitSphere's team would read it. */
    lastCode(): string {
      const match = /Approval code: (\d+)/.exec(sent.at(-1)?.text ?? '');
      if (!match?.[1]) throw new Error('No approval email was sent');
      return match[1];
    },
  };
}

export function testOnboarding(overrides: Partial<OnboardingDeps> = {}) {
  const fake = fakeMailer();
  const deps: OnboardingDeps = { settings: TEST_SETTINGS, mailer: fake.mailer, ...overrides };
  return { deps, ...fake };
}
