import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CandidateExperienceService } from '../candidate-experience.service.js';
import { CandidateProfileService } from '../candidate-profile.service.js';
import { Experience, ExperienceType } from '../entities/experience.entity.js';

describe('CandidateExperienceService', () => {
  let service: CandidateExperienceService;
  let experienceRepo: Record<string, jest.Mock>;
  let profileService: Record<string, jest.Mock>;

  const userId = 'user-1';
  const profile = { id: 'profile-1', userId };

  beforeEach(async () => {
    experienceRepo = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: 'exp-1', ...data })),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    profileService = {
      findOrCreateProfile: jest.fn().mockResolvedValue(profile),
      calculateCompleteness: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateExperienceService,
        { provide: getRepositoryToken(Experience), useValue: experienceRepo },
        { provide: CandidateProfileService, useValue: profileService },
      ],
    }).compile();

    service = module.get(CandidateExperienceService);
  });

  it('creates an experience scoped to the resolved profile and recalculates completeness', async () => {
    const dto = {
      type: ExperienceType.WORK,
      title: 'Dev',
      organization: 'Acme',
      startDate: '2020-01-01',
    };

    await service.create(userId, dto);

    expect(experienceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'profile-1', title: 'Dev' }),
    );
    expect(profileService.calculateCompleteness).toHaveBeenCalledWith(
      'profile-1',
    );
  });

  it('scopes update by (id, profileId) in a single query, never load-then-check', async () => {
    experienceRepo.findOne.mockResolvedValue({
      id: 'exp-1',
      profileId: 'profile-1',
    });

    await service.update(userId, 'exp-1', { title: 'New title' });

    expect(experienceRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'exp-1', profileId: 'profile-1' },
    });
  });

  it('throws NotFoundException updating an experience belonging to another profile', async () => {
    experienceRepo.findOne.mockResolvedValue(null);

    await expect(
      service.update(userId, 'someone-elses-exp', { title: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException deleting an experience belonging to another profile', async () => {
    experienceRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(service.remove(userId, 'someone-elses-exp')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes scoped by (id, profileId) and recalculates completeness on success', async () => {
    experienceRepo.delete.mockResolvedValue({ affected: 1 });

    await service.remove(userId, 'exp-1');

    expect(experienceRepo.delete).toHaveBeenCalledWith({
      id: 'exp-1',
      profileId: 'profile-1',
    });
    expect(profileService.calculateCompleteness).toHaveBeenCalledWith(
      'profile-1',
    );
  });
});
