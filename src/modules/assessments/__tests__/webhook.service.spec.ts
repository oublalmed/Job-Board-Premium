import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WebhookService } from '../webhook.service.js';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity.js';
import { Score, PlagiarismVerdict } from '../entities/score.entity.js';
import { Test as TestEntity } from '../entities/test.entity.js';
import { SCORING_PROVIDER } from '../../../ports/scoring.port.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';
import { IndexationService } from '../indexation.service.js';

describe('WebhookService', () => {
  let service: WebhookService;
  let assessmentRepo: Record<string, jest.Mock>;
  let scoreRepo: Record<string, jest.Mock>;
  let testRepo: Record<string, jest.Mock>;
  let scoringProvider: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;
  let indexationService: Record<string, jest.Mock>;

  const externalId = 'ext-123';
  const assessmentId = 'assessment-1';
  const candidateId = 'candidate-1';
  const testId = 'test-1';

  const mockAssessment = {
    id: assessmentId,
    candidateId,
    testId,
    externalAssessmentId: externalId,
    status: AssessmentStatus.IN_PROGRESS,
    startedAt: new Date(),
  };

  const mockTest: Partial<TestEntity> = {
    id: testId,
    version: '2.1',
    durationMinutes: 60,
    active: true,
    specialtyId: 'specialty-1',
  };

  const mockResult = {
    externalId,
    score: 78,
    maxScore: 100,
    percentile: 65,
    plagiarismVerdict: 'clean' as const,
    details: { sections: [{ name: 'algo', score: 80 }] },
  };

  const validPayload = Buffer.from(JSON.stringify({ externalId }));
  const validSignature = 'valid-sig';

  beforeEach(async () => {
    assessmentRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockAssessment }),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
    };

    scoreRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => ({
        id: 'score-1',
        createdAt: new Date(),
        ...e,
      })),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
    };

    testRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockTest }),
    };

    scoringProvider = {
      verifyWebhookSignature: jest.fn().mockResolvedValue({
        valid: true,
        externalId,
      }),
      getResult: jest.fn().mockResolvedValue(mockResult),
    };

    settingsService = {
      getNumber: jest.fn().mockImplementation((key: string) => {
        if (key === 'score_validity_days') return Promise.resolve(365);
        if (key === 'score_bareme_version_default')
          return Promise.resolve(null);
        return Promise.resolve(null);
      }),
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'score_bareme_version') return Promise.resolve('v1.0');
        return Promise.resolve(null);
      }),
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    indexationService = {
      applyThresholds: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
        { provide: getRepositoryToken(Score), useValue: scoreRepo },
        { provide: getRepositoryToken(TestEntity), useValue: testRepo },
        { provide: SCORING_PROVIDER, useValue: scoringProvider },
        { provide: SettingsService, useValue: settingsService },
        { provide: AuditService, useValue: auditService },
        { provide: IndexationService, useValue: indexationService },
      ],
    }).compile();

    service = module.get(WebhookService);
  });

  describe('US-EVAL-03 — Scenario 1: score nominal via webhook', () => {
    it('should verify webhook signature via ScoringProvider', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(scoringProvider.verifyWebhookSignature).toHaveBeenCalledWith(
        validPayload,
        validSignature,
      );
    });

    it('should reject if signature verification fails', async () => {
      scoringProvider.verifyWebhookSignature.mockResolvedValue({
        valid: false,
        externalId: null,
      });

      await expect(
        service.processWebhook(validPayload, 'bad-sig'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should fetch result from ScoringProvider', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(scoringProvider.getResult).toHaveBeenCalledWith(externalId);
    });

    it('should normalize score to 0-100 range', async () => {
      scoringProvider.getResult.mockResolvedValue({
        ...mockResult,
        score: 156,
        maxScore: 200,
      });

      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ value: 78 }),
      );
    });

    it('should persist score with percentile', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 78,
          percentile: 65,
        }),
      );
    });

    it('should persist baremeVersion from settings', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baremeVersion: 'v1.0',
        }),
      );
    });

    it('should persist testVersion from Test entity', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          testVersion: '2.1',
        }),
      );
    });

    it('should persist plagiarismVerdict from provider', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          plagiarismVerdict: PlagiarismVerdict.CLEAN,
        }),
      );
    });

    it('should persist suspected plagiarism verdict', async () => {
      scoringProvider.getResult.mockResolvedValue({
        ...mockResult,
        plagiarismVerdict: 'suspected',
      });

      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          plagiarismVerdict: PlagiarismVerdict.SUSPECTED,
        }),
      );
    });

    it('should compute expiresAt from score_validity_days setting', async () => {
      const before = new Date();
      await service.processWebhook(validPayload, validSignature);
      const after = new Date();

      const createCall = scoreRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const expiresAt = createCall['expiresAt'] as Date;
      const expectedMin = before.getTime() + 365 * 24 * 60 * 60 * 1000;
      const expectedMax = after.getTime() + 365 * 24 * 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should transition assessment to COMPLETED', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(assessmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AssessmentStatus.COMPLETED,
        }),
      );
    });

    it('should set completedAt on assessment', async () => {
      await service.processWebhook(validPayload, validSignature);

      const saveCall = assessmentRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saveCall['completedAt']).toBeDefined();
    });

    it('should log ASSESSMENT_COMPLETED in audit', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ASSESSMENT_COMPLETED,
          entityType: 'assessment',
          entityId: assessmentId,
        }),
      );
    });

    it('should log SCORE_CALCULATED in audit', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SCORE_CALCULATED,
          entityType: 'score',
        }),
      );
    });

    it('should persist details from provider result', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { sections: [{ name: 'algo', score: 80 }] },
        }),
      );
    });

    it('should apply indexation thresholds after score processing', async () => {
      await service.processWebhook(validPayload, validSignature);

      expect(indexationService.applyThresholds).toHaveBeenCalledWith(
        candidateId,
      );
    });
  });

  describe('US-EVAL-03 — Scenario 2: idempotence', () => {
    it('should not create duplicate score if one already exists', async () => {
      scoreRepo.findOne.mockResolvedValue({
        id: 'existing-score',
        assessmentId,
        value: 78,
      });

      const result = await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).not.toHaveBeenCalled();
      expect(scoreRepo.save).not.toHaveBeenCalled();
      expect(result.alreadyProcessed).toBe(true);
    });

    it('should not transition assessment again if already COMPLETED', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        ...mockAssessment,
        status: AssessmentStatus.COMPLETED,
      });
      scoreRepo.findOne.mockResolvedValue({
        id: 'existing-score',
        assessmentId,
        value: 78,
      });

      await service.processWebhook(validPayload, validSignature);

      expect(assessmentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('US-EVAL-03 — error cases', () => {
    it('should throw NotFoundException if assessment not found', async () => {
      assessmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.processWebhook(validPayload, validSignature),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if provider returns no result', async () => {
      scoringProvider.getResult.mockResolvedValue(null);

      await expect(
        service.processWebhook(validPayload, validSignature),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle score 0 correctly (edge case)', async () => {
      scoringProvider.getResult.mockResolvedValue({
        ...mockResult,
        score: 0,
        maxScore: 100,
      });

      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ value: 0 }),
      );
    });

    it('should handle score 100 correctly (edge case)', async () => {
      scoringProvider.getResult.mockResolvedValue({
        ...mockResult,
        score: 100,
        maxScore: 100,
      });

      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ value: 100 }),
      );
    });

    it('should handle null percentile from provider', async () => {
      scoringProvider.getResult.mockResolvedValue({
        ...mockResult,
        percentile: null,
      });

      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ percentile: null }),
      );
    });

    it('should use default baremeVersion if not in settings', async () => {
      settingsService.get.mockResolvedValue(null);

      await service.processWebhook(validPayload, validSignature);

      expect(scoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baremeVersion: expect.any(String),
        }),
      );
    });
  });
});
