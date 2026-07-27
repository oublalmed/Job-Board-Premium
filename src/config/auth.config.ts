import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: process.env['JWT_ACCESS_SECRET'] ?? '',
  jwtAccessExpiration: process.env['JWT_ACCESS_EXPIRATION'] ?? '15m',
  jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'] ?? '',
  jwtRefreshExpiration: process.env['JWT_REFRESH_EXPIRATION'] ?? '7d',
  passwordMinLength: parseInt(process.env['PASSWORD_MIN_LENGTH'] ?? '10', 10),
}));
