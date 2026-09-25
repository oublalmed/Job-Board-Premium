import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataRequestService } from '../data-request.service.js';
import {
  DataRequest,
  DataRequestStatus,
  DataRequestType,
} from '../entities/data-request.entity.js';
import { CandidateDataService } from '../candidate-data.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';

describe('DataRequestService', () => {
  let service: DataRequestService;
  let requestRepo: Record<string, jest.Mock>;
  let candidateDataService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const userId = 'user-001';
  const adminId = 'admin-001';

  beforeEach(async () => {
    requestRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn((v: Partial<DataRequest>) => v),
      save: jest.fn((v: DataRequest) => Promise.resolve({ id: 'req-1', ...v })),
    };
    candidateDataService = {
      deleteData: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRequestService,
        { provide: getRepositoryToken(DataRequest), useValue: requestRepo },
        { provide: CandidateDataService, useValue: candidateDataService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(DataRequestService);
  });

  describe('create', () => {
    it('files a pending request with a 30-day deadline and audits it', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      const before = Date.now();

      const result = await service.create(
        userId,
        DataRequestType.ACCESS,
        '  please  ',
      );

      expect(result.status).toBe(DataRequestStatus.PENDING);
      expect(result.message).toBe('please');
      const due = new Date(result.dueAt).getTime();
      // ~30 days out (allow a small execution window).
      expect(due).toBeGreaterThanOrEqual(before + 29 * 86400_000);
      expect(due).toBeLessThanOrEqual(Date.now() + 31 * 86400_000);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: userId,
          action: AuditAction.DATA_REQUEST_CREATED,
          entityType: 'DataRequest',
        }),
      );
    });

    it('normalizes a blank message to null', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      const result = await service.create(
        userId,
        DataRequestType.ERASURE,
        '   ',
      );
      expect(result.message).toBeNull();
    });

    it('rejects a duplicate open request of the same type', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'existing',
        status: DataRequestStatus.PENDING,
      });

      await expect(
        service.create(userId, DataRequestType.ACCESS),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(requestRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('paginates and orders by soonest due', async () => {
      requestRepo.findAndCount.mockResolvedValue([[{ id: 'a' }], 1]);

      const result = await service.search({ page: 2, limit: 10 });

      expect(requestRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { dueAt: 'ASC' },
          skip: 10,
          take: 10,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(2);
      expect(result.pageCount).toBe(1);
    });

    it('clamps an oversized limit', async () => {
      requestRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.search({ limit: 9999 });
      expect(requestRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('updateStatus', () => {
    it('runs the real erasure when an erasure request is completed', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        userId,
        type: DataRequestType.ERASURE,
        status: DataRequestStatus.PENDING,
      });

      const result = await service.updateStatus(
        'req-1',
        adminId,
        DataRequestStatus.COMPLETED,
        'done',
      );

      expect(candidateDataService.deleteData).toHaveBeenCalledWith(userId);
      expect(result.status).toBe(DataRequestStatus.COMPLETED);
      expect(result.handledByUserId).toBe(adminId);
      expect(result.resolvedAt).toBeInstanceOf(Date);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DATA_REQUEST_RESOLVED,
        }),
      );
    });

    it('does not anonymize for a non-erasure completion', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-2',
        userId,
        type: DataRequestType.ACCESS,
        status: DataRequestStatus.IN_PROGRESS,
      });

      await service.updateStatus('req-2', adminId, DataRequestStatus.COMPLETED);

      expect(candidateDataService.deleteData).not.toHaveBeenCalled();
    });

    it('leaves resolvedAt null for a non-terminal transition', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-3',
        userId,
        type: DataRequestType.ACCESS,
        status: DataRequestStatus.PENDING,
      });

      const result = await service.updateStatus(
        'req-3',
        adminId,
        DataRequestStatus.IN_PROGRESS,
      );

      expect(result.resolvedAt).toBeNull();
    });

    it('rejects transitioning an already-terminal request', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-4',
        userId,
        type: DataRequestType.ACCESS,
        status: DataRequestStatus.COMPLETED,
      });

      await expect(
        service.updateStatus('req-4', adminId, DataRequestStatus.REJECTED),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('missing', adminId, DataRequestStatus.COMPLETED),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not persist status if erasure anonymization fails', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-5',
        userId,
        type: DataRequestType.ERASURE,
        status: DataRequestStatus.PENDING,
      });
      candidateDataService.deleteData.mockRejectedValueOnce(
        new Error('storage down'),
      );

      await expect(
        service.updateStatus('req-5', adminId, DataRequestStatus.COMPLETED),
      ).rejects.toThrow('storage down');
      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });
});
