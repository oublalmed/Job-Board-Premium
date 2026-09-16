import { Test, TestingModule } from '@nestjs/testing';
import { CandidateDataController } from '../candidate-data.controller.js';
import { CandidateDataService } from '../candidate-data.service.js';
import { DataRequestService } from '../data-request.service.js';
import { DataRequestType } from '../entities/data-request.entity.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('CandidateDataController', () => {
  let controller: CandidateDataController;
  let service: Record<string, jest.Mock>;
  let dataRequestService: Record<string, jest.Mock>;

  const authenticatedUser: JwtPayload = {
    sub: 'user-self',
    email: 'self@example.com',
    roles: [Role.CANDIDATE],
  };

  const otherUserId = 'user-other';

  const mockExport = {
    exportDate: '2026-07-28T00:00:00.000Z',
    user: { email: 'self@example.com', roles: [Role.CANDIDATE] },
    profile: null,
    experiences: [],
    skills: [],
    links: [],
    documents: [],
  };

  beforeEach(async () => {
    service = {
      exportData: jest.fn().mockResolvedValue(mockExport),
      deleteData: jest.fn().mockResolvedValue(undefined),
    };
    dataRequestService = {
      create: jest.fn().mockImplementation((userId: string, type: string) =>
        Promise.resolve({
          id: 'req-1',
          userId,
          type,
          status: 'pending',
          message: null,
          resolutionNote: null,
          handledByUserId: null,
          dueAt: new Date('2026-10-16T00:00:00.000Z'),
          resolvedAt: null,
          createdAt: new Date('2026-09-16T00:00:00.000Z'),
          updatedAt: new Date('2026-09-16T00:00:00.000Z'),
        }),
      ),
      listForUser: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidateDataController],
      providers: [
        { provide: CandidateDataService, useValue: service },
        { provide: DataRequestService, useValue: dataRequestService },
      ],
    }).compile();

    controller = module.get(CandidateDataController);
  });

  describe('exportData', () => {
    it('should export data for the authenticated user', async () => {
      const result = await controller.exportData(authenticatedUser);

      expect(service.exportData).toHaveBeenCalledWith('user-self');
      expect(result).toEqual(mockExport);
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.exportData(authenticatedUser);

      expect(service.exportData).not.toHaveBeenCalledWith(otherUserId);
      expect(service.exportData).toHaveBeenCalledTimes(1);
      expect(service.exportData.mock.calls[0][0]).toBe(authenticatedUser.sub);
    });
  });

  describe('deleteData', () => {
    it('should delete data for the authenticated user', async () => {
      const result = await controller.deleteData(authenticatedUser);

      expect(service.deleteData).toHaveBeenCalledWith('user-self');
      expect(result).toEqual({
        message: 'Account data deleted and anonymized',
      });
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.deleteData(authenticatedUser);

      expect(service.deleteData).not.toHaveBeenCalledWith(otherUserId);
      expect(service.deleteData).toHaveBeenCalledTimes(1);
      expect(service.deleteData.mock.calls[0][0]).toBe(authenticatedUser.sub);
    });
  });

  describe('createRequest', () => {
    it('files a request for the authenticated user and returns the wire shape', async () => {
      const result = await controller.createRequest(authenticatedUser, {
        type: DataRequestType.ACCESS,
        message: 'please',
      });

      expect(dataRequestService.create).toHaveBeenCalledWith(
        'user-self',
        DataRequestType.ACCESS,
        'please',
      );
      expect(result.dueAt).toBe('2026-10-16T00:00:00.000Z');
      expect(result).not.toHaveProperty('user');
    });

    it('always uses user.sub as the subject', async () => {
      await controller.createRequest(authenticatedUser, {
        type: DataRequestType.ERASURE,
      });
      expect(dataRequestService.create.mock.calls[0][0]).toBe(
        authenticatedUser.sub,
      );
    });
  });

  describe('listRequests', () => {
    it('lists the authenticated user own requests', async () => {
      await controller.listRequests(authenticatedUser);
      expect(dataRequestService.listForUser).toHaveBeenCalledWith('user-self');
    });
  });
});
