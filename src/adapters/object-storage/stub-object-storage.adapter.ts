import { Injectable, Logger } from '@nestjs/common';
import {
  ObjectStorage,
  UploadRequest,
} from '../../ports/object-storage.port.js';

@Injectable()
export class StubObjectStorageAdapter implements ObjectStorage {
  private readonly logger = new Logger(StubObjectStorageAdapter.name);
  private readonly store = new Map<
    string,
    { contentType: string; size: number }
  >();

  upload(request: UploadRequest): Promise<{ key: string; url: string }> {
    const size = Buffer.isBuffer(request.body) ? request.body.length : 0;
    this.store.set(request.key, {
      contentType: request.contentType,
      size,
    });
    this.logger.log(
      `[STUB] File uploaded: key=${request.key}, contentType=${request.contentType}, size=${size}`,
    );
    return Promise.resolve({
      key: request.key,
      url: `https://stub-storage.local/${request.key}`,
    });
  }

  getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    this.logger.log(
      `[STUB] Signed URL generated for key=${key}, expires=${expiresInSeconds}s`,
    );
    return Promise.resolve(
      `https://stub-storage.local/${key}?expires=${expiresInSeconds}`,
    );
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    this.logger.log(`[STUB] File deleted: key=${key}`);
    return Promise.resolve();
  }

  exists(key: string): Promise<boolean> {
    return Promise.resolve(this.store.has(key));
  }
}
