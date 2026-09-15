import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: process.env['JWT_ACCESS_SECRET'] ?? '',
  jwtAccessExpiration: process.env['JWT_ACCESS_EXPIRATION'] ?? '15m',
  jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'] ?? '',
  jwtRefreshExpiration: process.env['JWT_REFRESH_EXPIRATION'] ?? '7d',
  passwordMinLength: parseInt(process.env['PASSWORD_MIN_LENGTH'] ?? '10', 10),
  // ENF-06 — MFA/TOTP.
  // Issuer label shown in authenticator apps.
  mfaIssuer: process.env['MFA_ISSUER'] ?? 'Cobalt',
  // Dedicated key for encrypting TOTP secrets at rest. Optional: when unset,
  // the secret-box derives a key from the JWT refresh secret so the feature
  // works out of the box in dev/CI. Set a distinct value in production.
  mfaEncryptionKey: process.env['MFA_ENCRYPTION_KEY'] ?? '',
  // Hard-enforce MFA for staff (admin/moderator) roles at the guard layer.
  // Defaults OFF so an org can roll MFA out (enroll staff) before flipping
  // enforcement on — turning it on before enrollment would lock staff out.
  mfaEnforceStaff:
    (process.env['MFA_ENFORCE_STAFF'] ?? 'false').toLowerCase() === 'true',
}));
