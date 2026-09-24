import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RemediationService } from '../remediation.service.js';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity.js';
import { Score, PlagiarismVerdict } from '../entities/score.entity.js';
import { SettingsService } from '../../settings/settings.service.js';
import { RemediationProgressService } from '../remediation-progress.service.js';

describe('RemediationService', () => {
  let service: RemediationService;
  let assessmentRepo: Record<string, jest.Mock>;
  let scoreRepo: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;
  let progressService: Record<string, jest.Mock>;

  const candidateId = 'candidate-1';
  const assessmentId = 'assessment-1';

  const completedAt = new Date('2026-06-01T00:00:00.000Z');

  function makeAssessment(overrides: Record<string, unknown> = {}) {
    return {
      id: assessmentId,
      candidateId,
      testId: 'test-1',
      status: AssessmentStatus.COMPLETED,
      completedAt,
      ...overrides,
    };
  }

  function makeScore(overrides: Record<string, unknown> = {}) {
    return {
      id: 'score-1',
      assessmentId,
      value: 25,
      percentile: 10,
      plagiarismVerdict: PlagiarismVerdict.CLEAN,
      domainFeedback: [
        { domain: 'Algorithmes', level: 'weak' },
        { domain: 'Bases de données', level: 'strong' },
      ],
      ...overrides,
    };
  }

  beforeEach(async () => {
    assessmentRepo = { findOne: jest.fn().mockResolvedValue(makeAssessment()) };
    scoreRepo = { findOne: jest.fn().mockResolvedValue(makeScore()) };
    settingsService = {
      getNumber: jest.fn().mockResolvedValue(null), // fall back to defaults
    };
    progressService = {
      completedUrls: jest.fn().mockResolvedValue(new Set<string>()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemediationService,
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
        { provide: getRepositoryToken(Score), useValue: scoreRepo },
        { provide: SettingsService, useValue: settingsService },
        {
          provide: RemediationProgressService,
          useValue: progressService,
        },
      ],
    }).compile();

    service = module.get(RemediationService);
  });

  it('returns per-domain feedback and resources for a score under the indexation threshold', async () => {
    const result = await service.getFeedback(candidateId, assessmentId);

    expect(assessmentRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: assessmentId,
        candidateId,
        status: AssessmentStatus.COMPLETED,
      },
    });
    expect(result.scoreValue).toBe(25);
    expect(result.indexationThresholdMet).toBe(false); // 25 < 40, 10 < 30
    expect(result.domainFeedback).toEqual([
      { domain: 'Algorithmes', level: 'weak' },
      { domain: 'Bases de données', level: 'strong' },
    ]);
    expect(result.resources.length).toBeGreaterThan(0); // resources for the weak domain
    expect(result.reEligibleAt).toBe(
      new Date('2026-08-30T00:00:00.000Z').toISOString(), // completedAt + 90d default
    );
  });

  it('never leaks anything beyond {domain, level} in a feedback entry — structural guarantee', async () => {
    const result = await service.getFeedback(candidateId, assessmentId);

    for (const entry of result.domainFeedback) {
      expect(Object.keys(entry).sort()).toEqual(['domain', 'level']);
    }
    // The response as a whole never carries the raw `details` jsonb bag —
    // only the typed fields defined on RemediationFeedback.
    expect(Object.keys(result).sort()).toEqual(
      [
        'barème',
        'completedCount',
        'domainFeedback',
        'indexationThresholdMet',
        'psychotechnicalScore',
        'reEligibleAt',
        'resources',
        'scoreValue',
        'technicalScore',
        'totalCount',
      ].sort(),
    );
  });

  it('annotates resources with completion state and counts (EF-CAND-09)', async () => {
    // The Algorithmes weak-domain resource is the MIT OCW link.
    progressService.completedUrls.mockResolvedValue(
      new Set([
        'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
      ]),
    );

    const result = await service.getFeedback(candidateId, assessmentId);

    expect(progressService.completedUrls).toHaveBeenCalledWith(candidateId);
    expect(result.totalCount).toBe(result.resources.length);
    expect(result.completedCount).toBe(1);
    const completed = result.resources.filter((r) => r.completed);
    expect(completed).toHaveLength(1);
  });

  it('reports indexationThresholdMet=true when the score clears the bar', async () => {
    scoreRepo.findOne.mockResolvedValue(makeScore({ value: 50, percentile: 60 }));

    const result = await service.getFeedback(candidateId, assessmentId);

    expect(result.indexationThresholdMet).toBe(true);
  });

  it('throws NotFoundException — not the assessment of another candidate — when the assessment does not belong to the caller', async () => {
    // The WHERE clause itself is scoped to candidateId, so a lookup for
    // another candidate's assessment id simply finds nothing — proven here
    // by mocking the repo the way it would actually behave (no row
    // matches), not by asserting on application-level comparison logic.
    assessmentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getFeedback('candidate-2', assessmentId),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the assessment has no score yet', async () => {
    scoreRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getFeedback(candidateId, assessmentId),
    ).rejects.toThrow(NotFoundException);
  });
});
