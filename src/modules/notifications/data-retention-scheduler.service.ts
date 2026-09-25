import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  DATA_RETENTION_QUEUE,
  DATA_RETENTION_JOB_ID,
  DATA_RETENTION_JOB_NAME,
} from './data-retention.constants.js';

const DEFAULT_DATA_RETENTION_CRON = '0 4 * * *'; // daily at 04:00
const REGISTRATION_TIMEOUT_MS = 5000;

// ENF-12 — registers the repeatable data-retention sweep once at boot. Fixed
// jobId makes the registration idempotent across restarts. Same boot-safety
// contract as the percentile/cooldown schedulers: a Redis outage at startup
// is logged and never blocks app boot.
@Injectable()
export class DataRetentionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DataRetentionSchedulerService.name);

  constructor(
    @InjectQueue(DATA_RETENTION_QUEUE)
    private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.queue.on('error', (error: Error) => {
      this.logger.warn(`Data-retention queue error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    const pattern = this.configService.get<string>(
      'business.dataRetentionCron',
      DEFAULT_DATA_RETENTION_CRON,
    );

    try {
      await this.withTimeout(
        this.queue.add(
          DATA_RETENTION_JOB_NAME,
          {},
          { repeat: { pattern }, jobId: DATA_RETENTION_JOB_ID },
        ),
        REGISTRATION_TIMEOUT_MS,
      );
      this.logger.log(`Data-retention sweep scheduled (cron: ${pattern})`);
    } catch (error) {
      this.logger.warn(
        `Could not register the data-retention repeatable job (Redis unavailable?) — app boot continues without it: ${(error as Error).message}`,
      );
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    promise.catch(() => {});
    let timeoutHandle: NodeJS.Timeout;
    const timeout = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`timed out after ${ms}ms`)),
        ms,
      );
    });
    return Promise.race([promise, timeout]).finally(() =>
      clearTimeout(timeoutHandle),
    );
  }
}
