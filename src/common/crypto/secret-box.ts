import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

/**
 * Authenticated symmetric encryption for secrets at rest (AES-256-GCM).
 *
 * Used to avoid persisting TOTP shared secrets in plaintext: a database dump
 * alone must not be enough to mint valid one-time codes. GCM gives us
 * confidentiality *and* integrity (tampering fails decryption).
 *
 * Wire format (base64): [12-byte IV][16-byte auth tag][ciphertext].
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, the GCM-recommended size.
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256.

/**
 * Derives a stable 32-byte key from a passphrase. `MFA_ENCRYPTION_KEY` should
 * be set to a dedicated high-entropy value in production; when it is absent we
 * derive from the (required) JWT refresh secret so the feature still works in
 * dev/CI without extra configuration. The salt is fixed so the same
 * passphrase always yields the same key (required to decrypt existing rows).
 */
export function deriveKey(passphrase: string): Buffer {
  return scryptSync(passphrase, 'cobalt.secret-box.v1', KEY_LENGTH);
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptSecret(payload: string, key: Buffer): string {
  const raw = Buffer.from(payload, 'base64');
  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Malformed encrypted secret');
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
