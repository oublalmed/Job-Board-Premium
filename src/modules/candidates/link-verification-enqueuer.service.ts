import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  LINK_VERIFICATION_QUEUE,
  LINK_VERIFICATION_JOB_NAME,
  LinkVerificationJobData,
} from './link-verification.constants.js';

// EF-CAND-04 — enqueues a per-link verification job. Isolated from
// CandidateLinkService so the (synchronous, user-facing) link CRUD never
// depends on the broker being reachable: a Redis outage degrades to "the link
// is created, its status stays pending", never a failed request.
@Injectable()
export class LinkVerificationEnqueuer {
  private readonly logger = new Logger(LinkVerificationEnqueuer.name);

  constructor(
    @InjectQueue(LINK_VERIFICATION_QUEUE)
    private readonly queue: Queue<LinkVerificationJobData>,
  ) {
    // The Queue is its own EventEmitter and @nestjs/bullmq attaches no default
    // 'error' listener, so an unreachable Redis would otherwise throw.
    this.queue.on('error', (error: Error) => {
      this.logger.warn(`Link verification queue error: ${error.message}`);
    });
  }

  /**
   * Best-effort enqueue. Uses the link id as the BullMQ jobId so re-enqueuing
   * the same link (e.g. rapid re-check) coalesces instead of piling up, and
   * configures bounded retries with backoff for transient network blips.
   */
  async enqueue(linkId: string): Promise<void> {
    try {
      await this.queue.add(
        LINK_VERIFICATION_JOB_NAME,
        { linkId },
        {
          jobId: `verify-${linkId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Could not enqueue verification for link ${linkId} (Redis unavailable?): ${(error as Error).message}`,
      );
    }
  }
}
