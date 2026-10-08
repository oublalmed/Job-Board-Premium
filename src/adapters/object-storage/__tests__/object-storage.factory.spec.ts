import { ConfigService } from '@nestjs/config';
import { objectStorageFactory } from '../object-storage.factory.js';
import { StubObjectStorageAdapter } from '../stub-object-storage.adapter.js';
import { S3ObjectStorageAdapter } from '../s3-object-storage.adapter.js';

function configWith(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string, def?: unknown) =>
      key in values ? values[key] : def,
  } as unknown as ConfigService;
}

describe('objectStorageFactory', () => {
  it('returns the stub adapter by default', () => {
    const storage = objectStorageFactory(configWith({}));
    expect(storage).toBeInstanceOf(StubObjectStorageAdapter);
  });

  it('returns the stub adapter when STORAGE_DRIVER=stub', () => {
    const storage = objectStorageFactory(
      configWith({ STORAGE_DRIVER: 'stub' }),
    );
    expect(storage).toBeInstanceOf(StubObjectStorageAdapter);
  });

  it('returns the S3 adapter when STORAGE_DRIVER=s3', () => {
    const storage = objectStorageFactory(
      configWith({
        STORAGE_DRIVER: 's3',
        STORAGE_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
        STORAGE_ACCESS_KEY: 'ak',
        STORAGE_SECRET_KEY: 'sk',
        STORAGE_BUCKET: 'maysync',
        STORAGE_REGION: 'auto',
      }),
    );
    expect(storage).toBeInstanceOf(S3ObjectStorageAdapter);
  });
});
