import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experience } from './entities/experience.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import type { CreateExperienceDto } from './dto/create-experience.dto.js';
import type { UpdateExperienceDto } from './dto/update-experience.dto.js';

@Injectable()
export class CandidateExperienceService {
  constructor(
    @InjectRepository(Experience)
    private readonly experienceRepo: Repository<Experience>,
    private readonly profileService: CandidateProfileService,
  ) {}

  async listMine(userId: string): Promise<Experience[]> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    return this.experienceRepo.find({
      where: { profileId: profile.id },
      order: { startDate: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateExperienceDto): Promise<Experience> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const experience = this.experienceRepo.create({
      profileId: profile.id,
      type: dto.type,
      title: dto.title,
      organization: dto.organization,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      description: dto.description ?? null,
    });
    const saved = await this.experienceRepo.save(experience);
    await this.profileService.calculateCompleteness(profile.id);
    return saved;
  }

  async update(
    userId: string,
    experienceId: string,
    dto: UpdateExperienceDto,
  ): Promise<Experience> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    // WHERE-scoped by (id, profileId) in the same query, never a load
    // then a JS-side ownership check — matches the isolation convention
    // fixed elsewhere in this repo (ADR-0001 / Lot 4 recette).
    const experience = await this.experienceRepo.findOne({
      where: { id: experienceId, profileId: profile.id },
    });
    if (!experience) {
      throw new NotFoundException('Experience not found');
    }

    Object.assign(experience, {
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.organization !== undefined && { organization: dto.organization }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate }),
      ...(dto.endDate !== undefined && { endDate: dto.endDate }),
      ...(dto.description !== undefined && { description: dto.description }),
    });

    const saved = await this.experienceRepo.save(experience);
    await this.profileService.calculateCompleteness(profile.id);
    return saved;
  }

  async remove(userId: string, experienceId: string): Promise<void> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const result = await this.experienceRepo.delete({
      id: experienceId,
      profileId: profile.id,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Experience not found');
    }
    await this.profileService.calculateCompleteness(profile.id);
  }
}
