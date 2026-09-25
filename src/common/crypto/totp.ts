import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Dependency-free RFC 4226 (HOTP) / RFC 6238 (TOTP) implementation.
 *
 * Kept in-house rather than pulling in `otplib`/`speakeasy`: the algorithm is
 * small and stable, and every third-party dependency is attack surface we
 * would have to vet and keep patched. All comparisons are constant-time.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_DIGITS = 6;
const DEFAULT_STEP_SECONDS = 30;

/** Cryptographically random base32 secret (default 160 bits, per RFC 4226 §4). */
export function generateBase32Secret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

/** RFC 4648 base32 encoding without padding (the form authenticator apps expect). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** RFC 4648 base32 decode (case-insensitive, padding and spaces tolerated). */
export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/g, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid base32 character in TOTP secret');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(key: Buffer, counter: number, digits: number): string {
  // 8-byte big-endian counter.
  const buf = Buffer.alloc(8);
  // Split into hi/lo 32-bit halves to stay exact well past 2^32.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);

  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export interface TotpOptions {
  digits?: number;
  stepSeconds?: number;
  /** Epoch milliseconds; defaults to now. Injectable for deterministic tests. */
  now?: number;
}

/** Current TOTP code for a base32 secret. */
export function generateTotp(
  secretBase32: string,
  options: TotpOptions = {},
): string {
  const digits = options.digits ?? DEFAULT_DIGITS;
  const step = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const now = options.now ?? Date.now();
  const counter = Math.floor(now / 1000 / step);
  return hotp(base32Decode(secretBase32), counter, digits);
}

/**
 * Verifies a submitted code against the secret, tolerating +/- `window` steps
 * for clock drift (default 1 step = +/-30s). Constant-time comparison prevents
 * timing oracles on the code.
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  options: TotpOptions & { window?: number } = {},
): boolean {
  const digits = options.digits ?? DEFAULT_DIGITS;
  const step = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const now = options.now ?? Date.now();
  const window = options.window ?? 1;

  const normalized = token.replace(/\s/g, '');
  if (!/^\d+$/.test(normalized) || normalized.length !== digits) {
    return false;
  }

  const key = base32Decode(secretBase32);
  const counter = Math.floor(now / 1000 / step);
  for (let error = -window; error <= window; error++) {
    const candidate = hotp(key, counter + error, digits);
    if (constantTimeEquals(candidate, normalized)) {
      return true;
    }
  }
  return false;
}

/** otpauth:// provisioning URI consumed by authenticator apps (QR payload). */
export function buildOtpauthUri(params: {
  issuer: string;
  account: string;
  secretBase32: string;
  digits?: number;
  stepSeconds?: number;
}): string {
  // The `issuer:account` colon is the label separator and stays literal;
  // only the two components themselves are percent-encoded.
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(
    params.account,
  )}`;
  const query = new URLSearchParams({
    secret: params.secretBase32,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(params.digits ?? DEFAULT_DIGITS),
    period: String(params.stepSeconds ?? DEFAULT_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
