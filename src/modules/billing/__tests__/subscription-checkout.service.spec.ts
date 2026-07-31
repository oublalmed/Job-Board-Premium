import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionCheckoutService } from '../subscription-checkout.service.js';
import {
  CompanyAlreadySubscribedException,
  NoActiveSubscriptionToCancelException,
} from '../billing.exceptions.js';
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
  let subscriptionRepo: { findOne: jest.Mock; save: jest.Mock };
  let paymentProvider: {
    createCheckoutSession: jest.Mock;
    cancelAtPeriodEnd: jest.Mock;
  };
  let configService: { get: jest.Mock };

  const userId = 'user-1';
  const companyId = 'company-1';

  beforeEach(async () => {
    subscriptionGuard = {
      resolveCompanyId: jest.fn().mockResolvedValue(companyId),
    };
    subscriptionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data: unknown) => Promise.resolve(data)),
    };
    paymentProvider = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        url: 'https://checkout.stripe.com/test/cs_1',
        providerSessionId: 'cs_1',
      }),
      cancelAtPeriodEnd: jest.fn().mockResolvedValue(undefined),
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

  it('resolves companyId server-side and charges the TTC amount (HT + 20% VAT), not the raw HT config price', async () => {
    const result = await service.createCheckoutSession(userId, {
      plan: SubscriptionPlan.GROWTH,
      successUrl: 'https://app.local/success',
      cancelUrl: 'https://app.local/cancel',
    });

    expect(subscriptionGuard.resolveCompanyId).toHaveBeenCalledWith(userId);
    expect(paymentProvider.createCheckoutSession).toHaveBeenCalledWith({
      companyId,
      plan: SubscriptionPlan.GROWTH,
      amount: 348000, // 290000 HT + 20% VAT (58000) = 348000 TTC
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

  describe('cancelSubscription', () => {
    it('resolves companyId server-side (ADR-0001), calls the provider, and sets cancelAtPeriodEnd', async () => {
      const periodEnd = new Date('2026-08-15T00:00:00.000Z');
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: 'sub_ext_1',
        endsAt: periodEnd,
        cancelAtPeriodEnd: false,
      });

      const result = await service.cancelSubscription(userId);

      expect(subscriptionGuard.resolveCompanyId).toHaveBeenCalledWith(userId);
      expect(paymentProvider.cancelAtPeriodEnd).toHaveBeenCalledWith(
        'sub_ext_1',
      );
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cancelAtPeriodEnd: true }),
      );
      expect(result).toEqual({ cancelAtPeriodEnd: true, periodEnd });
    });

    it('accepts a PAST_DUE subscription too (still within grace, cancellation can be scheduled)', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.PAST_DUE,
        externalSubscriptionId: 'sub_ext_2',
        endsAt: null,
        cancelAtPeriodEnd: false,
      });

      await expect(service.cancelSubscription(userId)).resolves.toEqual(
        expect.objectContaining({ cancelAtPeriodEnd: true }),
      );
      expect(subscriptionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId }),
        }),
      );
    });

    it('is idempotent — a second call does not call the provider again', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: 'sub_ext_3',
        endsAt: null,
        cancelAtPeriodEnd: true, // already scheduled
      });

      await service.cancelSubscription(userId);

      expect(paymentProvider.cancelAtPeriodEnd).not.toHaveBeenCalled();
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
    });

    it('throws NoActiveSubscriptionToCancelException when there is no ACTIVE/PAST_DUE subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelSubscription(userId)).rejects.toThrow(
        NoActiveSubscriptionToCancelException,
      );
      expect(paymentProvider.cancelAtPeriodEnd).not.toHaveBeenCalled();
    });
  });
});
