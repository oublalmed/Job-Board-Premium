import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ScoreBadgeService } from '../score-badge.service.js';
import { ScoreBadge } from '../entities/score-badge.entity.js';
import { Score } from '../../assessments/entities/score.entity.js';

// A Score with just the fields the service reads, plus the nested relation
// chain used for the specialty name.
function scoreFixture(overrides: Partial<Score> = {}): Score {
  return {
    id: 'score-1',
    value: 88,
    percentile: 92,
    createdAt: new Date('2026-01-02T00:00:00Z'),
    assessment: { test: { specialty: { name: 'Backend Node.js' } } },
    ...overrides,
  } as Score;
}

describe('ScoreBadgeService', () => {
  let service: ScoreBadgeService;
  let badgeRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let scoreRepo: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let bestScoreQb: Record<string, jest.Mock>;

  const userId = 'user-1';

  beforeEach(async () => {
    bestScoreQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    badgeRepo = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };
    scoreRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(bestScoreQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoreBadgeService,
        { provide: getRepositoryToken(ScoreBadge), useValue: badgeRepo },
        { provide: getRepositoryToken(Score), useValue: scoreRepo },
      ],
    }).compile();

    service = module.get(ScoreBadgeService);
  });

  describe('getStatus', () => {
    it('reports no badge and no score for a fresh candidate', async () => {
      badgeRepo.findOne.mockResolvedValue(null);
      bestScoreQb.getOne.mockResolvedValue(null);

      const status = await service.getStatus(userId);

      expect(status).toEqual({
        hasBadge: false,
        enabled: false,
        token: null,
        badge: null,
        hasScore: false,
      });
    });

    it('reports hasScore true when a score exists but no badge yet', async () => {
      badgeRepo.findOne.mockResolvedValue(null);
      bestScoreQb.getOne.mockResolvedValue(scoreFixture());

      const status = await service.getStatus(userId);

      expect(status.hasBadge).toBe(false);
      expect(status.hasScore).toBe(true);
    });
  });

  describe('enable', () => {
    it('rejects when the candidate has no score to showcase', async () => {
      bestScoreQb.getOne.mockResolvedValue(null);

      await expect(service.enable(userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(badgeRepo.save).not.toHaveBeenCalled();
    });

    it('creates an enabled badge with an unguessable token from the best score', async () => {
      const score = scoreFixture();
      bestScoreQb.getOne.mockResolvedValue(score);
      // no existing badge, then getStatus reloads it
      badgeRepo.findOne
        .mockResolvedValueOnce(null) // enable(): existing badge lookup
        .mockResolvedValueOnce({
          userId,
          scoreId: score.id,
          token: 'tok-123',
          enabled: true,
          displayName: 'Sara',
        }); // getStatus(): badge lookup
      scoreRepo.findOne.mockResolvedValue(score);

      const status = await service.enable(userId, 'Sara');

      expect(badgeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId, enabled: true, scoreId: score.id }),
      );
      const saved = badgeRepo.save.mock.calls[0][0];
      expect(typeof saved.token).toBe('string');
      expect(saved.token.length).toBeGreaterThan(0);
      expect(status.enabled).toBe(true);
      expect(status.badge?.displayName).toBe('Sara');
    });
  });

  describe('getPublic', () => {
    it('404s on an unknown or disabled token', async () => {
      badgeRepo.findOne.mockResolvedValue(null);
      await expect(service.getPublic('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns a sanitized showcase with a derived level', async () => {
      badgeRepo.findOne.mockResolvedValue({
        scoreId: 'score-1',
        displayName: null,
      });
      scoreRepo.findOne.mockResolvedValue(scoreFixture());

      const badge = await service.getPublic('tok-123');

      expect(badge).toEqual({
        scoreValue: 88,
        percentile: 92,
        specialtyName: 'Backend Node.js',
        level: 'expert', // >= 85
        issuedAt: '2026-01-02T00:00:00.000Z',
        displayName: null,
      });
      // no sensitive fields leaked
      expect(badge).not.toHaveProperty('domainFeedback');
      expect(badge).not.toHaveProperty('email');
    });

    it('maps score bands to levels', async () => {
      badgeRepo.findOne.mockResolvedValue({ scoreId: 's', displayName: null });
      scoreRepo.findOne.mockResolvedValue(
        scoreFixture({ value: 60 as unknown as number }),
      );
      const badge = await service.getPublic('t');
      expect(badge.level).toBe('intermediate'); // 50..69
    });
  });
});
