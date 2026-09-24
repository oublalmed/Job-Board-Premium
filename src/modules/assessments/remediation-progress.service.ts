import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RemediationProgress } from './entities/remediation-progress.entity.js';

// EF-CAND-09 — records/queries which remediation resources a candidate has
// completed. All operations are owner-scoped by candidateId.
@Injectable()
export class RemediationProgressService {
  constructor(
    @InjectRepository(RemediationProgress)
    private readonly repo: Repository<RemediationProgress>,
  ) {}

  /** URLs the candidate has marked completed (for annotating feedback). */
  async completedUrls(candidateId: string): Promise<Set<string>> {
    const rows = await this.repo.find({
      where: { candidateId },
      select: { resourceUrl: true },
    });
    return new Set(rows.map((r) => r.resourceUrl));
  }

  /**
   * Toggle a resource's completion for the candidate. Idempotent: marking an
   * already-completed resource (or clearing an absent one) is a no-op, so a
   * double-click never errors and never creates duplicates (the unique
   * constraint is the backstop).
   */
  async setCompleted(
    candidateId: string,
    resourceUrl: string,
    completed: boolean,
  ): Promise<void> {
    if (completed) {
      await this.repo
        .createQueryBuilder()
        .insert()
        .values({ candidateId, resourceUrl })
        .orIgnore()
        .execute();
    } else {
      await this.repo.delete({ candidateId, resourceUrl });
    }
  }
}
