import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LinkAccessibilityStatus,
  ProfileLink,
} from './entities/profile-link.entity.js';
import { LINK_PROBER } from '../../ports/link-prober.port.js';
import type { LinkProber } from '../../ports/link-prober.port.js';

// EF-CAND-04 — domain logic for verifying one link's accessibility. Kept as a
// plain injectable (no BullMQ coupling) so it can be unit-tested by calling
// `verify()` directly; the LinkVerificationProcessor is a thin worker adapter
// over it, mirroring the sweep services elsewhere in the codebase.
@Injectable()
export class LinkVerificationService {
  private readonly logger = new Logger(LinkVerificationService.name);

  constructor(
    @InjectRepository(ProfileLink)
    private readonly linkRepo: Repository<ProfileLink>,
    @Inject(LINK_PROBER)
    private readonly prober: LinkProber,
  ) {}

  /**
   * Probe the link's URL and persist the outcome. Idempotent: a link that no
   * longer exists (deleted between enqueue and processing) is a no-op, so a
   * retried or stale job never throws.
   */
  async verify(linkId: string): Promise<LinkAccessibilityStatus | null> {
    const link = await this.linkRepo.findOne({ where: { id: linkId } });
    if (!link) {
      this.logger.debug(`Link ${linkId} gone before verification — skipping`);
      return null;
    }

    const result = await this.prober.probe(link.url);
    const status = result.reachable
      ? LinkAccessibilityStatus.REACHABLE
      : LinkAccessibilityStatus.UNREACHABLE;

    // Owner-scoped by construction (id is the PK); write only the two fields we
    // own so we never clobber a concurrent profile edit.
    await this.linkRepo.update(
      { id: linkId },
      { accessibilityStatus: status, checkedAt: new Date() },
    );

    this.logger.log(
      `Link ${linkId} verified: ${status}` +
        (result.statusCode ? ` (HTTP ${result.statusCode})` : '') +
        (result.reason ? ` [${result.reason}]` : ''),
    );
    return status;
  }
}
