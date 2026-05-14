import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

// Random URL-safe token, 32 bytes -> 43 base64url chars.
// Used for password-reset links. The raw token is emailed; only its hash
// is persisted, so a DB compromise doesn't yield usable reset links.
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

// Constant-time compare of two equal-length hex strings.
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
