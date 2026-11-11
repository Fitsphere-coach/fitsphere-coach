// The approval code (ADR-0004). Random digits from the secure generator; stored only as a keyed
// hash (HMAC-SHA256) with a secret that lives in the server's settings, so a leaked database
// reveals no code. Compared in constant time. The code is never returned, shown or logged
// (invariant 11).
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export function generateCode(length: number): string {
  return String(randomInt(0, 10 ** length)).padStart(length, '0');
}

/** The request's id is part of the hashed text, so a hash only matches its own request. */
export function hashCode(secret: string, requestId: string, code: string): string {
  return createHmac('sha256', secret).update(`${requestId}:${code}`).digest('hex');
}

export function codeMatches(secret: string, requestId: string, code: string, storedHash: string): boolean {
  const given = Buffer.from(hashCode(secret, requestId, code), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return given.length === stored.length && timingSafeEqual(given, stored);
}
