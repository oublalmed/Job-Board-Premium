import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CandidateSkillService } from '../candidate-skill.service.js';
import { CandidateProfileService } from '../candidate-profile.service.js';
import { ProfileSkill } from '../entities/profile-skill.entity.js';
import { Skill } from '../entities/skill.entity.js';

describe('CandidateSkillService', () => {
  let service: CandidateSkillService;
  let profileSkillRepo: Record<string, jest.Mock>;
  let skillRepo: Record<string, jest.Mock>;
  let profileService: Record<string, jest.Mock>;

  const userId = 'user-1';
  const profile = { id: 'profile-1', userId };
  const skill = {
    id: 'skill-1',
    name: 'TypeScript',
    category: 'lang',
    active: true,
  };

  beforeEach(async () => {
    profileSkillRepo = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: 'ps-1', ...data })),
      delete: jest.fn(),
    };
    skillRepo = { findOne: jest.fn() };
    profileService = {
      findOrCreateProfile: jest.fn().mockResolvedValue(profile),
      calculateCompleteness: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateSkillService,
        {
          provide: getRepositoryToken(ProfileSkill),
          useValue: profileSkillRepo,
        },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: CandidateProfileService, useValue: profileService },
      ],
    }).compile();

    service = module.get(CandidateSkillService);
  });

  it('rejects a skillId that does not exist or is inactive', async () => {
    skillRepo.findOne.mockResolvedValue(null);

    await expect(service.add(userId, { skillId: 'bogus' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('attaches a valid skill and recalculates completeness', async () => {
    skillRepo.findOne.mockResolvedValue(skill);

    const result = await service.add(userId, {
      skillId: 'skill-1',
      level: 'expert',
    });

    expect(profileSkillRepo.create).toHaveBeenCalledWith({
      profileId: 'profile-1',
      skillId: 'skill-1',
      level: 'expert',
    });
    expect(result).toEqual({
      id: 'ps-1',
      skillId: 'skill-1',
      name: 'TypeScript',
      category: 'lang',
      level: 'expert',
    });
    expect(profileService.calculateCompleteness).toHaveBeenCalledWith(
      'profile-1',
    );
  });

  it('translates a duplicate (profileId, skillId) unique violation into 409, not a raw DB error', async () => {
    skillRepo.findOne.mockResolvedValue(skill);
    const dbError = new QueryFailedError('INSERT ...', undefined, {
      code: '23505',
      message: 'duplicate key',
    } as unknown as Error);
    profileSkillRepo.save.mockRejectedValue(dbError);

    await expect(service.add(userId, { skillId: 'skill-1' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('rethrows a non-unique-violation DB error unchanged', async () => {
    skillRepo.findOne.mockResolvedValue(skill);
    const dbError = new QueryFailedError('INSERT ...', undefined, {
      code: '23503',
      message: 'fk violation',
    } as unknown as Error);
    profileSkillRepo.save.mockRejectedValue(dbError);

    await expect(service.add(userId, { skillId: 'skill-1' })).rejects.toThrow(
      QueryFailedError,
    );
  });

  it('throws NotFoundException removing a skill entry belonging to another profile', async () => {
    profileSkillRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(service.remove(userId, 'someone-elses-entry')).rejects.toThrow(
      NotFoundException,
    );
  });
});
