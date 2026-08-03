import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentService } from '../assessment.service.js';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity.js';
import { Test as TestEntity } from '../entities/test.entity.js';
import { SCORING_PROVIDER } from '../../../ports/scoring.port.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';

describe('AssessmentService', () => {
  let service: AssessmentService;
  let assessmentRepo: Record<string, jest.Mock>;
  let testRepo: Record<string, jest.Mock>;
  let scoringProvider: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const candidateId = 'candidate-1';
  const testId = 'test-1';
  const specialtyId = 'specialty-1';

  const mockTest: Partial<TestEntity> = {
    id: testId,
    specialtyId,
    version: '1.0',
    durationMinutes: 60,
    active: true,
  };

  function makeIncidentAssessment() {
    return {
      id: 'incident-assessment',
      candidateId,
      testId,
      status: AssessmentStatus.INCIDENT,
      resumeToken: 'valid-token',
      externalAssessmentId: 'ext-456',
      expiresAt: new Date(Date.now() + 3600000),
      startedAt: new Date(),
    };
  }

  beforeEach(async () => {
    assessmentRepo = {
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => ({
        id: 'assessment-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...e,
      })),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
      findOne: jest.fn().mockResolvedValue(null),
    };

    testRepo = {
      findOne: jest.fn().mockResolvedValue(mockTest),
    };

    scoringProvider = {
      createAssessment: jest.fn().mockResolvedValue({
        externalId: 'ext-123',
        assessmentUrl: 'https://scoring.local/test/ext-123',
      }),
      getResult: jest.fn().mockResolvedValue(null),
      cancelAssessment: jest.fn().mockResolvedValue(undefined),
      verifyWebhookSignature: jest.fn().mockResolvedValue({
        valid: true,
        externalId: null,
      }),
    };

    settingsService = {
      getNumber: jest.fn().mockImplementation((key: string) => {
        if (key === 'assessment_cooldown_days') return Promise.resolve(90);
        return Promise.resolve(null);
      }),
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        {
          provide: getRepositoryToken(Assessment),
          useValue: assessmentRepo,
        },
        {
          provide: getRepositoryToken(TestEntity),
          useValue: testRepo,
        },
        { provide: SCORING_PROVIDER, useValue: scoringProvider },
        { provide: SettingsService, useValue: settingsService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(AssessmentService);
  });

  describe('US-EVAL-02 — Scenario 1: passage nominal', () => {
    it('should create an assessment with IN_PROGRESS status, a resume token, and expiry', async () => {
      const result = await service.startAssessment(candidateId, testId);

      expect(result.assessment.status).toBe(AssessmentStatus.IN_PROGRESS);
      expect(result.assessment.resumeToken).toBeDefined();
      expect(result.assessment.expiresAt).toBeDefined();
      expect(result.assessment.candidateId).toBe(candidateId);
      expect(result.assessment.testId).toBe(testId);
    });

    it('should call ScoringProvider.createAssessment with correct params', async () => {
      await service.startAssessment(candidateId, testId);

      expect(scoringProvider.createAssessment).toHaveBeenCalledWith({
        candidateId,
        specialtyId,
        testId,
      });
    });

    it('should set external assessment ID from provider response', async () => {
      const result = await service.startAssessment(candidateId, testId);

      expect(result.assessment.externalAssessmentId).toBe('ext-123');
    });

    it('should return the assessment URL for the candidate', async () => {
      const result = await service.startAssessment(candidateId, testId);

      expect(result.assessmentUrl).toBe('https://scoring.local/test/ext-123');
    });

    it('should compute expiresAt from test.durationMinutes', async () => {
      const before = new Date();
      const result = await service.startAssessment(candidateId, testId);
      const after = new Date();

      const expiresAt = result.assessment.expiresAt!;
      const expectedMin = before.getTime() + 60 * 60 * 1000;
      const expectedMax = after.getTime() + 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should log ASSESSMENT_STARTED in audit', async () => {
      await service.startAssessment(candidateId, testId);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: candidateId,
          action: AuditAction.ASSESSMENT_STARTED,
          entityType: 'assessment',
        }),
      );
    });

    it('should persist the assessment via repository save', async () => {
      await service.startAssessment(candidateId, testId);

      expect(assessmentRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if test does not exist', async () => {
      testRepo.findOne.mockResolvedValue(null);

      await expect(
        service.startAssessment(candidateId, testId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if test is inactive', async () => {
      testRepo.findOne.mockResolvedValue({ ...mockTest, active: false });

      await expect(
        service.startAssessment(candidateId, testId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('US-EVAL-02 — Scenario 2: tentative bloquée (cooldown 90j)', () => {
    it('should reject if a completed assessment exists within cooldown', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);

      assessmentRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'prev-assessment',
        candidateId,
        testId,
        status: AssessmentStatus.COMPLETED,
        completedAt: recentDate,
      });

      await expect(
        service.startAssessment(candidateId, testId),
      ).rejects.toThrow(ConflictException);
    });

    it('should include re-eligibility date in rejection message', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      assessmentRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'prev-assessment',
        candidateId,
        testId,
        status: AssessmentStatus.COMPLETED,
        completedAt: thirtyDaysAgo,
      });

      try {
        await service.startAssessment(candidateId, testId);
        fail('Expected ConflictException');
      } catch (e: unknown) {
        const err = e as ConflictException;
        const response = err.getResponse() as Record<string, unknown>;
        expect(response['reEligibleAt']).toBeDefined();
      }
    });

    it('should read cooldown from settings (configurable)', async () => {
      await service.startAssessment(candidateId, testId);

      expect(settingsService.getNumber).toHaveBeenCalledWith(
        'assessment_cooldown_days',
      );
    });

    it('should allow if last completed assessment is beyond cooldown', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      assessmentRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'old-assessment',
        candidateId,
        testId,
        status: AssessmentStatus.COMPLETED,
        completedAt: oldDate,
      });

      const result = await service.startAssessment(candidateId, testId);
      expect(result.assessment).toBeDefined();
    });

    it('should reject if an assessment is currently IN_PROGRESS', async () => {
      assessmentRepo.findOne.mockResolvedValueOnce({
        id: 'active-assessment',
        candidateId,
        testId,
        status: AssessmentStatus.IN_PROGRESS,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await expect(
        service.startAssessment(candidateId, testId),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if an assessment is PENDING', async () => {
      assessmentRepo.findOne.mockResolvedValueOnce({
        id: 'pending-assessment',
        candidateId,
        testId,
        status: AssessmentStatus.PENDING,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await expect(
        service.startAssessment(candidateId, testId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('US-EVAL-02 — Scenario 3: incident technique', () => {
    it('should resume an incident assessment with valid token', async () => {
      assessmentRepo.findOne.mockResolvedValue(makeIncidentAssessment());

      const result = await service.resumeAssessment(
        candidateId,
        'incident-assessment',
        'valid-token',
      );

      expect(result.assessment.status).toBe(AssessmentStatus.IN_PROGRESS);
    });

    it('should generate a new resume token on resume', async () => {
      assessmentRepo.findOne.mockResolvedValue(makeIncidentAssessment());

      const result = await service.resumeAssessment(
        candidateId,
        'incident-assessment',
        'valid-token',
      );

      expect(result.assessment.resumeToken).toBeDefined();
      expect(result.assessment.resumeToken).not.toBe('valid-token');
    });

    it('should not consume an additional attempt on resume', async () => {
      assessmentRepo.findOne.mockResolvedValue(makeIncidentAssessment());

      await service.resumeAssessment(
        candidateId,
        'incident-assessment',
        'valid-token',
      );

      expect(scoringProvider.createAssessment).not.toHaveBeenCalled();
    });

    it('should log ASSESSMENT_RESUMED in audit', async () => {
      assessmentRepo.findOne.mockResolvedValue(makeIncidentAssessment());

      await service.resumeAssessment(
        candidateId,
        'incident-assessment',
        'valid-token',
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: candidateId,
          action: AuditAction.ASSESSMENT_RESUMED,
          entityType: 'assessment',
        }),
      );
    });

    it('should reject resume with invalid token', async () => {
      assessmentRepo.findOne.mockResolvedValue(makeIncidentAssessment());

      await expect(
        service.resumeAssessment(
          candidateId,
          'incident-assessment',
          'wrong-token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject resume if assessment is not in INCIDENT status', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        ...makeIncidentAssessment(),
        status: AssessmentStatus.COMPLETED,
      });

      await expect(
        service.resumeAssessment(
          candidateId,
          'incident-assessment',
          'valid-token',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject resume if assessment belongs to another candidate', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        ...makeIncidentAssessment(),
        candidateId: 'other-candidate',
      });

      await expect(
        service.resumeAssessment(
          candidateId,
          'incident-assessment',
          'valid-token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if assessment does not exist', async () => {
      assessmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resumeAssessment(candidateId, 'nonexistent', 'some-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reportIncident', () => {
    it('should transition IN_PROGRESS assessment to INCIDENT', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        id: 'assessment-1',
        candidateId,
        testId,
        status: AssessmentStatus.IN_PROGRESS,
        resumeToken: 'token-1',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await service.reportIncident(candidateId, 'assessment-1');

      expect(result.status).toBe(AssessmentStatus.INCIDENT);
    });

    it('should log ASSESSMENT_INCIDENT in audit', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        id: 'assessment-1',
        candidateId,
        status: AssessmentStatus.IN_PROGRESS,
        resumeToken: 'token-1',
        expiresAt: new Date(Date.now() + 3600000),
      });

      await service.reportIncident(candidateId, 'assessment-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ASSESSMENT_INCIDENT,
        }),
      );
    });

    it('should reject if assessment not IN_PROGRESS', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        id: 'assessment-1',
        candidateId,
        status: AssessmentStatus.COMPLETED,
      });

      await expect(
        service.reportIncident(candidateId, 'assessment-1'),
      ).rejects.toThrow(BadRequestException);
    });

    // Regression test for a real bug: a freshly-started assessment used to
    // be created as PENDING, and nothing ever transitioned it out of that
    // state — reportIncident (which requires IN_PROGRESS) was therefore
    // unreachable for any assessment that had never already had an
    // incident. A test mocking IN_PROGRESS directly (above) could never
    // have caught this; only chaining the real startAssessment output into
    // reportIncident does.
    it('accepts an incident on an assessment exactly as startAssessment created it', async () => {
      const started = await service.startAssessment(candidateId, testId);
      assessmentRepo.findOne.mockResolvedValue(started.assessment);

      const result = await service.reportIncident(
        candidateId,
        started.assessment.id,
      );

      expect(result.status).toBe(AssessmentStatus.INCIDENT);
    });
  });
});
