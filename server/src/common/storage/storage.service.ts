import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';

/** Thin wrapper over MinIO/S3 for the documents module (PRODUCT_PLAN §5.H). */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client = new Client({
    endPoint: env.s3.endpoint,
    port: env.s3.port,
    useSSL: env.s3.useSSL,
    accessKey: env.s3.accessKey,
    secretKey: env.s3.secretKey,
  });

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(env.s3.bucket);
      if (!exists) await this.client.makeBucket(env.s3.bucket);
    } catch (err) {
      this.logger.warn(
        `Object storage unavailable at startup (${(err as Error).message}) — document upload/download will fail until MinIO is reachable.`,
      );
    }
  }

  newKey(studentId: string, fileName: string): string {
    return `students/${studentId}/${randomUUID()}-${fileName}`;
  }

  async put(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(env.s3.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  async presignedGetUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(env.s3.bucket, key, expirySeconds);
  }

  async remove(key: string): Promise<void> {
    await this.client.removeObject(env.s3.bucket, key);
  }
}
