import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CandidateProfile,
  ProfileModerationStatus,
  ProfileVisibility,
} from './entities/candidate-profile.entity.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';

export interface ModeratedProfileView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  visibility: ProfileVisibility;
  moderationStatus: ProfileModerationStatus;
  createdAt: string;
}

// EF-ADM-01 — admin moderation of candidate profiles: list them (optionally by
// moderation status) and suspend/reinstate one. Suspension is admin-owned and
// distinct from the candidate's own visibility: it forces the profile out of
// the CVthèque (SearchService filters moderationStatus = active) and pins
// visibility to HIDDEN so the candidate cannot re-surface a suspended profile.
@Injectable()
export class ProfileModerationService {
  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    private readonly auditService: AuditService,
  ) {}

  async list(options: {
    status?: ProfileModerationStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ModeratedProfileView[]; total: number }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const [rows, total] = await this.profileRepo.findAndCount({
      where: options.status ? { moderationStatus: options.status } : {},
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items: rows.map((p) => this.toView(p)), total };
  }

  async setModeration(
    profileId: string,
    status: ProfileModerationStatus,
    moderatorUserId: string,
  ): Promise<ModeratedProfileView> {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }

    profile.moderationStatus = status;
    // Suspending also hides the profile; reinstating leaves the candidate's own
    // visibility choice untouched (they can re-open it themselves).
    if (status === ProfileModerationStatus.SUSPENDED) {
      profile.visibility = ProfileVisibility.HIDDEN;
    }
    const saved = await this.profileRepo.save(profile);

    await this.auditService.log({
      actorId: moderatorUserId,
      action: AuditAction.MODERATION_ACTION,
      entityType: 'candidate_profile',
      entityId: profile.id,
      metadata: { kind: 'profile_moderation', status },
    });

    return this.toView(saved);
  }

  private toView(p: CandidateProfile): ModeratedProfileView {
    return {
      id: p.id,
      firstName: p.firstName ?? null,
      lastName: p.lastName ?? null,
      headline: p.headline ?? null,
      visibility: p.visibility,
      moderationStatus: p.moderationStatus,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
