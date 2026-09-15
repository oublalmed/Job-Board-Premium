import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'jobboard',
  password: process.env['DB_PASSWORD'] ?? '',
  database: process.env['DB_DATABASE'] ?? 'jobboard_dev',
  synchronize: process.env['DB_SYNCHRONIZE'] === 'true',
  logging: process.env['DB_LOGGING'] === 'true',
  // ENF-05 — encryption in transit. Off by default (local/CI Postgres has no
  // TLS); enable in any environment where the DB is reached over a network.
  ssl: process.env['DB_SSL'] === 'true',
  // Allow opting out of cert verification only for self-signed setups.
  sslRejectUnauthorized:
    (process.env['DB_SSL_REJECT_UNAUTHORIZED'] ?? 'true').toLowerCase() !==
    'false',
}));
