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
});
