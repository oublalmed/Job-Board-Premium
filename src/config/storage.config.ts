import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  endpoint: process.env['STORAGE_ENDPOINT'] ?? 'http://localhost:9000',
  accessKey: process.env['STORAGE_ACCESS_KEY'] ?? '',
  secretKey: process.env['STORAGE_SECRET_KEY'] ?? '',
  bucket: process.env['STORAGE_BUCKET'] ?? 'jobboard',
  region: process.env['STORAGE_REGION'] ?? 'us-east-1',
  forcePathStyle: process.env['STORAGE_FORCE_PATH_STYLE'] === 'true',
}));
