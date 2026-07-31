import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from '../search.service.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import { ProfileSkill } from '../../candidates/entities/profile-skill.entity.js';

function createMockQueryBuilder(): Record<string, jest.Mock> {
  const qb: Record<string, jest.Mock> = {};
  const chainable = [
    'leftJoin',
    'innerJoin',
    'where',
    'andWhere',
    'select',
    'addSelect',
    'orderBy',
    'addOrderBy',
    'groupBy',
    'take',
    'limit',
    'subQuery',
    'from',
  ];
  for (const method of chainable) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getQuery = jest.fn().mockReturnValue('SELECT 1');
  qb.getRawAndEntities = jest.fn().mockResolvedValue({ entities: [], raw: [] });
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return qb;
}

describe('SearchService', () => {
  let service: SearchService;
  let profileRepo: Record<string, jest.Mock>;
  let profileSkillRepo: Record<string, jest.Mock>;
  let mainQb: Record<string, jest.Mock>;
  let skillQb: Record<string, jest.Mock>;

  function makeProfileEntity(overrides: Record<string, unknown> = {}) {
    return {
      id: 'profile-1',
      firstName: 'Amine',
      lastName: 'K',
      headline: 'Backend dev',
      availability: 'immediate',
      mobility: 'remote',
      location: 'Casablanca',
      featured: false,
      salaryMin: 8000,
      salaryMax: 12000,
      salaryVisible: true,
      ...overrides,
    };
  }

  beforeEach(async () => {
    mainQb = createMockQueryBuilder();
    skillQb = createMockQueryBuilder();

    profileRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mainQb),
    };
    profileSkillRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(skillQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
        {
          provide: getRepositoryToken(ProfileSkill),
          useValue: profileSkillRepo,
        },
      ],
    }).compile();

    service = module.get(SearchService);
  });

  describe('base filters (EF-SRCH-01 / EF-SRCH-03 — indexation & visibilité)', () => {
    it('always restricts to indexed and non-hidden profiles', async () => {
      await service.searchCandidates({});

      expect(mainQb.where).toHaveBeenCalledWith(
        'profile.indexedInCvtheque = true',
      );
      expect(mainQb.andWhere).toHaveBeenCalledWith(
        'profile.visibility IN (:...visibilities)',
        expect.objectContaining({
          visibilities: expect.arrayContaining(['public', 'recruiters_only']),
        }),
      );
    });

    it('does not apply optional filters when no criteria are given', async () => {
      await service.searchCandidates({});

      const andWhereCalls = mainQb.andWhere.mock.calls.map((c) => c[0]);
      expect(andWhereCalls.some((c: string) => c.includes('ILIKE'))).toBe(
        false,
      );
      expect(andWhereCalls.some((c: string) => c.includes('EXISTS'))).toBe(
        false,
      );
    });
  });

  describe('US-SRCH-02 — filtres combinables', () => {
    it('applies the full-text filter when q is provided', async () => {
      await service.searchCandidates({ q: 'react developer' });

      expect(mainQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('plainto_tsquery'),
        { q: 'react developer' },
      );
    });

    it('applies the skill EXISTS filter when skills are provided', async () => {
      await service.searchCandidates({ skills: ['React', 'Node'] });

      const call = mainQb.andWhere.mock.calls.find((c) =>
        String(c[0]).startsWith('EXISTS'),
      );
      expect(call).toBeDefined();
      expect(call?.[1]).toEqual({ skillNames: ['React', 'Node'] });
    });

    it('applies the score minimum filter when scoreMin is provided', async () => {
      await service.searchCandidates({ scoreMin: 50 });

      expect(mainQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('best_score.best_value'),
        { scoreMin: 50 },
      );
    });

    it('applies availability, mobility and location as ILIKE filters', async () => {
      await service.searchCandidates({
        availability: 'immediate',
        mobility: 'remote',
        location: 'Rabat',
      });

      expect(mainQb.andWhere).toHaveBeenCalledWith(
        'profile.availability ILIKE :availability',
        { availability: '%immediate%' },
      );
      expect(mainQb.andWhere).toHaveBeenCalledWith(
        'profile.mobility ILIKE :mobility',
        { mobility: '%remote%' },
      );
      expect(mainQb.andWhere).toHaveBeenCalledWith(
        'profile.location ILIKE :location',
        { location: '%Rabat%' },
      );
    });

    it('gates on salaryVisible and applies range overlap when salary filters are provided', async () => {
      await service.searchCandidates({ salaryMin: 5000, salaryMax: 15000 });

      expect(mainQb.andWhere).toHaveBeenCalledWith(
        'profile.salaryVisible = true',
      );
      expect(mainQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('profile.salaryMin'),
        { reqSalaryMax: 15000 },
      );
      expect(mainQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('profile.salaryMax'),
        { reqSalaryMin: 5000 },
      );
    });
  });

  describe('pagination curseur (EF-SRCH-02)', () => {
    it('requests one extra row to detect a next page and returns a cursor', async () => {
      const rawScores = [{ bestScoreValue: '80', bestScorePercentile: '90' }];
      mainQb.getRawAndEntities.mockResolvedValue({
        entities: [makeProfileEntity({ id: 'profile-1' })],
        raw: rawScores,
      });

      const result = await service.searchCandidates({ limit: 1 });

      expect(mainQb.limit).toHaveBeenCalledWith(2);
      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(1);
    });

    it('returns a nextCursor and truncates to the requested limit when more results exist', async () => {
      mainQb.getRawAndEntities.mockResolvedValue({
        entities: [
          makeProfileEntity({ id: 'p1' }),
          makeProfileEntity({ id: 'p2' }),
        ],
        raw: [
          { bestScoreValue: '90', bestScorePercentile: '95' },
          { bestScoreValue: '80', bestScorePercentile: '85' },
        ],
      });

      const result = await service.searchCandidates({ limit: 1 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('p1');
      expect(result.nextCursor).not.toBeNull();

      const decoded = JSON.parse(
        Buffer.from(result.nextCursor as string, 'base64url').toString('utf8'),
      );
      expect(decoded).toEqual({ score: 90, id: 'p1' });
    });

    it('applies a keyset condition when a valid cursor is provided', async () => {
      const cursor = Buffer.from(
        JSON.stringify({ score: 42, id: 'profile-9' }),
      ).toString('base64url');

      await service.searchCandidates({ cursor });

      expect(mainQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('best_score.best_value'),
        { cursorScore: 42, cursorId: 'profile-9' },
      );
    });

    it('silently ignores a malformed cursor instead of throwing', async () => {
      await expect(
        service.searchCandidates({ cursor: 'not-valid-base64-json' }),
      ).resolves.toBeDefined();
    });
  });

  describe('mapping du résultat', () => {
    it('hides salary when the candidate has not made it visible', async () => {
      mainQb.getRawAndEntities.mockResolvedValue({
        entities: [
          makeProfileEntity({
            id: 'p1',
            salaryVisible: false,
            salaryMin: 5000,
            salaryMax: 9000,
          }),
        ],
        raw: [{ bestScoreValue: '60', bestScorePercentile: '55' }],
      });

      const result = await service.searchCandidates({});

      expect(result.items[0].salaryMin).toBeNull();
      expect(result.items[0].salaryMax).toBeNull();
    });

    it('defaults score to 0 and percentile to null when no valid score exists', async () => {
      mainQb.getRawAndEntities.mockResolvedValue({
        entities: [makeProfileEntity({ id: 'p1' })],
        raw: [{ bestScoreValue: null, bestScorePercentile: null }],
      });

      const result = await service.searchCandidates({});

      expect(result.items[0].score).toBe(0);
      expect(result.items[0].percentile).toBeNull();
    });

    it('attaches skill names loaded for the returned profiles', async () => {
      mainQb.getRawAndEntities.mockResolvedValue({
        entities: [makeProfileEntity({ id: 'p1' })],
        raw: [{ bestScoreValue: '70', bestScorePercentile: '65' }],
      });
      skillQb.getRawMany.mockResolvedValue([
        { profileId: 'p1', name: 'React' },
        { profileId: 'p1', name: 'Node.js' },
      ]);

      const result = await service.searchCandidates({});

      expect(result.items[0].skills).toEqual(['React', 'Node.js']);
    });

    it('does not query skills when the result page is empty', async () => {
      mainQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

      const result = await service.searchCandidates({});

      expect(profileSkillRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
    });
  });

  describe('getCandidateDetail (EF-GROW-04) — same visibility rule as the list, never more reachable', () => {
    it('scopes the lookup to the given id plus the same indexation/visibility filters as the list', async () => {
      mainQb.getRawAndEntities.mockResolvedValue({
        entities: [makeProfileEntity({ id: 'p1' })],
        raw: [{ bestScoreValue: '70', bestScorePercentile: '65' }],
      });

      await service.getCandidateDetail('p1');

      expect(mainQb.where).toHaveBeenCalledWith('profile.id = :id', {
        id: 'p1',
      });
      expect(mainQb.andWhere).toHaveBeenCalledWith(
        'profile.indexedInCvtheque = true',
      );
      expect(mainQb.andWhere).toHaveBeenCalledWith(
        'profile.visibility IN (:...visibilities)',
        expect.objectContaining({
          visibilities: expect.arrayContaining(['public', 'recruiters_only']),
        }),
      );
    });

    it('throws NotFoundException when the profile does not exist, is hidden, or is not indexed', async () => {
      mainQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

      await expect(service.getCandidateDetail('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the same field shape as a search result item, including skills and score', async () => {
      mainQb.getRawAndEntities.mockResolvedValue({
        entities: [makeProfileEntity({ id: 'p1', salaryVisible: false })],
        raw: [{ bestScoreValue: '80', bestScorePercentile: '90' }],
      });
      skillQb.getRawMany.mockResolvedValue([
        { profileId: 'p1', name: 'React' },
      ]);

      const result = await service.getCandidateDetail('p1');

      expect(result).toEqual({
        id: 'p1',
        firstName: 'Amine',
        lastName: 'K',
        headline: 'Backend dev',
        availability: 'immediate',
        mobility: 'remote',
        location: 'Casablanca',
        skills: ['React'],
        score: 80,
        percentile: 90,
        featured: false,
        salaryMin: null,
        salaryMax: null,
      });
    });
  });
});
