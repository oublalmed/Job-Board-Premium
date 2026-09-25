import { deriveKey, encryptSecret, decryptSecret } from '../secret-box.js';

describe('secret-box (AES-256-GCM)', () => {
  const key = deriveKey('a-test-passphrase');

  it('round-trips a secret', () => {
    const plaintext = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const encrypted = encryptSecret(plaintext, key);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted, key)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-input', key);
    const b = encryptSecret('same-input', key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe('same-input');
    expect(decryptSecret(b, key)).toBe('same-input');
  });

  it('fails to decrypt with the wrong key', () => {
    const encrypted = encryptSecret('top-secret', key);
    const wrongKey = deriveKey('different-passphrase');
    expect(() => decryptSecret(encrypted, wrongKey)).toThrow();
  });

  it('fails to decrypt tampered ciphertext (auth tag)', () => {
    const encrypted = encryptSecret('top-secret', key);
    const raw = Buffer.from(encrypted, 'base64');
    raw[raw.length - 1] ^= 0xff; // flip a ciphertext bit
    expect(() => decryptSecret(raw.toString('base64'), key)).toThrow();
  });

  it('rejects a truncated payload', () => {
    expect(() => decryptSecret('AAAA', key)).toThrow(
      'Malformed encrypted secret',
    );
  });

  it('derives a stable 32-byte key from a passphrase', () => {
    expect(deriveKey('x')).toHaveLength(32);
    expect(deriveKey('x').equals(deriveKey('x'))).toBe(true);
  });
});
