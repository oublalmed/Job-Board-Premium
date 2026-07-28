import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { SearchController } from '../search.controller.js';
import { SearchService } from '../search.service.js';
import { Recruiter } from '../../companies/entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../../companies/entities/subscription.entity.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: Record<string, jest.Mock>;
  let recruiterRepo: Record<string, jest.Mock>;
  let subscriptionRepo: Record<string, jest.Mock>;

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

  const mockRecruiter = {
    id: 'recruiter-1',
    userId: recruiterUser.sub,
    companyId: 'company-1',
  };

  const mockResult = { items: [], nextCursor: null };

  beforeEach(async () => {
    searchService = {
      searchCandidates: jest.fn().mockResolvedValue(mockResult),
    };
    recruiterRepo = {
      findOne: jest.fn().mockResolvedValue(mockRecruiter),
    };
    subscriptionRepo = {
      findOne: jest.fn().mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        endsAt: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: searchService },
        { provide: getRepositoryToken(Recruiter), useValue: recruiterRepo },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
      ],
    }).compile();

    controller = module.get(SearchController);
  });

  describe('US-SRCH-02 — accès conditionné à un abonnement actif', () => {
    it('allows a recruiter with an active subscription', async () => {
      const result = await controller.searchCandidates(recruiterUser, {});

      expect(searchService.searchCandidates).toHaveBeenCalledWith({});
      expect(result).toBe(mockResult);
    });

    it('allows a recruiter with a trial subscription not yet expired', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.TRIAL,
        endsAt: new Date(Date.now() + 3600000),
      });

      await controller.searchCandidates(recruiterUser, {});

      expect(searchService.searchCandidates).toHaveBeenCalled();
    });

    it('rejects a recruiter whose trial subscription has expired', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.TRIAL,
        endsAt: new Date(Date.now() - 3600000),
      });

      await expect(
        controller.searchCandidates(recruiterUser, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a recruiter with a cancelled subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.CANCELLED,
        endsAt: null,
      });

      await expect(
        controller.searchCandidates(recruiterUser, {}),
      ).rejects.toThrow(ForbiddenException);
      expect(searchService.searchCandidates).not.toHaveBeenCalled();
    });

    it('rejects a recruiter with no subscription at all', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.searchCandidates(recruiterUser, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a user with no recruiter account', async () => {
      recruiterRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.searchCandidates(recruiterUser, {}),
      ).rejects.toThrow(ForbiddenException);
      expect(subscriptionRepo.findOne).not.toHaveBeenCalled();
    });

    it('bypasses the subscription check for admins', async () => {
      const result = await controller.searchCandidates(adminUser, {});

      expect(recruiterRepo.findOne).not.toHaveBeenCalled();
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
