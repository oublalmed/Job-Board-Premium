import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileLink } from './entities/profile-link.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import type { CreateProfileLinkDto } from './dto/create-profile-link.dto.js';

@Injectable()
export class CandidateLinkService {
  constructor(
    @InjectRepository(ProfileLink)
    private readonly linkRepo: Repository<ProfileLink>,
    private readonly profileService: CandidateProfileService,
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
}
