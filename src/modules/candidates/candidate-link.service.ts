import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LinkAccessibilityStatus,
  ProfileLink,
} from './entities/profile-link.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import { LinkVerificationEnqueuer } from './link-verification-enqueuer.service.js';
import type { CreateProfileLinkDto } from './dto/create-profile-link.dto.js';

@Injectable()
export class CandidateLinkService {
  constructor(
    @InjectRepository(ProfileLink)
    private readonly linkRepo: Repository<ProfileLink>,
    private readonly profileService: CandidateProfileService,
    private readonly verificationEnqueuer: LinkVerificationEnqueuer,
  ) {}

  async listMine(userId: string): Promise<ProfileLink[]> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    return this.linkRepo.find({
      where: { profileId: profile.id },
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    userId: string,
    dto: CreateProfileLinkDto,
  ): Promise<ProfileLink> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const link = this.linkRepo.create({
      profileId: profile.id,
      type: dto.type,
      url: dto.url,
      label: dto.label ?? null,
    });
    const saved = await this.linkRepo.save(link);
    await this.profileService.calculateCompleteness(profile.id);
    // EF-CAND-04: kick off asynchronous accessibility verification. Best-effort
    // — the link is already persisted (status 'pending') regardless of broker
    // availability.
    await this.verificationEnqueuer.enqueue(saved.id);
    return saved;
  }

  async remove(userId: string, linkId: string): Promise<void> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const result = await this.linkRepo.delete({
      id: linkId,
      profileId: profile.id,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Link not found');
    }
    await this.profileService.calculateCompleteness(profile.id);
  }

  /**
   * EF-CAND-04 — re-run the accessibility check for one of the caller's links
   * (e.g. after they fixed a broken URL). Owner-scoped: a link that is not the
   * caller's is indistinguishable from a missing one (404). Resets the status
   * to 'pending' so the UI reflects that a fresh check is in flight.
   */
  async reverify(userId: string, linkId: string): Promise<ProfileLink> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const link = await this.linkRepo.findOne({
      where: { id: linkId, profileId: profile.id },
    });
    if (!link) {
      throw new NotFoundException('Link not found');
    }
    link.accessibilityStatus = LinkAccessibilityStatus.PENDING;
    link.checkedAt = null;
    const saved = await this.linkRepo.save(link);
    await this.verificationEnqueuer.enqueue(saved.id);
    return saved;
  }
}
