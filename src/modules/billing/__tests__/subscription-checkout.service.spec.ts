import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionCheckoutService } from '../subscription-checkout.service.js';
import { CompanyAlreadySubscribedException } from '../billing.exceptions.js';
import { SubscriptionGuardService } from '../../companies/subscription-guard.service.js';
import { PAYMENT_PROVIDER } from '../../../ports/payment.port.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../companies/entities/subscription.entity.js';

describe('SubscriptionCheckoutService', () => {
  let service: SubscriptionCheckoutService;
  let subscriptionGuard: { resolveCompanyId: jest.Mock };
  let subscriptionRepo: { findOne: jest.Mock };
  let paymentProvider: { createCheckoutSession: jest.Mock };
  let configService: { get: jest.Mock };

  const userId = 'user-1';
  const companyId = 'company-1';

  beforeEach(async () => {
    subscriptionGuard = {
      resolveCompanyId: jest.fn().mockResolvedValue(companyId),
    };
    subscriptionRepo = { findOne: jest.fn().mockResolvedValue(null) };
    paymentProvider = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        url: 'https://checkout.stripe.com/test/cs_1',
        providerSessionId: 'cs_1',
      }),
    };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'business.plans.growth.price') return 2900;
        if (key === 'business.currency') return 'MAD';
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionCheckoutService,
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: getRepositoryToken(Subscription), useValue: subscriptionRepo },
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SubscriptionCheckoutService);
  });

  it('resolves companyId server-side and creates a checkout session with the amount in centimes', async () => {
    const result = await service.createCheckoutSession(userId, {
      plan: SubscriptionPlan.GROWTH,
      successUrl: 'https://app.local/success',
      cancelUrl: 'https://app.local/cancel',
    });

    expect(subscriptionGuard.resolveCompanyId).toHaveBeenCalledWith(userId);
    expect(paymentProvider.createCheckoutSession).toHaveBeenCalledWith({
      companyId,
      plan: SubscriptionPlan.GROWTH,
      amount: 290000,
      currency: 'MAD',
      successUrl: 'https://app.local/success',
      cancelUrl: 'https://app.local/cancel',
    });
    expect(result).toEqual({ url: 'https://checkout.stripe.com/test/cs_1' });
  });

  it('throws CompanyAlreadySubscribedException when the company already has an ACTIVE subscription, without calling the provider', async () => {
    subscriptionRepo.findOne.mockResolvedValue({
      companyId,
      status: SubscriptionStatus.ACTIVE,
    });

    await expect(
      service.createCheckoutSession(userId, {
        plan: SubscriptionPlan.GROWTH,
        successUrl: 'https://app.local/success',
        cancelUrl: 'https://app.local/cancel',
      }),
    ).rejects.toThrow(CompanyAlreadySubscribedException);

    expect(paymentProvider.createCheckoutSession).not.toHaveBeenCalled();
    expect(subscriptionRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId, status: SubscriptionStatus.ACTIVE },
      }),
    );
  });

  it('allows a checkout when the existing subscription is TRIAL (the normal upgrade path)', async () => {
    subscriptionRepo.findOne.mockResolvedValue(null); // query filters status=ACTIVE only

    await expect(
      service.createCheckoutSession(userId, {
        plan: SubscriptionPlan.GROWTH,
        successUrl: 'https://app.local/success',
        cancelUrl: 'https://app.local/cancel',
      }),
    ).resolves.toBeDefined();
  });
});
