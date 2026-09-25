import {
  base32Encode,
  base32Decode,
  generateBase32Secret,
  generateTotp,
  verifyTotp,
  buildOtpauthUri,
} from '../totp.js';

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const buf = Buffer.from('12345678901234567890', 'ascii');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it('encodes the RFC 4648 test secret as expected', () => {
    // ASCII "12345678901234567890" is the RFC 6238 SHA1 test seed.
    expect(base32Encode(Buffer.from('12345678901234567890', 'ascii'))).toBe(
      'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
    );
  });

  it('is tolerant of lower-case, spaces and padding on decode', () => {
    const buf = Buffer.from('hello world', 'ascii');
    const encoded = base32Encode(buf).toLowerCase();
    expect(base32Decode(`${encoded}   ===`).equals(buf)).toBe(true);
  });
});

describe('TOTP (RFC 6238)', () => {
  // The published SHA1 test vectors use this seed and 8 digits.
  const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it.each([
    [59_000, '94287082'],
    [1_111_111_109_000, '07081804'],
    [1_234_567_890_000, '89005924'],
  ])('matches the reference code at t=%dms', (now, expected) => {
    expect(generateTotp(RFC_SECRET, { now, digits: 8 })).toBe(expected);
  });

  it('verifies a freshly generated code', () => {
    const secret = generateBase32Secret();
    const now = 1_700_000_000_000;
    const code = generateTotp(secret, { now });
    expect(verifyTotp(secret, code, { now })).toBe(true);
  });

  it('tolerates one step of clock drift within the window', () => {
    const secret = generateBase32Secret();
    const base = 1_700_000_000_000;
    const code = generateTotp(secret, { now: base });
    // 30s later the server clock advanced one step; window=1 still accepts it.
    expect(verifyTotp(secret, code, { now: base + 30_000 })).toBe(true);
  });

  it('rejects a code outside the window', () => {
    const secret = generateBase32Secret();
    const base = 1_700_000_000_000;
    const code = generateTotp(secret, { now: base });
    expect(verifyTotp(secret, code, { now: base + 120_000 })).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    const secret = generateBase32Secret();
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('generates 160-bit secrets by default', () => {
    // 20 bytes → 32 base32 chars.
    expect(generateBase32Secret()).toHaveLength(32);
  });
});

describe('otpauth URI', () => {
  it('embeds the issuer, account and secret', () => {
    const uri = buildOtpauthUri({
      issuer: 'Cobalt',
      account: 'admin@example.com',
      secretBase32: 'GEZDGNBVGY3TQOJQ',
    });
    expect(uri).toContain('otpauth://totp/Cobalt:admin%40example.com');
    expect(uri).toContain('secret=GEZDGNBVGY3TQOJQ');
    expect(uri).toContain('issuer=Cobalt');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
