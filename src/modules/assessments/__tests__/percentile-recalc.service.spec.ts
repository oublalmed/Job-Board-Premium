import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PercentileRecalcService } from '../percentile-recalc.service.js';
import { Score, PlagiarismVerdict } from '../entities/score.entity.js';

type PartialScore = Partial<Score> & { assessment?: { testId: string } };

function makeScore(
  id: string,
  testId: string,
  value: number,
  percentile: number | null = null,
): PartialScore {
  return {
    id,
    value: value,
    percentile: percentile,
    plagiarismVerdict: PlagiarismVerdict.CLEAN,
    assessment: { testId },
  };
}

describe('PercentileRecalcService', () => {
  let service: PercentileRecalcService;
  let repo: jest.Mocked<Partial<Repository<Score>>>;

  const setScores = (scores: PartialScore[]) =>
    (repo.find as jest.Mock).mockResolvedValue(scores);

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PercentileRecalcService,
        { provide: getRepositoryToken(Score), useValue: repo },
      ],
    }).compile();

    service = module.get(PercentileRecalcService);
  });

  it('computes percentile as the share of the cohort a score outranks', async () => {
    // Cohort of 4 (same test), all previously null percentile.
    setScores([
      makeScore('a', 't1', 10),
      makeScore('b', 't1', 20),
      makeScore('c', 't1', 30),
      makeScore('d', 't1', 40),
    ]);

    const result = await service.recalculate();

    expect(result.cohortCount).toBe(1);
    expect(result.scoreCount).toBe(4);
    expect(result.updatedCount).toBe(4);

    const updates = (repo.update as jest.Mock).mock.calls;
    const byId = Object.fromEntries(
      updates.map(([id, patch]) => [id, patch.percentile]),
    );
    expect(byId['a']).toBe(0); // 0/4
    expect(byId['b']).toBe(25); // 1/4
    expect(byId['c']).toBe(50); // 2/4
    expect(byId['d']).toBe(75); // 3/4
  });

  it('gives tied values an identical percentile', async () => {
    setScores([
      makeScore('a', 't1', 50),
      makeScore('b', 't1', 50),
      makeScore('c', 't1', 90),
    ]);

    await service.recalculate();

    const byId = Object.fromEntries(
      (repo.update as jest.Mock).mock.calls.map(([id, patch]) => [
        id,
        patch.percentile,
      ]),
    );
    // Two peers below 90 → 2/3 ≈ 66.67; the tied pair have 0 peers below.
    expect(byId['a']).toBe(0);
    expect(byId['b']).toBe(0);
    expect(byId['c']).toBe(66.67);
  });

  it('is idempotent: does not rewrite rows whose percentile is unchanged', async () => {
    // Already-correct percentiles for a 2-score cohort (0 and 50).
    setScores([makeScore('a', 't1', 10, 0), makeScore('b', 't1', 20, 50)]);

    const result = await service.recalculate();

    expect(result.updatedCount).toBe(0);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('recomputes each test cohort independently', async () => {
    setScores([
      makeScore('a', 't1', 10),
      makeScore('b', 't1', 20),
      makeScore('c', 't2', 99),
    ]);

    const result = await service.recalculate();

    expect(result.cohortCount).toBe(2);
    const byId = Object.fromEntries(
      (repo.update as jest.Mock).mock.calls.map(([id, patch]) => [
        id,
        patch.percentile,
      ]),
    );
    // t2 has a single member → 0 peers below → percentile 0.
    expect(byId['c']).toBe(0);
    expect(byId['a']).toBe(0);
    expect(byId['b']).toBe(50);
  });

  it('skips scores whose assessment relation is missing', async () => {
    setScores([{ id: 'x', value: 55, percentile: null }]);

    const result = await service.recalculate();

    expect(result.cohortCount).toBe(0);
    expect(result.updatedCount).toBe(0);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('only queries active (unexpired, non-confirmed-plagiarism) scores', async () => {
    await service.recalculate();
    const call = (repo.find as jest.Mock).mock.calls[0][0];
    expect(call.relations).toEqual({ assessment: true });
    expect(call.where.expiresAt).toBeDefined();
    expect(call.where.plagiarismVerdict).toBeDefined();
  });
});
