import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from '../company.controller.js';
import { CompanyService } from '../company.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('CompanyController', () => {
  let controller: CompanyController;
  let service: Record<string, jest.Mock>;

  const authenticatedUser: JwtPayload = {
    sub: 'user-1',
    email: 'recruiter@acme.ma',
    roles: [Role.RECRUITER],
  };

  const mockResult = {
    company: { id: 'company-1', name: 'Acme Corp' },
    subscription: { id: 'subscription-1', status: 'trial' },
  };

  beforeEach(async () => {
    service = {
      createCompany: jest.fn().mockResolvedValue(mockResult),
      getMyCompany: jest.fn().mockResolvedValue(mockResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [{ provide: CompanyService, useValue: service }],
    }).compile();

    controller = module.get(CompanyController);
  });

  describe('createCompany', () => {
    it('should create a company for the authenticated user', async () => {
      const dto = { name: 'Acme Corp', ice: '000000000000001' };

      const result = await controller.createCompany(authenticatedUser, dto);

      expect(service.createCompany).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(mockResult);
    });
  });

  describe('getMyCompany', () => {
    it("should return the caller's own company, never a client-supplied id", async () => {
      const result = await controller.getMyCompany(authenticatedUser);

      expect(service.getMyCompany).toHaveBeenCalledWith('user-1');
      expect(result).toBe(mockResult);
    });
  });
});
