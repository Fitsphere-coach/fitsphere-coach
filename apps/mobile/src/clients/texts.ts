// Texts and small helpers for client management (docs/design/CF04-client-management-ui.md).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const istDay = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / 86_400_000);

/** "Logged today", "Logged yesterday", "Last log 3 Nov" (India days, invariant 4). */
export function lastLoggedText(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Nothing logged yet';
  const ms = new Date(iso).getTime();
  const days = istDay(now.getTime()) - istDay(ms);
  if (days <= 0) return 'Logged today';
  if (days === 1) return 'Logged yesterday';
  const shifted = new Date(ms + IST_OFFSET_MS);
  return `Last log ${shifted.getUTCDate()} ${MONTHS[shifted.getUTCMonth()]}`;
}

/** "3 Nov 2026" in India time. */
export function sinceText(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return `${shifted.getUTCDate()} ${MONTHS[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()}`;
}

/** The coach's name as the viewer reads it: "You" for their own client. */
export function coachLabel(coachId: string, coachName: string | null, myId: string | null): string {
  if (coachId === myId) return 'You';
  return coachName ?? 'Coach';
}

export const CLIENT_TEXTS = {
  empty: 'No clients yet',
  emptySub: 'When a trainee joins your gym, they appear here and you can see what they log. Inviting clients arrives in the next update.',
  noMatch: 'No clients match.',
  removeBody: (name: string) =>
    `This ends your link with ${name}. You will not see anything new they log. History up to today stays in your gym, read-only. Nothing is deleted, and they keep their FitSphere account.`,
  moveBody: (name: string) => `${name} stays your gym's client. The new coach sees their data, and the change is recorded.`,
  notFound: 'This client is no longer available.',
  refused: "You can't do this.",
} as const;
