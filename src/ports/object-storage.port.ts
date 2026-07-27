import { Readable } from 'stream';

export interface UploadRequest {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  bucket?: string;
}

export interface ObjectStorage {
  upload(request: UploadRequest): Promise<{ key: string; url: string }>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
