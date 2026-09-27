import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity.js';
import { RefreshToken } from '../users/entities/refresh-token.entity.js';
import { ProfileViewCooldown } from '../search/entities/profile-view-cooldown.entity.js';
import { ProcessedWebhookEvent } from '../billing/entities/processed-webhook-event.entity.js';

export interface RetentionSweepResult {
  deletedNotifications: number;
  deletedRefreshTokens: number;
  deletedProfileViewCooldowns: number;
  deletedWebhookEvents: number;
  // The notification cutoff, kept in the result for backwards compatibility
  // with the processor's log line.
  cutoff: string;
}

// ENF-12 — enforce the data-retention policy across the transient record
// types. Each type has its own window (see business.config.ts). Records that
// carry their own regulatory/product retention — the audit log, invoices,
// data-requests, and the EF-GROW-04 profile-view *audit trail*
// (candidate_profile_views, explicitly "never deleted") — are deliberately
// NOT touched here: purging them would breach, not honour, the retention
// obligation. What is purged is genuinely transient:
//   • read notifications past their window (UX ephemera, once acknowledged);
//   • dead refresh tokens (revoked or expired) — session hygiene; a live
//     session is kept regardless of age;
//   • stale profile-view anti-spam cooldown rows — the 24h claim window is
//     long gone, so removing them is behaviourally inert;
//   • processed-webhook idempotency markers — safe well past the payment
//     provider's redelivery horizon (the business-level guards still hold).
//
// Each purge is independent and best-effort: a failure in one is logged and
// does not strand the others, and the daily schedule retries next run.
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(ProfileViewCooldown)
    private readonly cooldownRepo: Repository<ProfileViewCooldown>,
    @InjectRepository(ProcessedWebhookEvent)
    private readonly webhookEventRepo: Repository<ProcessedWebhookEvent>,
    private readonly configService: ConfigService,
  ) {}

  async sweep(): Promise<RetentionSweepResult> {
    const notificationCutoff = this.cutoffFor('notificationRetentionDays', 90);
    const now = new Date();

    // Only READ notifications older than the window — an unread notification
    // is still actionable and is never purged regardless of age.
    const deletedNotifications = await this.purge('read notifications', () =>
      this.notificationRepo
        .createQueryBuilder()
        .delete()
        .where('read_at IS NOT NULL')
        .andWhere('created_at < :cutoff', { cutoff: notificationCutoff })
        .execute(),
    );

    // Dead refresh tokens: revoked, or past expiry — and older than the
    // window (recent dead tokens are kept briefly for rotation-chain
    // forensics). Live sessions (not revoked, not expired) are never purged.
    const deletedRefreshTokens = await this.purge('dead refresh tokens', () =>
      this.refreshTokenRepo
        .createQueryBuilder()
        .delete()
        .where('created_at < :cutoff', {
          cutoff: this.cutoffFor('refreshTokenRetentionDays', 30),
        })
        .andWhere('(revoked = true OR expires_at < :now)', { now })
        .execute(),
    );

    // Stale anti-spam cooldown rows — past the retention window they no longer
    // suppress any notification (the claim window is 24h), so removal is inert.
    const deletedProfileViewCooldowns = await this.purge(
      'stale profile-view cooldowns',
      () =>
        this.cooldownRepo
          .createQueryBuilder()
          .delete()
          .where('last_notified_at < :cutoff', {
            cutoff: this.cutoffFor('profileViewCooldownRetentionDays', 30),
          })
          .execute(),
    );

    // Processed-webhook idempotency markers, safe to drop well beyond the
    // provider's redelivery horizon.
    const deletedWebhookEvents = await this.purge(
      'processed webhook events',
      () =>
        this.webhookEventRepo
          .createQueryBuilder()
          .delete()
          .where('processed_at < :cutoff', {
            cutoff: this.cutoffFor('webhookEventRetentionDays', 90),
          })
          .execute(),
    );

    this.logger.log(
      `Retention sweep: purged ${deletedNotifications} read notification(s), ` +
        `${deletedRefreshTokens} dead refresh token(s), ` +
        `${deletedProfileViewCooldowns} stale view-cooldown(s), ` +
        `${deletedWebhookEvents} webhook marker(s)`,
    );

    return {
      deletedNotifications,
      deletedRefreshTokens,
      deletedProfileViewCooldowns,
      deletedWebhookEvents,
      cutoff: notificationCutoff.toISOString(),
    };
  }

  private cutoffFor(configKey: string, fallbackDays: number): Date {
    const days = this.configService.get<number>(
      `business.${configKey}`,
      fallbackDays,
    );
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private async purge(
    label: string,
    run: () => Promise<{ affected?: number | null }>,
  ): Promise<number> {
    try {
      const result = await run();
      return result.affected ?? 0;
    } catch (err) {
      this.logger.warn(
        `Retention purge of ${label} failed (will retry next run): ${
          (err as Error).message
        }`,
      );
      return 0;
    }
  }
}
