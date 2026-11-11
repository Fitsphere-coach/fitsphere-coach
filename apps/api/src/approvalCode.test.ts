// ADR-0004: random digits, keyed hash, constant-time compare, bound to its own request.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { codeMatches, generateCode, hashCode } from './approvalCode.ts';

const secret = 'test-secret-test-secret-test-secret-1234';

describe('approval code', () => {
  it('has exactly the asked number of digits, leading zeros included', () => {
    for (const length of [4, 6, 8]) {
      for (let i = 0; i < 200; i++) expect(generateCode(length)).toMatch(new RegExp(`^[0-9]{${length}}$`));
    }
  });

  it('is not the same every time', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCode(6)));
    expect(codes.size).toBeGreaterThan(40);
  });

  it('matches only its own code, secret and request', () => {
    const id = randomUUID();
    const hash = hashCode(secret, id, '123456');
    expect(codeMatches(secret, id, '123456', hash)).toBe(true);
    expect(codeMatches(secret, id, '123457', hash)).toBe(false);
    expect(codeMatches(`${secret}x`, id, '123456', hash)).toBe(false);
    expect(codeMatches(secret, randomUUID(), '123456', hash)).toBe(false);
  });

  it('is a keyed hash: the plain code is not in it and the key changes it', () => {
    const id = randomUUID();
    const hash = hashCode(secret, id, '123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('123456');
    expect(hashCode('another-secret-another-secret-12345', id, '123456')).not.toBe(hash);
  });

  it('does not throw on a stored value of the wrong shape', () => {
    expect(codeMatches(secret, randomUUID(), '123456', 'not-hex')).toBe(false);
  });
});
