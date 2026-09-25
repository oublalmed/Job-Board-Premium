import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit.service.js';
import { AuditLog } from '../entities/audit-log.entity.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<Partial<Repository<AuditLog>>>;

  beforeEach(async () => {
    repo = {
      create: jest
        .fn()
        .mockImplementation((entity: Partial<AuditLog>) => entity as AuditLog),
      save: jest.fn().mockImplementation((entity: Partial<AuditLog>) =>
        Promise.resolve({
          id: 'audit-id',
          createdAt: new Date(),
          ...entity,
        } as AuditLog),
      ),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should create an audit log entry', async () => {
    const result = await service.log({
      actorId: 'user-123',
      action: AuditAction.USER_LOGIN,
      entityType: 'user',
      entityId: 'user-123',
      ipAddress: '192.168.1.1',
    });

    expect(repo.save).toHaveBeenCalled();
    expect(result.action).toBe(AuditAction.USER_LOGIN);
    expect(result.actorId).toBe('user-123');
  });

  it('should handle system actions (no actor)', async () => {
    const result = await service.log({
      action: AuditAction.SCORE_CALCULATED,
      entityType: 'score',
      entityId: 'score-456',
    });

    expect(result.actorId).toBeNull();
  });

  it('should handle minimal audit data', async () => {
    const result = await service.log({
      action: AuditAction.SETTINGS_CHANGED,
    });

    expect(repo.save).toHaveBeenCalled();
    expect(result.entityType).toBeNull();
    expect(result.entityId).toBeNull();
    expect(result.metadata).toBeNull();
  });

  describe('search', () => {
    it('applies defaults (newest first, page 1, limit 20) and clamps pagination', async () => {
      const result = await service.search({ page: 0, limit: 5000 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          order: { createdAt: 'DESC', id: 'DESC' },
          skip: 0,
          take: 100,
        }),
      );
      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 100,
        pageCount: 0,
      });
    });

    it('builds exact-match filters and a closed date range', async () => {
      await service.search({
        action: AuditAction.USER_LOGIN,
        actorId: 'user-123',
        entityType: 'user',
        entityId: 'user-123',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
        page: 2,
        limit: 10,
      });

      const call = (repo.findAndCount as jest.Mock).mock.calls[0][0];
      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
      expect(call.where.action).toBe(AuditAction.USER_LOGIN);
      expect(call.where.actorId).toBe('user-123');
      expect(call.where.entityType).toBe('user');
      expect(call.where.entityId).toBe('user-123');
      // Between(...) FindOperator over createdAt
      expect(call.where.createdAt).toBeDefined();
    });

    it('computes pageCount from total and limit', async () => {
      (repo.findAndCount as jest.Mock).mockResolvedValueOnce([
        [{ id: 'a' } as AuditLog],
        45,
      ]);

      const result = await service.search({ limit: 20 });

      expect(result.total).toBe(45);
      expect(result.pageCount).toBe(3);
    });

    it('supports an open-ended (from only) date range', async () => {
      await service.search({ from: '2026-01-01T00:00:00.000Z' });
      const call = (repo.findAndCount as jest.Mock).mock.calls[0][0];
      expect(call.where.createdAt).toBeDefined();
    });
  });
});
