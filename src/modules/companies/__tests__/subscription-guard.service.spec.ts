import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { SubscriptionGuardService } from '../subscription-guard.service.js';
import { Recruiter } from '../entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../entities/subscription.entity.js';

describe('SubscriptionGuardService', () => {
  let service: SubscriptionGuardService;
  let recruiterRepo: Record<string, jest.Mock>;
  let subscriptionRepo: Record<string, jest.Mock>;

  const userId = 'user-1';
  const mockRecruiter = { id: 'recruiter-1', userId, companyId: 'company-1' };

  beforeEach(async () => {
    recruiterRepo = { findOne: jest.fn().mockResolvedValue(mockRecruiter) };
    subscriptionRepo = {
      findOne: jest.fn().mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        endsAt: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuardService,
        { provide: getRepositoryToken(Recruiter), useValue: recruiterRepo },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
      ],
    }).compile();

    service = module.get(SubscriptionGuardService);
  });

  it('resolves the companyId for an active subscription', async () => {
    const result = await service.assertActiveSubscription(userId);

    expect(result).toEqual({ companyId: 'company-1' });
  });

  it('allows a trial subscription not yet expired', async () => {
    subscriptionRepo.findOne.mockResolvedValue({
      status: SubscriptionStatus.TRIAL,
      endsAt: new Date(Date.now() + 3600000),
    });

    await expect(service.assertActiveSubscription(userId)).resolves.toEqual({
      companyId: 'company-1',
    });
  });

  it('rejects an expired trial subscription', async () => {
    subscriptionRepo.findOne.mockResolvedValue({
      status: SubscriptionStatus.TRIAL,
      endsAt: new Date(Date.now() - 3600000),
    });

    await expect(service.assertActiveSubscription(userId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a cancelled subscription', async () => {
    subscriptionRepo.findOne.mockResolvedValue({
      status: SubscriptionStatus.CANCELLED,
      endsAt: null,
    });

    await expect(service.assertActiveSubscription(userId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects when there is no subscription at all', async () => {
    subscriptionRepo.findOne.mockResolvedValue(null);

    await expect(service.assertActiveSubscription(userId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects when the caller has no recruiter account', async () => {
    recruiterRepo.findOne.mockResolvedValue(null);

    await expect(service.assertActiveSubscription(userId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(subscriptionRepo.findOne).not.toHaveBeenCalled();
  });
});
