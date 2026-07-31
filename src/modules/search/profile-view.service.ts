import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { CandidateProfileView } from './entities/candidate-profile-view.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { GrowthNotificationService } from '../notifications/growth-notification.service.js';
import { UsersService } from '../users/users.service.js';
import { DEFAULT_PROFILE_VIEW_NOTIFICATION_COOLDOWN_HOURS } from './profile-view.constants.js';

// EF-GROW-04. Two independent concerns, deliberately not coupled:
//  - recording a view (CandidateProfileView) — unconditional, every call,
//    the audit trail.
//  - deciding whether to notify (ProfileViewCooldown) — an atomic
//    UPSERT ... ON CONFLICT ... DO UPDATE ... WHERE claim, same "claim via
//    conditional write, not read-then-write" family as
//    ContactQuotaService/RemediationNotificationService. N views by the
//    same recruiter on the same candidate inside the cooldown window
//    always produce exactly one notification, proven under real
//    concurrency in profile-view.service.spec.ts / the e2e suite.
@Injectable()
export class ProfileViewService {
  private readonly logger = new Logger(ProfileViewService.name);

  constructor(
    @InjectRepository(CandidateProfileView)
    private readonly viewRepo: Repository<CandidateProfileView>,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepo: Repository<CandidateProfile>,
    private readonly dataSource: DataSource,
    private readonly growthNotificationService: GrowthNotificationService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async recordView(
    recruiterUserId: string,
    companyId: string,
    candidateProfileId: string,
  ): Promise<void> {
    await this.viewRepo.save(
      this.viewRepo.create({
        recruiterId: recruiterUserId,
        candidateProfileId,
        companyId,
      }),
    );

    const claimed = await this.claimNotification(
      recruiterUserId,
      candidateProfileId,
    );
    if (!claimed) {
      return;
    }

    const candidateProfile = await this.candidateProfileRepo.findOne({
      where: { id: candidateProfileId },
    });
    if (!candidateProfile) {
      return;
    }
    const candidate = await this.usersService.findById(
      candidateProfile.userId,
    );
    if (!candidate) {
      this.logger.warn(
        `Profile view: no user found for candidateProfile ${candidateProfileId}`,
      );
      return;
    }

    await this.growthNotificationService.notifyProfileViewed({
      recipientUserId: candidate.id,
      email: candidate.email,
    });
  }

  // Atomic conditional UPSERT — never a SELECT then INSERT/UPDATE. The
  // WHERE clause on the DO UPDATE branch is what makes this a claim rather
  // than a plain upsert: a row returned means this call is the one that
  // "won" the right to notify for this window: either the pair never
  // existed (first view ever), or it existed but its last notification was
  // outside the cooldown window. Nothing returned means someone already
  // claimed this window — record the view, skip the notification.
  private async claimNotification(
    recruiterUserId: string,
    candidateProfileId: string,
  ): Promise<boolean> {
    const windowHours = this.configService.get<number>(
      'business.profileViewNotificationCooldownHours',
      DEFAULT_PROFILE_VIEW_NOTIFICATION_COOLDOWN_HOURS,
    );

    const result = await this.dataSource.query<Array<{ id: string }>>(
      `INSERT INTO profile_view_cooldowns (recruiter_id, candidate_profile_id, last_notified_at)
       VALUES ($1, $2, now())
       ON CONFLICT ON CONSTRAINT "UQ_profile_view_cooldowns_recruiter_candidate"
       DO UPDATE SET last_notified_at = now()
       WHERE profile_view_cooldowns.last_notified_at < now() - ($3 || ' hours')::interval
       RETURNING id`,
      [recruiterUserId, candidateProfileId, windowHours],
    );

    return result.length > 0;
  }
}
