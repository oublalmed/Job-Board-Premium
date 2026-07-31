import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RemediationNotificationService } from './remediation-notification.service.js';
import { COOLDOWN_QUEUE } from './cooldown-queue.constants.js';

// Thin adapter: all the actual logic lives in RemediationNotificationService
// (a plain injectable, callable directly in tests without depending on a
// real BullMQ worker/scheduler).
@Processor(COOLDOWN_QUEUE)
export class CooldownNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(CooldownNotificationProcessor.name);

  constructor(
    private readonly remediationNotificationService: RemediationNotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ notifiedCount: number }> {
    const result = await this.remediationNotificationService.runCooldownSweep();
    this.logger.log(
      `Cooldown sweep (job ${job.id}) notified ${result.notifiedCount} candidate(s)`,
    );
    return result;
  }

  // BullMQ's Worker is an EventEmitter that emits 'error' on connection
  // failures (e.g. Redis unreachable) — Node's default behavior for an
  // unhandled 'error' event is to throw, which was crashing app bootstrap
  // entirely on a broker outage. Without this listener, a transient Redis
  // blip would take down the whole API, not just the cooldown sweep.
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`Cooldown sweep worker error: ${error.message}`);
  }
}
