import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  SAVED_SEARCH_ALERT_QUEUE,
  SAVED_SEARCH_ALERT_JOB_ID,
  SAVED_SEARCH_ALERT_JOB_NAME,
} from './saved-search-alert.constants.js';

const DEFAULT_SAVED_SEARCH_ALERT_CRON = '0 7 * * *'; // daily at 07:00
// Bounds how long onModuleInit waits for Redis before giving up so a broker
// outage at boot never hangs app startup. Same contract as the cooldown and
// percentile-recalc schedulers.
const REGISTRATION_TIMEOUT_MS = 5000;

// Registers the repeatable saved-search alert sweep once at boot. A fixed
// jobId (saved-search-alert.constants.ts) makes the registration idempotent —
// re-adding the same repeatable job on every restart is a BullMQ no-op.
@Injectable()
export class SavedSearchAlertSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SavedSearchAlertSchedulerService.name);

  constructor(
    @InjectQueue(SAVED_SEARCH_ALERT_QUEUE)
    private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {
    // The Queue is its own EventEmitter (separate from the Worker's) and
    // @nestjs/bullmq attaches no default 'error' listener, so an unreachable
    // Redis would otherwise throw here and take down boot.
    this.queue.on('error', (error: Error) => {
      this.logger.warn(`Saved-search alert queue error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    const pattern = this.configService.get<string>(
      'business.savedSearchAlertCron',
      DEFAULT_SAVED_SEARCH_ALERT_CRON,
    );

    try {
      await this.withTimeout(
        this.queue.add(
          SAVED_SEARCH_ALERT_JOB_NAME,
          {},
          {
            repeat: { pattern },
            jobId: SAVED_SEARCH_ALERT_JOB_ID,
          },
        ),
        REGISTRATION_TIMEOUT_MS,
      );
      this.logger.log(`Saved-search alert sweep scheduled (cron: ${pattern})`);
    } catch (error) {
      this.logger.warn(
        `Could not register the saved-search alert repeatable job (Redis unavailable?) — app boot continues without it: ${(error as Error).message}`,
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
