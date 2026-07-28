import { Test, TestingModule } from '@nestjs/testing';
import { CandidateDataController } from '../candidate-data.controller.js';
import { CandidateDataService } from '../candidate-data.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('CandidateDataController', () => {
  let controller: CandidateDataController;
  let service: Record<string, jest.Mock>;

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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidateDataController],
      providers: [{ provide: CandidateDataService, useValue: service }],
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
});
