import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  COOLDOWN_QUEUE,
  COOLDOWN_SWEEP_JOB_ID,
  COOLDOWN_SWEEP_JOB_NAME,
} from './cooldown-queue.constants.js';

const DEFAULT_COOLDOWN_SWEEP_CRON = '0 3 * * *'; // daily at 03:00
// A broker outage at boot must never hang app startup — this bounds how
// long onModuleInit waits for Redis before giving up and logging a
// warning. The repeatable job simply won't be (re-)registered until the
// next successful boot; nothing else depends on this call completing.
const REGISTRATION_TIMEOUT_MS = 5000;

// Registers the repeatable job once at boot. A fixed jobId (see
// cooldown-queue.constants.ts) makes this registration itself idempotent —
// re-adding the same repeatable job on every app restart is a no-op in
// BullMQ, never a second, duplicate schedule.
@Injectable()
export class CooldownSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CooldownSchedulerService.name);

  constructor(
    @InjectQueue(COOLDOWN_QUEUE)
    private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {
    // The Queue instance is its own EventEmitter, separate from the
    // Worker's (CooldownNotificationProcessor already handles that one) —
    // @nestjs/bullmq attaches no default listener, so an unreachable Redis
    // would otherwise throw here too (Node's default behavior for an
    // unhandled 'error' event) and take down app boot with it.
    this.queue.on('error', (error: Error) => {
      this.logger.warn(`Cooldown queue error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    const pattern = this.configService.get<string>(
      'business.cooldownSweepCron',
      DEFAULT_COOLDOWN_SWEEP_CRON,
    );

    try {
      await this.withTimeout(
        this.queue.add(
          COOLDOWN_SWEEP_JOB_NAME,
          {},
          {
            repeat: { pattern },
            jobId: COOLDOWN_SWEEP_JOB_ID,
          },
        ),
        REGISTRATION_TIMEOUT_MS,
      );
      this.logger.log(`Cooldown sweep scheduled (cron: ${pattern})`);
    } catch (error) {
      this.logger.warn(
        `Could not register the cooldown sweep repeatable job (Redis unavailable?) — app boot continues without it: ${(error as Error).message}`,
      );
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    // Promise.race does not cancel the loser: if `promise` settles AFTER
    // the timeout has already "won" the race, its outcome is never
    // observed by the race's own caller — a late rejection would surface
    // as a genuinely unhandled rejection, independent of and later than
    // whatever this function returns. This no-op catch is a second,
    // harmless observer on the same promise (multiple handlers are fine),
    // purely so a delayed failure is never unhandled.
    promise.catch(() => {});
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
      ),
    ]);
  }
}
