import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CandidateProfileService } from '../candidate-profile.service.js';
import { CandidateProfile } from '../entities/candidate-profile.entity.js';
import { ProfileSkill } from '../entities/profile-skill.entity.js';
import { Experience } from '../entities/experience.entity.js';
import { ProfileLink } from '../entities/profile-link.entity.js';
import { Document } from '../entities/document.entity.js';
import { SettingsService } from '../../settings/settings.service.js';

// EF-CAND-05 — focused coverage of the salary-range guard in updateProfile.
describe('CandidateProfileService — salary range (EF-CAND-05)', () => {
  let service: CandidateProfileService;
  let profileRepo: Record<string, jest.Mock>;

  const baseProfile = {
    id: 'p1',
    indexedInCvtheque: true,
    salaryMin: null,
    salaryMax: null,
  };

  beforeEach(async () => {
    profileRepo = {
      findOne: jest.fn().mockResolvedValue({ ...baseProfile }),
      save: jest.fn().mockImplementation((p: unknown) => Promise.resolve(p)),
      count: jest.fn().mockResolvedValue(0),
    };
    const noop = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateProfileService,
        { provide: getRepositoryToken(CandidateProfile), useValue: profileRepo },
        { provide: getRepositoryToken(ProfileSkill), useValue: noop },
        { provide: getRepositoryToken(Experience), useValue: noop },
        { provide: getRepositoryToken(ProfileLink), useValue: noop },
        { provide: getRepositoryToken(Document), useValue: noop },
        {
          provide: SettingsService,
          useValue: { getNumber: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(CandidateProfileService);
  });

  it('rejects a range whose minimum exceeds its maximum', async () => {
    await expect(
      service.updateProfile('p1', { salaryMin: 500000, salaryMax: 300000 }),
    ).rejects.toThrow(BadRequestException);
    expect(profileRepo.save).not.toHaveBeenCalled();
  });

  it('validates a partial update against the stored bound', async () => {
    profileRepo.findOne.mockResolvedValue({
      ...baseProfile,
      salaryMax: 200000,
    });
    // only min provided, and it exceeds the stored max → rejected
    await expect(
      service.updateProfile('p1', { salaryMin: 300000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a coherent range and persists it', async () => {
    const saved = await service.updateProfile('p1', {
      salaryMin: 300000,
      salaryMax: 450000,
      salaryCurrency: 'MAD',
      salaryVisible: false,
    });
    expect(saved).toEqual(
      expect.objectContaining({
        salaryMin: 300000,
        salaryMax: 450000,
        salaryVisible: false,
      }),
    );
  });
});
