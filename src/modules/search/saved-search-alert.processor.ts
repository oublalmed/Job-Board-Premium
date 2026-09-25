import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SavedSearchAlertService } from './saved-search-alert.service.js';
import { SAVED_SEARCH_ALERT_QUEUE } from './saved-search-alert.constants.js';

// Thin adapter: all the actual logic lives in SavedSearchAlertService (a plain
// injectable, callable directly in tests without a real BullMQ
// worker/scheduler). Mirrors CooldownNotificationProcessor /
// PercentileRecalcProcessor.
@Processor(SAVED_SEARCH_ALERT_QUEUE)
export class SavedSearchAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(SavedSearchAlertProcessor.name);

  constructor(private readonly service: SavedSearchAlertService) {
    super();
  }

  async process(job: Job): Promise<{ notifiedCount: number }> {
    const result = await this.service.runAlertSweep();
    this.logger.log(
      `Saved-search alert sweep (job ${job.id}) notified ${result.notifiedCount} owner(s)`,
    );
    return result;
  }

  // Without this listener a transient Redis outage would emit an unhandled
  // 'error' on the Worker's EventEmitter and crash app bootstrap. See
  // CooldownNotificationProcessor for the full rationale.
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`Saved-search alert worker error: ${error.message}`);
  }
}
