import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LinkVerificationService } from './link-verification.service.js';
import {
  LINK_VERIFICATION_QUEUE,
  LinkVerificationJobData,
} from './link-verification.constants.js';

// Thin worker adapter over LinkVerificationService (EF-CAND-04). All logic
// lives in the service; this only unwraps the job payload and logs. Mirrors
// SavedSearchAlertProcessor / PercentileRecalcProcessor.
@Processor(LINK_VERIFICATION_QUEUE)
export class LinkVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(LinkVerificationProcessor.name);

  constructor(private readonly service: LinkVerificationService) {
    super();
  }

  async process(job: Job<LinkVerificationJobData>): Promise<void> {
    await this.service.verify(job.data.linkId);
  }

  // Without this listener a transient Redis outage would emit an unhandled
  // 'error' on the Worker's EventEmitter and crash app bootstrap.
  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.warn(`Link verification worker error: ${error.message}`);
  }
}
