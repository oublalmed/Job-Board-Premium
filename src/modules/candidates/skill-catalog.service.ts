import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from './entities/skill.entity.js';

export interface SkillSummary {
  id: string;
  name: string;
  category: string | null;
}

@Injectable()
export class SkillCatalogService {
  constructor(
    @InjectRepository(Skill)
    private readonly skillRepo: Repository<Skill>,
  ) {}

  async listSkills(): Promise<SkillSummary[]> {
    const skills = await this.skillRepo.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    return skills.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
    }));
  }
}
