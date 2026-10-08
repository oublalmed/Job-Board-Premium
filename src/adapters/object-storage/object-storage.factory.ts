import { ConfigService } from '@nestjs/config';
import { ObjectStorage } from '../../ports/object-storage.port.js';
import { StubObjectStorageAdapter } from './stub-object-storage.adapter.js';
import { S3ObjectStorageAdapter } from './s3-object-storage.adapter.js';

// STORAGE_DRIVER selects the object store at boot:
//   • 'stub' (default) — in-memory, no network; keeps CI/tests hermetic.
//   • 's3'             — any S3-compatible service (AWS S3, Cloudflare R2,
//                        Backblaze B2, MinIO), configured via STORAGE_*.
export function objectStorageFactory(config: ConfigService): ObjectStorage {
  const driver = config.get<string>('STORAGE_DRIVER') ?? 'stub';
  return driver === 's3'
    ? new S3ObjectStorageAdapter(config)
    : new StubObjectStorageAdapter();
}
