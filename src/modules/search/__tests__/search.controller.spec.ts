import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { SearchController } from '../search.controller.js';
import { SearchService } from '../search.service.js';
import { SubscriptionGuardService } from '../../companies/subscription-guard.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: Record<string, jest.Mock>;
  let subscriptionGuard: Record<string, jest.Mock>;

  const recruiterUser: JwtPayload = {
    sub: 'user-recruiter-1',
    email: 'recruiter@example.com',
    roles: [Role.RECRUITER],
  };

  const adminUser: JwtPayload = {
    sub: 'user-admin-1',
    email: 'admin@example.com',
    roles: [Role.ADMIN],
  };

  const mockResult = { items: [], nextCursor: null };

  beforeEach(async () => {
    searchService = {
      searchCandidates: jest.fn().mockResolvedValue(mockResult),
    };
    subscriptionGuard = {
      assertActiveSubscription: jest
        .fn()
        .mockResolvedValue({ companyId: 'company-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: searchService },
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
      ],
    }).compile();

    controller = module.get(SearchController);
  });

  describe('US-SRCH-02 — accès conditionné à un abonnement actif', () => {
    it('allows a recruiter whose subscription is active', async () => {
      const result = await controller.searchCandidates(recruiterUser, {});

      expect(subscriptionGuard.assertActiveSubscription).toHaveBeenCalledWith(
        recruiterUser.sub,
      );
      expect(searchService.searchCandidates).toHaveBeenCalledWith({});
      expect(result).toBe(mockResult);
    });

    it('propagates the guard rejection (e.g. expired trial, no subscription)', async () => {
      subscriptionGuard.assertActiveSubscription.mockRejectedValue(
        new ForbiddenException('Un abonnement actif est requis'),
      );

      await expect(
        controller.searchCandidates(recruiterUser, {}),
      ).rejects.toThrow(ForbiddenException);
      expect(searchService.searchCandidates).not.toHaveBeenCalled();
    });

    it('bypasses the subscription check for admins', async () => {
      const result = await controller.searchCandidates(adminUser, {});

      expect(subscriptionGuard.assertActiveSubscription).not.toHaveBeenCalled();
      expect(searchService.searchCandidates).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });
  });

  describe('délégation des filtres', () => {
    it('forwards query filters to the search service unchanged', async () => {
      const filters = { q: 'react', scoreMin: 50 };

      await controller.searchCandidates(recruiterUser, filters);

      expect(searchService.searchCandidates).toHaveBeenCalledWith(filters);
    });
  });
});
