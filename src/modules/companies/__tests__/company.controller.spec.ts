import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from '../company.controller.js';
import { CompanyService } from '../company.service.js';
import { SubscriptionGuardService } from '../subscription-guard.service.js';
import { ContactQuotaService } from '../contact-quota.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('CompanyController', () => {
  let controller: CompanyController;
  let service: Record<string, jest.Mock>;
  let subscriptionGuard: { resolveCompanyId: jest.Mock };
  let contactQuotaService: { getQuotaStatus: jest.Mock };

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
    subscriptionGuard = {
      resolveCompanyId: jest.fn().mockResolvedValue('company-1'),
    };
    contactQuotaService = {
      getQuotaStatus: jest.fn().mockResolvedValue({
        active: true,
        plan: 'growth',
        status: 'active',
        contactQuota: 60,
        contactsUsed: 12,
        contactsRemaining: 48,
        quotaResetAt: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        { provide: CompanyService, useValue: service },
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: ContactQuotaService, useValue: contactQuotaService },
      ],
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

  describe('getContactQuota', () => {
    it('resolves the company then returns its quota snapshot', async () => {
      const result = await controller.getContactQuota(authenticatedUser);

      expect(subscriptionGuard.resolveCompanyId).toHaveBeenCalledWith('user-1');
      expect(contactQuotaService.getQuotaStatus).toHaveBeenCalledWith(
        'company-1',
      );
      expect(result.contactsRemaining).toBe(48);
    });
  });
});
