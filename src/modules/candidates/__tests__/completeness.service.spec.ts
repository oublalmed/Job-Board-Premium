import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CandidateProfileService } from '../candidate-profile.service.js';
import { CandidateProfile } from '../entities/candidate-profile.entity.js';
import { ProfileSkill } from '../entities/profile-skill.entity.js';
import { Experience } from '../entities/experience.entity.js';
import { ProfileLink } from '../entities/profile-link.entity.js';
import {
  Document,
  DocumentType,
  ScanStatus,
} from '../entities/document.entity.js';
import { SettingsService } from '../../settings/settings.service.js';

describe('CandidateProfileService — completeness calculation', () => {
  let service: CandidateProfileService;
  let profileRepo: Record<string, jest.Mock>;
  let skillRepo: Record<string, jest.Mock>;
  let experienceRepo: Record<string, jest.Mock>;
  let linkRepo: Record<string, jest.Mock>;
  let documentRepo: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;

  const profileId = 'profile-1';
  const userId = 'user-1';

  const defaultWeights = {
    completeness_weight_identity: '15',
    completeness_weight_experience: '20',
    completeness_weight_skills: '20',
    completeness_weight_cv: '15',
    completeness_weight_links: '15',
    completeness_weight_school: '15',
    completeness_threshold_publishable: '70',
    completeness_min_skills: '5',
  };

  beforeEach(async () => {
    profileRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
      create: jest.fn().mockImplementation((e: any) => e),
    };
    skillRepo = { count: jest.fn().mockResolvedValue(0) };
    experienceRepo = { count: jest.fn().mockResolvedValue(0) };
    linkRepo = { count: jest.fn().mockResolvedValue(0) };
    documentRepo = { findOne: jest.fn().mockResolvedValue(null) };
    settingsService = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          Promise.resolve(
            defaultWeights[key as keyof typeof defaultWeights] ?? null,
          ),
        ),
      getNumber: jest.fn().mockImplementation((key: string) => {
        const val = defaultWeights[key as keyof typeof defaultWeights];
        return Promise.resolve(val ? Number(val) : null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateProfileService,
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
        { provide: getRepositoryToken(ProfileSkill), useValue: skillRepo },
        { provide: getRepositoryToken(Experience), useValue: experienceRepo },
        { provide: getRepositoryToken(ProfileLink), useValue: linkRepo },
        { provide: getRepositoryToken(Document), useValue: documentRepo },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get(CandidateProfileService);
  });

  const baseProfile: Partial<CandidateProfile> = {
    id: profileId,
    userId,
    firstName: null,
    lastName: null,
    headline: null,
    bio: null,
    school: null,
    completeness: 0,
  };

  describe('calculateCompleteness', () => {
    it('should return 0% for a completely empty profile', async () => {
      profileRepo.findOne.mockResolvedValue({ ...baseProfile });

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(0);
      expect(result.isPublishable).toBe(false);
      expect(result.missing).toHaveLength(6);
    });

    it('should give 15% for identity (firstName + lastName + headline + bio)', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        firstName: 'Ahmed',
        lastName: 'Benali',
        headline: 'Dev Full Stack',
        bio: 'Experienced developer',
      });

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(15);
    });

    it('should give 20% for >= 1 experience', async () => {
      profileRepo.findOne.mockResolvedValue({ ...baseProfile });
      experienceRepo.count.mockResolvedValue(1);

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(20);
    });

    it('should give 20% for >= 5 skills', async () => {
      profileRepo.findOne.mockResolvedValue({ ...baseProfile });
      skillRepo.count.mockResolvedValue(5);

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(20);
    });

    it('should give 0% for < 5 skills', async () => {
      profileRepo.findOne.mockResolvedValue({ ...baseProfile });
      skillRepo.count.mockResolvedValue(4);

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(0);
    });

    it('should give 15% for CV uploaded and scanned clean', async () => {
      profileRepo.findOne.mockResolvedValue({ ...baseProfile });
      documentRepo.findOne.mockResolvedValue({
        id: 'doc-1',
        type: DocumentType.CV,
        scanStatus: ScanStatus.CLEAN,
      });

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(15);
    });

    it('should give 0% for CV with pending scan', async () => {
      profileRepo.findOne.mockResolvedValue({ ...baseProfile });
      // Service queries with scanStatus: CLEAN, so pending CV returns null
      documentRepo.findOne.mockResolvedValue(null);

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(0);
    });

    it('should give 15% for >= 1 external link', async () => {
      profileRepo.findOne.mockResolvedValue({ ...baseProfile });
      linkRepo.count.mockResolvedValue(1);

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(15);
    });

    it('should give 15% for school', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        school: 'ENSIAS',
      });

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(15);
    });

    it('should reach 100% for a fully completed profile', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        firstName: 'Ahmed',
        lastName: 'Benali',
        headline: 'Dev Full Stack',
        bio: 'Experienced',
        school: 'ENSIAS',
      });
      experienceRepo.count.mockResolvedValue(2);
      skillRepo.count.mockResolvedValue(7);
      documentRepo.findOne.mockResolvedValue({
        type: DocumentType.CV,
        scanStatus: ScanStatus.CLEAN,
      });
      linkRepo.count.mockResolvedValue(1);

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(100);
      expect(result.isPublishable).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should be publishable at exactly 70%', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        firstName: 'Ahmed',
        lastName: 'Benali',
        headline: 'Dev',
        bio: 'Bio',
      });
      experienceRepo.count.mockResolvedValue(1);
      skillRepo.count.mockResolvedValue(5);
      documentRepo.findOne.mockResolvedValue({
        type: DocumentType.CV,
        scanStatus: ScanStatus.CLEAN,
      });

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(70);
      expect(result.isPublishable).toBe(true);
    });

    it('should list missing elements with their weights', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        firstName: 'Ahmed',
        lastName: 'Benali',
        headline: 'Dev',
        bio: 'Bio',
      });

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(15);
      expect(result.missing).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'experience', weight: 20 }),
          expect.objectContaining({ key: 'skills', weight: 20 }),
          expect.objectContaining({ key: 'cv', weight: 15 }),
          expect.objectContaining({ key: 'links', weight: 15 }),
          expect.objectContaining({ key: 'school', weight: 15 }),
        ]),
      );
    });

    it('should use custom weights from settings', async () => {
      settingsService.getNumber.mockImplementation((key: string) => {
        if (key === 'completeness_weight_identity') return Promise.resolve(30);
        if (key === 'completeness_weight_experience')
          return Promise.resolve(10);
        if (key === 'completeness_weight_skills') return Promise.resolve(10);
        if (key === 'completeness_weight_cv') return Promise.resolve(10);
        if (key === 'completeness_weight_links') return Promise.resolve(10);
        if (key === 'completeness_weight_school') return Promise.resolve(15);
        if (key === 'completeness_threshold_publishable')
          return Promise.resolve(70);
        if (key === 'completeness_min_skills') return Promise.resolve(5);
        return Promise.resolve(null);
      });

      profileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        firstName: 'Ahmed',
        lastName: 'Benali',
        headline: 'Dev',
        bio: 'Bio',
      });

      const result = await service.calculateCompleteness(profileId);

      expect(result.completeness).toBe(30);
    });

    it('should persist completeness on the profile', async () => {
      const profile = { ...baseProfile };
      profileRepo.findOne.mockResolvedValue(profile);

      await service.calculateCompleteness(profileId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ completeness: expect.any(Number) }),
      );
    });
  });
});
