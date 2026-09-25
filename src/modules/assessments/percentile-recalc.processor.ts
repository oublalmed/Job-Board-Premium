import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PercentileRecalcService } from './percentile-recalc.service.js';
import { PERCENTILE_RECALC_QUEUE } from './percentile-recalc.constants.js';

// Thin adapter: all the actual logic lives in PercentileRecalcService (a
// plain injectable, callable directly in tests without a real BullMQ
// worker/scheduler). Mirrors CooldownNotificationProcessor.
@Processor(PERCENTILE_RECALC_QUEUE)
export class PercentileRecalcProcessor extends WorkerHost {
  private readonly logger = new Logger(PercentileRecalcProcessor.name);

  constructor(private readonly service: PercentileRecalcService) {
    super();
  }

  async process(job: Job): Promise<{ updatedCount: number }> {
    const result = await this.service.recalculate();
    this.logger.log(
      `Percentile recalc (job ${job.id}) updated ${result.updatedCount}/${result.scoreCount} score(s) across ${result.cohortCount} cohort(s)`,
    );
    return { updatedCount: result.updatedCount };
  }

  // Without this listener a transient Redis outage would emit an unhandled
  // 'error' on the Worker's EventEmitter and crash app bootstrap. See
  // CooldownNotificationProcessor for the full rationale.
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`Percentile recalc worker error: ${error.message}`);
  }
}
