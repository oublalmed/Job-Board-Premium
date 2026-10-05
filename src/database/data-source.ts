import { join } from 'node:path';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'jobboard',
  password: process.env['DB_PASSWORD'] ?? '',
  database: process.env['DB_DATABASE'] ?? 'jobboard_dev',
  // ENF-05 — match the runtime app's TLS behaviour when running migrations.
  ssl:
    process.env['DB_SSL'] === 'true'
      ? {
          rejectUnauthorized:
            (
              process.env['DB_SSL_REJECT_UNAUTHORIZED'] ?? 'true'
            ).toLowerCase() !== 'false',
        }
      : false,
  // Resolved relative to this file so the globs work both from TypeScript
  // source (ts-node — dev/CI, __dirname = src/database) and from the compiled
  // output (production Docker image — __dirname = dist/database). Matching both
  // extensions keeps a single data source valid in either runtime.
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
});
