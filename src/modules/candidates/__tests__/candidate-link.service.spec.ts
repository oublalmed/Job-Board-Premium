import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CandidateLinkService } from '../candidate-link.service.js';
import { CandidateProfileService } from '../candidate-profile.service.js';
import { ProfileLink, LinkType } from '../entities/profile-link.entity.js';

describe('CandidateLinkService', () => {
  let service: CandidateLinkService;
  let linkRepo: Record<string, jest.Mock>;
  let profileService: Record<string, jest.Mock>;

  const userId = 'user-1';
  const profile = { id: 'profile-1', userId };

  beforeEach(async () => {
    linkRepo = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: 'link-1', ...data })),
      delete: jest.fn(),
    };
    profileService = {
      findOrCreateProfile: jest.fn().mockResolvedValue(profile),
      calculateCompleteness: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateLinkService,
        { provide: getRepositoryToken(ProfileLink), useValue: linkRepo },
        { provide: CandidateProfileService, useValue: profileService },
      ],
    }).compile();

    service = module.get(CandidateLinkService);
  });

  it('creates a link scoped to the resolved profile and recalculates completeness', async () => {
    await service.create(userId, {
      type: LinkType.GITHUB,
      url: 'https://github.com/someone',
    });

    expect(linkRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-1',
        url: 'https://github.com/someone',
      }),
    );
    expect(profileService.calculateCompleteness).toHaveBeenCalledWith(
      'profile-1',
    );
  });

  it('throws NotFoundException deleting a link belonging to another profile', async () => {
    linkRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(service.remove(userId, 'someone-elses-link')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes scoped by (id, profileId)', async () => {
    linkRepo.delete.mockResolvedValue({ affected: 1 });

    await service.remove(userId, 'link-1');

    expect(linkRepo.delete).toHaveBeenCalledWith({
      id: 'link-1',
      profileId: 'profile-1',
    });
  });
});
