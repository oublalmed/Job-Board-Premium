import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from '../analytics.service.js';
import {
  AnalyticsEvent,
  AnalyticsEventType,
} from '../entities/analytics-event.entity.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repo: Record<string, jest.Mock>;
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    repo = {
      create: jest.fn((v) => v),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(AnalyticsEvent), useValue: repo },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  describe('track', () => {
    it('persists an event', async () => {
      await service.track(AnalyticsEventType.SIGNUP, 'user-1', {
        roles: ['candidate'],
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AnalyticsEventType.SIGNUP,
          userId: 'user-1',
          metadata: { roles: ['candidate'] },
        }),
      );
    });

    it('never throws — a DB failure is swallowed', async () => {
      repo.save.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.track(AnalyticsEventType.EMAIL_VERIFIED, 'user-2'),
      ).resolves.toBeUndefined();
    });
  });

  describe('funnel', () => {
    it('returns the full ordered funnel with zeros for missing steps', async () => {
      qb.getRawMany.mockResolvedValue([
        { type: AnalyticsEventType.SIGNUP, count: '10' },
        { type: AnalyticsEventType.EMAIL_VERIFIED, count: '6' },
      ]);

      const result = await service.funnel();

      expect(result.rangeDays).toBeNull();
      expect(result.steps).toEqual([
        { type: AnalyticsEventType.SIGNUP, count: 10 },
        { type: AnalyticsEventType.EMAIL_VERIFIED, count: 6 },
        { type: AnalyticsEventType.TEST_STARTED, count: 0 },
        { type: AnalyticsEventType.SCORE_OBTAINED, count: 0 },
        { type: AnalyticsEventType.RECRUITER_CONTACT, count: 0 },
        { type: AnalyticsEventType.SUBSCRIPTION_CREATED, count: 0 },
      ]);
      expect(qb.where).not.toHaveBeenCalled();
    });

    it('applies a date range when days is provided', async () => {
      await service.funnel(30);
      expect(qb.where).toHaveBeenCalledWith(
        'e.created_at >= :from',
        expect.objectContaining({ from: expect.any(Date) }),
      );
    });

    it('ignores a non-positive range', async () => {
      await service.funnel(0);
      expect(qb.where).not.toHaveBeenCalled();
    });
  });
});
