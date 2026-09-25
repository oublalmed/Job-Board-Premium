import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataRetentionService } from './data-retention.service.js';
import { DATA_RETENTION_QUEUE } from './data-retention.constants.js';

// Thin adapter over DataRetentionService (a plain injectable, callable in
// tests without a live worker). Mirrors PercentileRecalcProcessor.
@Processor(DATA_RETENTION_QUEUE)
export class DataRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(DataRetentionProcessor.name);

  constructor(private readonly service: DataRetentionService) {
    super();
  }

  async process(job: Job): Promise<{ deletedNotifications: number }> {
    const result = await this.service.sweep();
    this.logger.log(
      `Data-retention sweep (job ${job.id}) purged ${result.deletedNotifications} notification(s)`,
    );
    return { deletedNotifications: result.deletedNotifications };
  }

  // Without this listener a transient Redis outage would emit an unhandled
  // 'error' on the Worker's EventEmitter and crash app bootstrap.
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`Data-retention worker error: ${error.message}`);
  }
}
