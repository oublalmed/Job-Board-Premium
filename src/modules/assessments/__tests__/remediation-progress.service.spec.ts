import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RemediationProgressService } from '../remediation-progress.service.js';
import { RemediationProgress } from '../entities/remediation-progress.entity.js';

describe('RemediationProgressService (EF-CAND-09)', () => {
  let service: RemediationProgressService;
  let repo: Record<string, jest.Mock>;
  let insertBuilder: Record<string, jest.Mock>;

  const candidateId = 'candidate-1';
  const url = 'https://sqlbolt.com/';

  beforeEach(async () => {
    insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    repo = {
      find: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => insertBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemediationProgressService,
        { provide: getRepositoryToken(RemediationProgress), useValue: repo },
      ],
    }).compile();

    service = module.get(RemediationProgressService);
  });

  it('returns the set of completed URLs for a candidate', async () => {
    repo.find.mockResolvedValue([
      { resourceUrl: url },
      { resourceUrl: 'https://sqlzoo.net/' },
    ]);

    const result = await service.completedUrls(candidateId);

    expect(repo.find).toHaveBeenCalledWith({
      where: { candidateId },
      select: { resourceUrl: true },
    });
    expect(result.has(url)).toBe(true);
    expect(result.size).toBe(2);
  });

  it('marking completed inserts with orIgnore (idempotent)', async () => {
    await service.setCompleted(candidateId, url, true);

    expect(insertBuilder.values).toHaveBeenCalledWith({
      candidateId,
      resourceUrl: url,
    });
    expect(insertBuilder.orIgnore).toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('clearing completion deletes the owner-scoped row', async () => {
    await service.setCompleted(candidateId, url, false);

    expect(repo.delete).toHaveBeenCalledWith({
      candidateId,
      resourceUrl: url,
    });
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
