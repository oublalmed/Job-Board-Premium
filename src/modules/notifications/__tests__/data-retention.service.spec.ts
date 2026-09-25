import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataRetentionService } from '../data-retention.service.js';
import { Notification } from '../entities/notification.entity.js';

describe('DataRetentionService (ENF-12)', () => {
  let service: DataRetentionService;
  let execute: jest.Mock;
  let where: jest.Mock;
  let andWhere: jest.Mock;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    execute = jest.fn().mockResolvedValue({ affected: 7 });
    andWhere = jest.fn().mockReturnValue({ execute });
    where = jest.fn().mockReturnValue({ andWhere });
    const qb = {
      delete: jest.fn().mockReturnValue({ where }),
    };
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    configService = { get: jest.fn().mockReturnValue(90) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        { provide: getRepositoryToken(Notification), useValue: repo },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(DataRetentionService);
  });

  it('purges only READ notifications older than the retention window', async () => {
    const before = Date.now();
    const result = await service.sweep();

    // Filters on read_at NOT NULL and created_at < cutoff.
    expect(where).toHaveBeenCalledWith('read_at IS NOT NULL');
    const [clause, params] = andWhere.mock.calls[0] as [string, { cutoff: Date }];
    expect(clause).toContain('created_at <');
    // cutoff ≈ now - 90d.
    const expected = before - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(params.cutoff.getTime() - expected)).toBeLessThan(5000);

    expect(result.deletedNotifications).toBe(7);
  });

  it('honours a configured retention window', async () => {
    configService.get.mockReturnValue(30);
    const before = Date.now();
    await service.sweep();
    const params = andWhere.mock.calls[0][1] as { cutoff: Date };
    const expected = before - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(params.cutoff.getTime() - expected)).toBeLessThan(5000);
  });

  it('reports zero when nothing matched (affected null)', async () => {
    execute.mockResolvedValue({ affected: null });
    const result = await service.sweep();
    expect(result.deletedNotifications).toBe(0);
  });
});
