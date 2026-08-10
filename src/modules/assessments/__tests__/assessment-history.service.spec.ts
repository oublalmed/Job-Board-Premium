import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssessmentHistoryService } from '../assessment-history.service.js';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity.js';
import { Score } from '../entities/score.entity.js';
import { SettingsService } from '../../settings/settings.service.js';

describe('AssessmentHistoryService', () => {
  let service: AssessmentHistoryService;
  let assessmentRepo: Record<string, jest.Mock>;
  let scoreRepo: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;

  const candidateId = 'candidate-1';

  beforeEach(async () => {
    assessmentRepo = { find: jest.fn().mockResolvedValue([]) };
    scoreRepo = { find: jest.fn().mockResolvedValue([]) };
    settingsService = { getNumber: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentHistoryService,
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
        { provide: getRepositoryToken(Score), useValue: scoreRepo },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get(AssessmentHistoryService);
  });

  it('should return an empty, eligible history when the candidate has no assessments', async () => {
    const result = await service.getHistory(candidateId);

    expect(result.items).toEqual([]);
    expect(result.eligibleNow).toBe(true);
    expect(result.nextEligibleAt).toBeNull();
    expect(result.cooldownDays).toBe(90);
    // Never queries scores when there are no assessments.
    expect(scoreRepo.find).not.toHaveBeenCalled();
  });

  it('should join scores, normalize numeric strings, and expose the tech/psycho split', async () => {
    const completedAt = new Date('2026-01-01T00:00:00.000Z');
    assessmentRepo.find.mockResolvedValue([
      {
        id: 'a1',
        testId: 't1',
        status: AssessmentStatus.COMPLETED,
        startedAt: completedAt,
        completedAt,
        test: { specialty: { name: 'Développement Logiciel' } },
      },
    ]);
    scoreRepo.find.mockResolvedValue([
      {
        assessmentId: 'a1',
        value: '84.40',
        percentile: '84',
        technicalScore: '88.00',
        psychotechnicalScore: '79.00',
      },
    ]);

    const result = await service.getHistory(candidateId);

    expect(result.items[0]).toEqual({
      id: 'a1',
      testId: 't1',
      specialtyName: 'Développement Logiciel',
      status: AssessmentStatus.COMPLETED,
      startedAt: completedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      score: {
        value: 84.4,
        percentile: 84,
        technicalScore: 88,
        psychotechnicalScore: 79,
      },
    });
    // Cooldown long elapsed (test date is in the past) → eligible again.
    expect(result.eligibleNow).toBe(true);
  });

  it('should report a cooldown when the most recent completion is recent', async () => {
    const completedAt = new Date();
    completedAt.setDate(completedAt.getDate() - 10);
    assessmentRepo.find.mockResolvedValue([
      {
        id: 'a1',
        testId: 't1',
        status: AssessmentStatus.COMPLETED,
        startedAt: completedAt,
        completedAt,
        test: { specialty: { name: 'X' } },
      },
    ]);
    scoreRepo.find.mockResolvedValue([]);

    const result = await service.getHistory(candidateId);

    expect(result.eligibleNow).toBe(false);
    expect(result.nextEligibleAt).not.toBeNull();
    expect(result.items[0].score).toBeNull();
  });
});
