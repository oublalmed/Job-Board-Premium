import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IndexationService } from '../indexation.service.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import { Score, PlagiarismVerdict } from '../entities/score.entity.js';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity.js';
import { SettingsService } from '../../settings/settings.service.js';

describe('IndexationService', () => {
  let service: IndexationService;
  let profileRepo: Record<string, jest.Mock>;
  let scoreRepo: Record<string, jest.Mock>;
  let assessmentRepo: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;

  const candidateId = 'candidate-1';
  const profileId = 'profile-1';

  function makeProfile(overrides: Record<string, unknown> = {}) {
    return {
      id: profileId,
      userId: candidateId,
      indexedInCvtheque: false,
      featured: false,
      ...overrides,
    };
  }

  function makeScore(overrides: Record<string, unknown> = {}) {
    return {
      id: 'score-1',
      assessmentId: 'assessment-1',
      value: 50,
      percentile: 40,
      plagiarismVerdict: PlagiarismVerdict.CLEAN,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      ...overrides,
    };
  }

  function makeAssessment(overrides: Record<string, unknown> = {}) {
    return {
      id: 'assessment-1',
      candidateId,
      testId: 'test-1',
      status: AssessmentStatus.COMPLETED,
      ...overrides,
    };
  }

  beforeEach(async () => {
    profileRepo = {
      findOne: jest.fn().mockResolvedValue(makeProfile()),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
    };

    scoreRepo = {
      find: jest.fn().mockResolvedValue([makeScore()]),
    };

    assessmentRepo = {
      find: jest.fn().mockResolvedValue([makeAssessment()]),
    };

    settingsService = {
      getNumber: jest.fn().mockImplementation((key: string) => {
        if (key === 'indexation_score_min') return Promise.resolve(40);
        if (key === 'indexation_percentile_min') return Promise.resolve(30);
        if (key === 'featuring_percentile_min') return Promise.resolve(75);
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexationService,
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
        { provide: getRepositoryToken(Score), useValue: scoreRepo },
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get(IndexationService);
  });

  describe('US-EVAL-SEUIL — Scenario 1: indexation (score >= 40 OU percentile >= P30)', () => {
    it('should index candidate with score >= 40', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 55, percentile: 20 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: true }),
      );
    });

    it('should index candidate with percentile >= P30 even if score < 40', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 30, percentile: 35 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: true }),
      );
    });

    it('should NOT index candidate with score < 40 AND percentile < P30', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 25, percentile: 15 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: false }),
      );
    });

    it('should index candidate at exact threshold (score = 40)', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 40, percentile: 10 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: true }),
      );
    });

    it('should index candidate at exact percentile threshold (percentile = 30)', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 10, percentile: 30 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: true }),
      );
    });

    it('should read indexation thresholds from settings', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 50, percentile: 40 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(settingsService.getNumber).toHaveBeenCalledWith(
        'indexation_score_min',
      );
      expect(settingsService.getNumber).toHaveBeenCalledWith(
        'indexation_percentile_min',
      );
    });
  });

  describe('US-EVAL-SEUIL — Scenario 2: mise en avant (percentile >= P75)', () => {
    it('should feature candidate with percentile >= P75', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 90, percentile: 80 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ featured: true }),
      );
    });

    it('should NOT feature candidate with percentile < P75', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 60, percentile: 50 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ featured: false }),
      );
    });

    it('should feature at exact threshold (percentile = 75)', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 70, percentile: 75 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ featured: true }),
      );
    });

    it('should read featuring threshold from settings', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 90, percentile: 80 }),
      ]);

      await service.applyThresholds(candidateId);

      expect(settingsService.getNumber).toHaveBeenCalledWith(
        'featuring_percentile_min',
      );
    });
  });

  describe('US-EVAL-SEUIL — best score logic', () => {
    it('should use the best valid score across all assessments', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ id: 's1', value: 30, percentile: 20, assessmentId: 'a1' }),
        makeScore({ id: 's2', value: 70, percentile: 60, assessmentId: 'a2' }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: true }),
      );
    });

    it('should exclude expired scores', async () => {
      const expired = new Date(Date.now() - 1000);
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 90, percentile: 95, expiresAt: expired }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: false, featured: false }),
      );
    });

    it('should exclude scores with confirmed plagiarism', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({
          value: 90,
          percentile: 95,
          plagiarismVerdict: PlagiarismVerdict.CONFIRMED,
        }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: false, featured: false }),
      );
    });

    it('should allow scores with suspected plagiarism (not confirmed)', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({
          value: 90,
          percentile: 95,
          plagiarismVerdict: PlagiarismVerdict.SUSPECTED,
        }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: true }),
      );
    });
  });

  describe('US-EVAL-SEUIL — edge cases', () => {
    it('should de-index if no valid scores remain', async () => {
      profileRepo.findOne.mockResolvedValue(
        makeProfile({ indexedInCvtheque: true, featured: true }),
      );
      scoreRepo.find.mockResolvedValue([]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: false, featured: false }),
      );
    });

    it('should handle candidate with no profile gracefully', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyThresholds(candidateId),
      ).resolves.toBeUndefined();

      expect(profileRepo.save).not.toHaveBeenCalled();
    });

    it('should handle null percentile in score', async () => {
      scoreRepo.find.mockResolvedValue([
        makeScore({ value: 50, percentile: null }),
      ]);

      await service.applyThresholds(candidateId);

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ indexedInCvtheque: true, featured: false }),
      );
    });
  });
});
