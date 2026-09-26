import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentController } from '../assessment.controller.js';
import { AssessmentService } from '../assessment.service.js';
import { AssessmentHistoryService } from '../assessment-history.service.js';
import { RemediationService } from '../remediation.service.js';
import { RemediationProgressService } from '../remediation-progress.service.js';
import { WebhookService } from '../webhook.service.js';
import { ExamService } from '../exam.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';
import { AssessmentStatus } from '../entities/assessment.entity.js';

describe('AssessmentController', () => {
  let controller: AssessmentController;
  let service: Record<string, jest.Mock>;
  let historyService: Record<string, jest.Mock>;
  let remediationService: Record<string, jest.Mock>;
  let remediationProgressService: Record<string, jest.Mock>;

  const authenticatedUser: JwtPayload = {
    sub: 'candidate-1',
    email: 'candidate@example.com',
    roles: [Role.CANDIDATE],
  };

  const otherUserId = 'candidate-other';

  const mockAssessment = {
    id: 'assessment-1',
    candidateId: 'candidate-1',
    testId: 'test-1',
    status: AssessmentStatus.PENDING,
    resumeToken: 'token-abc',
    expiresAt: new Date(Date.now() + 3600000),
    externalAssessmentId: 'ext-123',
  };

  beforeEach(async () => {
    service = {
      startAssessment: jest.fn().mockResolvedValue({
        assessment: mockAssessment,
        assessmentUrl: 'https://scoring.local/test/ext-123',
      }),
      resumeAssessment: jest.fn().mockResolvedValue({
        assessment: {
          ...mockAssessment,
          status: AssessmentStatus.IN_PROGRESS,
          resumeToken: 'new-token',
        },
        assessmentUrl: 'https://scoring.local/test/ext-123',
      }),
      reportIncident: jest.fn().mockResolvedValue({
        ...mockAssessment,
        status: AssessmentStatus.INCIDENT,
      }),
      recordProctoringEvents: jest.fn().mockResolvedValue({
        ...mockAssessment,
        tabSwitchCount: 3,
        windowBlurCount: 2,
        proctoringFlagged: true,
      }),
    };
    historyService = {
      getHistory: jest.fn().mockResolvedValue({
        items: [],
        cooldownDays: 90,
        eligibleNow: true,
        nextEligibleAt: null,
      }),
    };
    remediationService = {
      getFeedback: jest.fn().mockResolvedValue({
        scoreValue: 30,
        indexationThresholdMet: false,
        domainFeedback: [{ domain: 'Algorithmes', level: 'weak' }],
        resources: [],
        completedCount: 0,
        totalCount: 0,
        reEligibleAt: new Date().toISOString(),
      }),
    };
    remediationProgressService = {
      setCompleted: jest.fn().mockResolvedValue(undefined),
    };
    // The in-app exam surface (getExam/submitExam) and the completion webhook
    // are exercised in their own specs; here they only need to resolve so the
    // controller can be constructed.
    const examService = {
      getExam: jest.fn().mockResolvedValue({ questions: [] }),
      submitExam: jest.fn().mockResolvedValue({ scoreValue: 0 }),
    };
    const webhookService = {
      simulateCompletion: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [
        { provide: AssessmentService, useValue: service },
        { provide: AssessmentHistoryService, useValue: historyService },
        { provide: RemediationService, useValue: remediationService },
        {
          provide: RemediationProgressService,
          useValue: remediationProgressService,
        },
        { provide: WebhookService, useValue: webhookService },
        { provide: ExamService, useValue: examService },
      ],
    }).compile();

    controller = module.get(AssessmentController);
  });

  describe('startAssessment', () => {
    it('should start an assessment for the authenticated candidate with anti-cheat context', async () => {
      const result = await controller.startAssessment(
        authenticatedUser,
        { testId: 'test-1' },
        '196.200.1.1',
        'fp-abc',
      );

      expect(service.startAssessment).toHaveBeenCalledWith(
        'candidate-1',
        'test-1',
        { ipAddress: '196.200.1.1', deviceFingerprint: 'fp-abc' },
      );
      expect(result.assessment.id).toBe('assessment-1');
      expect(result.assessmentUrl).toBeDefined();
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.startAssessment(
        authenticatedUser,
        { testId: 'test-1' },
        '196.200.1.1',
        'fp-abc',
      );

      expect(service.startAssessment).not.toHaveBeenCalledWith(
        otherUserId,
        expect.anything(),
      );
      expect(service.startAssessment.mock.calls[0][0]).toBe(
        authenticatedUser.sub,
      );
    });
  });

  describe('resumeAssessment', () => {
    it('should resume an incident assessment', async () => {
      const result = await controller.resumeAssessment(authenticatedUser, {
        assessmentId: 'assessment-1',
        resumeToken: 'token-abc',
      });

      expect(service.resumeAssessment).toHaveBeenCalledWith(
        'candidate-1',
        'assessment-1',
        'token-abc',
      );
      expect(result.assessment.status).toBe(AssessmentStatus.IN_PROGRESS);
    });

    it('should always use user.sub for resume', async () => {
      await controller.resumeAssessment(authenticatedUser, {
        assessmentId: 'assessment-1',
        resumeToken: 'token-abc',
      });

      expect(service.resumeAssessment.mock.calls[0][0]).toBe(
        authenticatedUser.sub,
      );
    });
  });

  describe('reportIncident', () => {
    it('should report an incident for the authenticated candidate', async () => {
      const result = await controller.reportIncident(
        authenticatedUser,
        'assessment-1',
      );

      expect(service.reportIncident).toHaveBeenCalledWith(
        'candidate-1',
        'assessment-1',
      );
      expect(result.status).toBe(AssessmentStatus.INCIDENT);
    });

    it('should always use user.sub for incident reporting', async () => {
      await controller.reportIncident(authenticatedUser, 'assessment-1');

      expect(service.reportIncident.mock.calls[0][0]).toBe(
        authenticatedUser.sub,
      );
    });
  });

  describe('getMyHistory', () => {
    it('should return the history for the authenticated candidate only', async () => {
      const result = await controller.getMyHistory(authenticatedUser);

      expect(historyService.getHistory).toHaveBeenCalledWith('candidate-1');
      expect(result.eligibleNow).toBe(true);
      expect(result.cooldownDays).toBe(90);
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.getMyHistory(authenticatedUser);

      expect(historyService.getHistory.mock.calls[0][0]).toBe(
        authenticatedUser.sub,
      );
    });
  });

  describe('getFeedback', () => {
    it('should return remediation feedback for the authenticated candidate', async () => {
      const result = await controller.getFeedback(
        authenticatedUser,
        'assessment-1',
      );

      expect(remediationService.getFeedback).toHaveBeenCalledWith(
        'candidate-1',
        'assessment-1',
      );
      expect(result.domainFeedback).toEqual([
        { domain: 'Algorithmes', level: 'weak' },
      ]);
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.getFeedback(authenticatedUser, 'assessment-1');

      expect(remediationService.getFeedback.mock.calls[0][0]).toBe(
        authenticatedUser.sub,
      );
    });
  });

  describe('recordProctoringEvents (EF-EVAL-02 / §5.3)', () => {
    it('forwards owner-scoped counts and returns the updated flag', async () => {
      const result = await controller.recordProctoringEvents(
        authenticatedUser,
        'assessment-1',
        { tabSwitches: 3, windowBlurs: 2 },
      );

      expect(service.recordProctoringEvents).toHaveBeenCalledWith(
        authenticatedUser.sub,
        'assessment-1',
        { tabSwitches: 3, windowBlurs: 2 },
      );
      expect(result.proctoringFlagged).toBe(true);
      expect(result.tabSwitchCount).toBe(3);
    });
  });

  describe('updateRemediationProgress (EF-CAND-09)', () => {
    it('toggles a resource owner-scoped by user.sub', async () => {
      await controller.updateRemediationProgress(authenticatedUser, {
        url: 'https://sqlbolt.com/',
        completed: true,
      });

      expect(remediationProgressService.setCompleted).toHaveBeenCalledWith(
        authenticatedUser.sub,
        'https://sqlbolt.com/',
        true,
      );
    });

    it('never trusts a caller-supplied id — always user.sub', async () => {
      await controller.updateRemediationProgress(
        { ...authenticatedUser, sub: otherUserId },
        { url: 'https://sqlbolt.com/', completed: false },
      );

      expect(remediationProgressService.setCompleted.mock.calls[0][0]).toBe(
        otherUserId,
      );
    });
  });
});
