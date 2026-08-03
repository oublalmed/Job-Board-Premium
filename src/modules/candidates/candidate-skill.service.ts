import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Skill } from './entities/skill.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import { isUniqueViolation } from '../../common/typeorm/is-unique-violation.js';
import type { AddProfileSkillDto } from './dto/add-profile-skill.dto.js';

export interface ProfileSkillSummary {
  id: string;
  skillId: string;
  name: string;
  category: string | null;
  level: string | null;
}

@Injectable()
export class CandidateSkillService {
  constructor(
    @InjectRepository(ProfileSkill)
    private readonly profileSkillRepo: Repository<ProfileSkill>,
    @InjectRepository(Skill)
    private readonly skillRepo: Repository<Skill>,
    private readonly profileService: CandidateProfileService,
  ) {}

  async listMine(userId: string): Promise<ProfileSkillSummary[]> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const entries = await this.profileSkillRepo.find({
      where: { profileId: profile.id },
      relations: { skill: true },
      order: { createdAt: 'ASC' },
    });
    return entries.map((e) => ({
      id: e.id,
      skillId: e.skillId,
      name: e.skill.name,
      category: e.skill.category,
      level: e.level,
    }));
  }

  async add(
    userId: string,
    dto: AddProfileSkillDto,
  ): Promise<ProfileSkillSummary> {
    const profile = await this.profileService.findOrCreateProfile(userId);

    const skill = await this.skillRepo.findOne({
      where: { id: dto.skillId, active: true },
    });
    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    const entry = this.profileSkillRepo.create({
      profileId: profile.id,
      skillId: dto.skillId,
      level: dto.level ?? null,
    });

    let saved: ProfileSkill;
    try {
      saved = await this.profileSkillRepo.save(entry);
    } catch (error) {
      // Single unique constraint reachable on this table
      // (profileId, skillId) — no ambiguity to discriminate by name.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Skill already added to this profile');
      }
      throw error;
    }

    await this.profileService.calculateCompleteness(profile.id);

    return {
      id: saved.id,
      skillId: skill.id,
      name: skill.name,
      category: skill.category,
      level: saved.level,
    };
  }

  async remove(userId: string, profileSkillId: string): Promise<void> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const result = await this.profileSkillRepo.delete({
      id: profileSkillId,
      profileId: profile.id,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Skill entry not found');
    }
    await this.profileService.calculateCompleteness(profile.id);
  }
}
