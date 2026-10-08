import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  ObjectStorage,
  UploadRequest,
} from '../../ports/object-storage.port.js';

// Real object storage over any S3-compatible service (AWS S3, Cloudflare R2,
// Backblaze B2, MinIO). Selected by STORAGE_DRIVER=s3 (see object-storage
// factory); the stub stays the default so CI/tests need no bucket.
@Injectable()
export class S3ObjectStorageAdapter implements ObjectStorage {
  private readonly logger = new Logger(S3ObjectStorageAdapter.name);
  private readonly client: S3Client;
  private readonly defaultBucket: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('STORAGE_ENDPOINT');
    this.defaultBucket = config.get<string>('STORAGE_BUCKET', 'jobboard');
    this.client = new S3Client({
      region: config.get<string>('STORAGE_REGION', 'auto'),
      endpoint,
      // R2/MinIO and most S3-compatibles need path-style addressing.
      forcePathStyle: config.get<boolean>('STORAGE_FORCE_PATH_STYLE', true),
      credentials: {
        accessKeyId: config.get<string>('STORAGE_ACCESS_KEY', ''),
        secretAccessKey: config.get<string>('STORAGE_SECRET_KEY', ''),
      },
    });
    this.logger.log(`S3 object storage ready (bucket=${this.defaultBucket})`);
  }

  async upload(
    request: UploadRequest,
  ): Promise<{ key: string; url: string }> {
    const bucket = request.bucket ?? this.defaultBucket;
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: request.key,
        Body: request.body,
        ContentType: request.contentType,
      }),
    );
    // Informational object URL — private buckets are read via getSignedUrl().
    return {
      key: request.key,
      url: `s3://${bucket}/${request.key}`,
    };
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.defaultBucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.defaultBucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.defaultBucket, Key: key }),
      );
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 404) return false;
      const name = (error as Error).name;
      if (name === 'NotFound' || name === 'NoSuchKey') return false;
      throw error;
    }
  }
}
