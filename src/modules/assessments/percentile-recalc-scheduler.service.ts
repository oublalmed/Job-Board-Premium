import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  PERCENTILE_RECALC_QUEUE,
  PERCENTILE_RECALC_JOB_ID,
  PERCENTILE_RECALC_JOB_NAME,
} from './percentile-recalc.constants.js';

const DEFAULT_PERCENTILE_RECALC_CRON = '30 2 * * *'; // daily at 02:30
// Bounds how long onModuleInit waits for Redis before giving up so a broker
// outage at boot never hangs app startup. Same contract as the cooldown
// scheduler.
const REGISTRATION_TIMEOUT_MS = 5000;

// Registers the repeatable percentile-recalc job once at boot. A fixed jobId
// (percentile-recalc.constants.ts) makes the registration idempotent —
// re-adding the same repeatable job on every restart is a BullMQ no-op.
@Injectable()
export class PercentileRecalcSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PercentileRecalcSchedulerService.name);

  constructor(
    @InjectQueue(PERCENTILE_RECALC_QUEUE)
    private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {
    // The Queue is its own EventEmitter (separate from the Worker's) and
    // @nestjs/bullmq attaches no default 'error' listener, so an
    // unreachable Redis would otherwise throw here and take down boot.
    this.queue.on('error', (error: Error) => {
      this.logger.warn(`Percentile recalc queue error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    const pattern = this.configService.get<string>(
      'business.percentileRecalcCron',
      DEFAULT_PERCENTILE_RECALC_CRON,
    );

    try {
      await this.withTimeout(
        this.queue.add(
          PERCENTILE_RECALC_JOB_NAME,
          {},
          {
            repeat: { pattern },
            jobId: PERCENTILE_RECALC_JOB_ID,
          },
        ),
        REGISTRATION_TIMEOUT_MS,
      );
      this.logger.log(`Percentile recalc scheduled (cron: ${pattern})`);
    } catch (error) {
      this.logger.warn(
        `Could not register the percentile-recalc repeatable job (Redis unavailable?) — app boot continues without it: ${(error as Error).message}`,
      );
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    // A late rejection after the timeout has already won the race would
    // otherwise be an unhandled rejection; this no-op catch is a second,
    // harmless observer. (See CooldownSchedulerService for the full note.)
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
