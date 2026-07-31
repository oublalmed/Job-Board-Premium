import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentController } from '../assessment.controller.js';
import { AssessmentService } from '../assessment.service.js';
import { RemediationService } from '../remediation.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';
import { AssessmentStatus } from '../entities/assessment.entity.js';

describe('AssessmentController', () => {
  let controller: AssessmentController;
  let service: Record<string, jest.Mock>;
  let remediationService: Record<string, jest.Mock>;

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
    };
    remediationService = {
      getFeedback: jest.fn().mockResolvedValue({
        scoreValue: 30,
        indexationThresholdMet: false,
        domainFeedback: [{ domain: 'Algorithmes', level: 'weak' }],
        resources: [],
        reEligibleAt: new Date().toISOString(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [
        { provide: AssessmentService, useValue: service },
        { provide: RemediationService, useValue: remediationService },
      ],
    }).compile();

    controller = module.get(AssessmentController);
  });

  describe('startAssessment', () => {
    it('should start an assessment for the authenticated candidate', async () => {
      const result = await controller.startAssessment(authenticatedUser, {
        testId: 'test-1',
      });

      expect(service.startAssessment).toHaveBeenCalledWith(
        'candidate-1',
        'test-1',
      );
      expect(result.assessment.id).toBe('assessment-1');
      expect(result.assessmentUrl).toBeDefined();
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.startAssessment(authenticatedUser, {
        testId: 'test-1',
      });

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
});
