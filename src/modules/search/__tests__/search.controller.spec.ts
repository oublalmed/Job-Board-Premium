import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SearchController } from '../search.controller.js';
import { SearchService } from '../search.service.js';
import { ProfileViewService } from '../profile-view.service.js';
import { SubscriptionGuardService } from '../../companies/subscription-guard.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: Record<string, jest.Mock>;
  let subscriptionGuard: Record<string, jest.Mock>;
  let profileViewService: Record<string, jest.Mock>;

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
      getCandidateDetail: jest.fn().mockResolvedValue({ id: 'profile-1' }),
    };
    subscriptionGuard = {
      assertActiveSubscription: jest
        .fn()
        .mockResolvedValue({ companyId: 'company-1' }),
    };
    profileViewService = {
      recordView: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: searchService },
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: ProfileViewService, useValue: profileViewService },
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

  describe('GET /search/candidates/:id (EF-GROW-04)', () => {
    const profileId = '11111111-1111-1111-1111-111111111111';

    it('requires an active subscription for a non-admin recruiter, then returns the detail and records the view', async () => {
      const result = await controller.getCandidateDetail(
        recruiterUser,
        profileId,
      );

      expect(subscriptionGuard.assertActiveSubscription).toHaveBeenCalledWith(
        recruiterUser.sub,
      );
      expect(searchService.getCandidateDetail).toHaveBeenCalledWith(
        profileId,
      );
      expect(profileViewService.recordView).toHaveBeenCalledWith(
        recruiterUser.sub,
        'company-1',
        profileId,
      );
      expect(result).toEqual({ id: 'profile-1' });
    });

    it('propagates a 404 from the search service without recording a view', async () => {
      searchService.getCandidateDetail.mockRejectedValue(
        new NotFoundException('Candidate profile not found'),
      );

      await expect(
        controller.getCandidateDetail(recruiterUser, profileId),
      ).rejects.toThrow(NotFoundException);
      expect(profileViewService.recordView).not.toHaveBeenCalled();
    });

    it('propagates the subscription guard rejection and never reaches the detail lookup', async () => {
      subscriptionGuard.assertActiveSubscription.mockRejectedValue(
        new ForbiddenException('Un abonnement actif est requis'),
      );

      await expect(
        controller.getCandidateDetail(recruiterUser, profileId),
      ).rejects.toThrow(ForbiddenException);
      expect(searchService.getCandidateDetail).not.toHaveBeenCalled();
      expect(profileViewService.recordView).not.toHaveBeenCalled();
    });

    it('bypasses the subscription check and view tracking for admins (no company behind an admin view)', async () => {
      const result = await controller.getCandidateDetail(
        adminUser,
        profileId,
      );

      expect(subscriptionGuard.assertActiveSubscription).not.toHaveBeenCalled();
      expect(searchService.getCandidateDetail).toHaveBeenCalledWith(
        profileId,
      );
      expect(profileViewService.recordView).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'profile-1' });
    });
  });
});
