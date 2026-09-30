import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExamService } from '../exam.service.js';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity.js';
import { Test as TestEntity } from '../entities/test.entity.js';
import { Specialty } from '../entities/specialty.entity.js';
import { WebhookService } from '../webhook.service.js';
import { examForSpecialty } from '../assessment-questions.js';

describe('ExamService', () => {
  let service: ExamService;
  let assessmentRepo: { findOne: jest.Mock; save: jest.Mock };
  let testRepo: { findOne: jest.Mock };
  let specialtyRepo: { findOne: jest.Mock };
  let webhookService: { finalizeAssessment: jest.Mock };

  const baseAssessment = {
    id: 'assessment-1',
    candidateId: 'cand-1',
    testId: 'test-1',
    externalAssessmentId: 'ext-1',
    status: AssessmentStatus.IN_PROGRESS,
  };

  beforeEach(async () => {
    assessmentRepo = {
      findOne: jest.fn().mockResolvedValue({ ...baseAssessment }),
      save: jest.fn((a: unknown) => Promise.resolve(a)),
    };
    testRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'test-1', specialtyId: 'spec-1' }),
    };
    specialtyRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'spec-1', name: 'Software Engineer' }),
    };
    webhookService = {
      finalizeAssessment: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamService,
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
        { provide: getRepositoryToken(TestEntity), useValue: testRepo },
        { provide: getRepositoryToken(Specialty), useValue: specialtyRepo },
        { provide: WebhookService, useValue: webhookService },
      ],
    }).compile();

    service = module.get(ExamService);
  });

  describe('getExam', () => {
    it('returns 30 questions with the answer key stripped', async () => {
      const exam = await service.getExam('cand-1', 'assessment-1');
      expect(exam.questions).toHaveLength(30);
      expect(exam.technicalCount).toBe(20);
      expect(exam.psychotechnicalCount).toBe(10);
      expect(exam.specialtyName).toBe('Software Engineer');
      for (const q of exam.questions) {
        expect(q).not.toHaveProperty('correct');
      }
    });

    it('exposes a per-question time limit and a total budget (§1)', async () => {
      const exam = await service.getExam('cand-1', 'assessment-1');
      for (const q of exam.questions) {
        expect(q.timeLimitSeconds).toBeGreaterThan(0);
        expect(q.timeLimitSeconds).toBe(q.type === 'technical' ? 90 : 60);
      }
      // 20 technical × 90 + 10 psychotechnical × 60 = 2400s.
      expect(exam.totalTimeSeconds).toBe(20 * 90 + 10 * 60);
    });

    it('tolerates a missing test/specialty (specialtyName null)', async () => {
      testRepo.findOne.mockResolvedValue(null);
      const exam = await service.getExam('cand-1', 'assessment-1');
      expect(exam.specialtyName).toBeNull();
      expect(exam.questions).toHaveLength(30);
    });
  });

  describe('submitExam', () => {
    // Recompute the same exam (seed = assessment.id) to know the answer keys.
    const key = () => examForSpecialty('Software Engineer', 'assessment-1');

    it('grades a fully-correct submission as 100 and finalizes', async () => {
      const answers: Record<string, number> = {};
      for (const q of key()) answers[q.id] = q.correct;

      const result = await service.submitExam(
        'cand-1',
        'assessment-1',
        answers,
      );

      expect(result.scoreValue).toBe(100);
      expect(result.technicalScore).toBe(100);
      expect(result.psychotechnicalScore).toBe(100);
      expect(webhookService.finalizeAssessment).toHaveBeenCalledTimes(1);
      const [, passed] = webhookService.finalizeAssessment.mock.calls[0];
      expect(passed.score).toBe(100);
      expect(passed.plagiarismVerdict).toBe('clean');
      expect(passed.domainFeedback.length).toBeGreaterThan(0);
    });

    it('grades an all-wrong submission as 0', async () => {
      const answers: Record<string, number> = {};
      for (const q of key()) answers[q.id] = (q.correct + 1) % q.options.length;
      const result = await service.submitExam(
        'cand-1',
        'assessment-1',
        answers,
      );
      expect(result.scoreValue).toBe(0);
    });

    it('handles an empty answer map without throwing', async () => {
      const result = await service.submitExam('cand-1', 'assessment-1', {});
      expect(result.scoreValue).toBe(0);
    });

    it('voids the attempt (INCIDENT) when submitted past the time budget', async () => {
      // Budget = 20×90 + 10×60 = 2400s (+120 grace). Started 4000s ago → over.
      assessmentRepo.findOne.mockResolvedValue({
        ...baseAssessment,
        startedAt: new Date(Date.now() - 4000 * 1000),
      });
      await expect(
        service.submitExam('cand-1', 'assessment-1', {}),
      ).rejects.toThrow(ForbiddenException);
      expect(assessmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssessmentStatus.INCIDENT }),
      );
      expect(webhookService.finalizeAssessment).not.toHaveBeenCalled();
    });

    it('grades normally when submitted within the budget (recent start)', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        ...baseAssessment,
        startedAt: new Date(Date.now() - 60 * 1000),
      });
      const result = await service.submitExam('cand-1', 'assessment-1', {});
      expect(result.scoreValue).toBe(0);
      expect(webhookService.finalizeAssessment).toHaveBeenCalledTimes(1);
    });
  });

  describe('access control', () => {
    it('throws NotFound when the assessment does not exist', async () => {
      assessmentRepo.findOne.mockResolvedValue(null);
      await expect(service.getExam('cand-1', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws Forbidden for a different candidate', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        ...baseAssessment,
        candidateId: 'other',
      });
      await expect(service.getExam('cand-1', 'assessment-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequest when the assessment is not in progress', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        ...baseAssessment,
        status: AssessmentStatus.COMPLETED,
      });
      await expect(service.getExam('cand-1', 'assessment-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
