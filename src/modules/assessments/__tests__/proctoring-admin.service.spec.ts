import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProctoringAdminService } from '../proctoring-admin.service.js';
import { Assessment } from '../entities/assessment.entity.js';

describe('ProctoringAdminService', () => {
  let service: ProctoringAdminService;
  let qb: Record<string, jest.Mock>;
  let assessmentRepo: { createQueryBuilder: jest.Mock };

  const rawRow = {
    assessmentId: 'a1',
    candidateEmail: 'cheat@demo.ma',
    specialtyName: 'Software Engineer',
    status: 'completed',
    score: '42',
    tabSwitchCount: '9',
    windowBlurCount: '4',
    proctoringFlagged: true,
    multiAccountFlagged: false,
    plagiarismVerdict: 'suspected',
    ipAddress: '196.200.1.1',
    startedAt: new Date('2026-09-01'),
    completedAt: new Date('2026-09-01'),
  };

  beforeEach(async () => {
    // One chainable builder reused for both the rows query and the counts
    // query (base() is called twice); it answers getRawMany and getRawOne.
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([rawRow]),
      getRawOne: jest.fn().mockResolvedValue({
        proctoring: '3',
        multiAccount: '1',
        plagiarism: '2',
        total: '5',
      }),
    };
    assessmentRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProctoringAdminService,
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
      ],
    }).compile();

    service = module.get(ProctoringAdminService);
  });

  it('maps raw rows to typed integrity rows and coerces numerics', async () => {
    const result = await service.list(true);
    expect(qb.where).toHaveBeenCalled(); // onlyFlagged → WHERE clause applied
    expect(result.items).toHaveLength(1);
    const row = result.items[0];
    expect(row.score).toBe(42);
    expect(row.tabSwitchCount).toBe(9);
    expect(row.windowBlurCount).toBe(4);
    expect(row.proctoringFlagged).toBe(true);
    expect(row.multiAccountFlagged).toBe(false);
    expect(row.plagiarismVerdict).toBe('suspected');
    expect(result.counts).toEqual({
      proctoring: 3,
      multiAccount: 1,
      plagiarism: 2,
      total: 5,
    });
  });

  it('omits the WHERE clause when not filtering to flagged only', async () => {
    await service.list(false);
    expect(qb.where).not.toHaveBeenCalled();
  });

  it('defaults a null score and null count row to safe values', async () => {
    qb.getRawMany.mockResolvedValue([{ ...rawRow, score: null }]);
    qb.getRawOne.mockResolvedValue(undefined);
    const result = await service.list(true);
    expect(result.items[0].score).toBeNull();
    expect(result.counts.total).toBe(0);
  });
});
