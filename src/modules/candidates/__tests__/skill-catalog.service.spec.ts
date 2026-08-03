import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SkillCatalogService } from '../skill-catalog.service.js';
import { Skill } from '../entities/skill.entity.js';

describe('SkillCatalogService', () => {
  let service: SkillCatalogService;
  let skillRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    skillRepo = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillCatalogService,
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
      ],
    }).compile();

    service = module.get(SkillCatalogService);
  });

  it('returns only active skills, mapped to a summary shape', async () => {
    skillRepo.find.mockResolvedValue([
      { id: 's1', name: 'TypeScript', category: 'lang', active: true },
    ]);

    const result = await service.listSkills();

    expect(skillRepo.find).toHaveBeenCalledWith({
      where: { active: true },
      order: { name: 'ASC' },
    });
    expect(result).toEqual([
      { id: 's1', name: 'TypeScript', category: 'lang' },
    ]);
  });
});
