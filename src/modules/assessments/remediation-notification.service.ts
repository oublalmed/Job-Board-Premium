import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { SettingsService } from '../settings/settings.service.js';
import { UsersService } from '../users/users.service.js';
import { GrowthNotificationService } from '../notifications/growth-notification.service.js';
import { COOLDOWN_SETTINGS_KEY, DEFAULT_COOLDOWN_DAYS } from './cooldown.js';

@Injectable()
export class RemediationNotificationService {
  private readonly logger = new Logger(RemediationNotificationService.name);

  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
    private readonly growthNotificationService: GrowthNotificationService,
  ) {}

  // The BullMQ processor (CooldownNotificationProcessor) delegates all its
  // work here — kept as a plain injectable service, not logic embedded in
  // the processor, specifically so tests can call it directly without
  // depending on real BullMQ scheduling/workers.
  //
  // Uniqueness is NOT "trust the repeatable job fires once a day" — it's
  // the atomic claim inside the loop (see claimCooldownNotification below).
  // That's what keeps a candidate notified exactly once even if this same
  // sweep is retried after a crash, or if two instances happen to run it
  // concurrently — either case would otherwise double-notify without it.
  async runCooldownSweep(): Promise<{ notifiedCount: number }> {
    const cooldownDays =
      (await this.settingsService.getNumber(COOLDOWN_SETTINGS_KEY)) ??
      DEFAULT_COOLDOWN_DAYS;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cooldownDays);

    const candidates = await this.assessmentRepo.find({
      where: {
        status: AssessmentStatus.COMPLETED,
        completedAt: LessThanOrEqual(cutoff),
        cooldownNotifiedAt: IsNull(),
      },
    });

    let notifiedCount = 0;

    for (const assessment of candidates) {
      const claimed = await this.claimCooldownNotification(assessment.id);
      if (!claimed) {
        // Already claimed by a concurrent run/retry — not an error, just
        // nothing left to do for this row.
        continue;
      }

      const candidate = await this.usersService.findById(assessment.candidateId);
      if (!candidate) {
        this.logger.warn(
          `Cooldown sweep: no user found for candidateId ${assessment.candidateId} (assessment ${assessment.id})`,
        );
        continue;
      }

      await this.growthNotificationService.notifyCooldownExpired({
        recipientUserId: candidate.id,
        email: candidate.email,
      });
      notifiedCount++;
    }

    return { notifiedCount };
  }

  // Atomic conditional UPDATE, not a read-then-write — same family as
  // ContactQuotaService.consumeOneContact / allocateInvoiceNumber. Returns
  // true only for the caller that actually flipped the marker from NULL.
  private async claimCooldownNotification(assessmentId: string): Promise<boolean> {
    const result = await this.assessmentRepo
      .createQueryBuilder()
      .update(Assessment)
      .set({ cooldownNotifiedAt: () => 'now()' })
      .where('id = :id', { id: assessmentId })
      .andWhere('cooldown_notified_at IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
