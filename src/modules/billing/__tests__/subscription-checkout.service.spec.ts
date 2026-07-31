import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionCheckoutService } from '../subscription-checkout.service.js';
import {
  CompanyAlreadySubscribedException,
  NoActiveSubscriptionToCancelException,
  NoActiveSubscriptionToChangePlanException,
  SamePlanException,
} from '../billing.exceptions.js';
import { SubscriptionGuardService } from '../../companies/subscription-guard.service.js';
import { PAYMENT_PROVIDER } from '../../../ports/payment.port.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../companies/entities/subscription.entity.js';
import { AuditService } from '../../audit/audit.service.js';

describe('SubscriptionCheckoutService', () => {
  let service: SubscriptionCheckoutService;
  let subscriptionGuard: { resolveCompanyId: jest.Mock };
  let subscriptionRepo: { findOne: jest.Mock; save: jest.Mock };
  let paymentProvider: {
    createCheckoutSession: jest.Mock;
    cancelAtPeriodEnd: jest.Mock;
    changeSubscriptionPlan: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let auditService: { log: jest.Mock };

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
      changeSubscriptionPlan: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'business.plans.growth.price') return 2900;
        if (key === 'business.plans.growth.contacts') return 60;
        if (key === 'business.plans.scale.price') return 6900;
        if (key === 'business.plans.scale.contacts') return 200;
        if (key === 'business.plans.starter.price') return 990;
        if (key === 'business.plans.starter.contacts') return 15;
        if (key === 'business.currency') return 'MAD';
        return fallback;
      }),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionCheckoutService,
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: getRepositoryToken(Subscription), useValue: subscriptionRepo },
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
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

  describe('changePlan', () => {
    it('upgrades: applies the change at Stripe (proration) and reajusts quota immediately, preserving contactsUsed', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        plan: SubscriptionPlan.GROWTH,
        externalSubscriptionId: 'sub_ext_1',
        contactQuota: 60,
        contactsUsed: 45,
      });

      const result = await service.changePlan(userId, {
        plan: SubscriptionPlan.SCALE,
      });

      expect(subscriptionGuard.resolveCompanyId).toHaveBeenCalledWith(userId);
      expect(paymentProvider.changeSubscriptionPlan).toHaveBeenCalledWith({
        providerSubscriptionId: 'sub_ext_1',
        plan: SubscriptionPlan.SCALE,
        amount: 828000, // scale: 690000 HT + 20% VAT = 828000 TTC
        currency: 'MAD',
      });
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: SubscriptionPlan.SCALE,
          contactQuota: 200,
          contactsUsed: 45, // preserved, not reset
        }),
      );
      expect(result).toEqual({
        plan: SubscriptionPlan.SCALE,
        contactQuota: 200,
        contactsUsed: 45,
      });
    });

    it('downgrades: allows contactQuota to drop below contactsUsed — no special-casing, capped by the existing atomic guard elsewhere', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        plan: SubscriptionPlan.SCALE,
        externalSubscriptionId: 'sub_ext_2',
        contactQuota: 200,
        contactsUsed: 80, // above the new starter quota of 15
      });

      const result = await service.changePlan(userId, {
        plan: SubscriptionPlan.STARTER,
      });

      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: SubscriptionPlan.STARTER,
          contactQuota: 15,
          contactsUsed: 80, // preserved as-is, not clamped here
        }),
      );
      expect(result.contactQuota).toBe(15);
      expect(result.contactsUsed).toBe(80);
    });

    it('accepts a PAST_DUE subscription too', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.PAST_DUE,
        plan: SubscriptionPlan.GROWTH,
        externalSubscriptionId: 'sub_ext_3',
        contactQuota: 60,
        contactsUsed: 10,
      });

      await expect(
        service.changePlan(userId, { plan: SubscriptionPlan.SCALE }),
      ).resolves.toEqual(
        expect.objectContaining({ plan: SubscriptionPlan.SCALE }),
      );
    });

    it('throws SamePlanException when requesting the plan already in effect, without calling the provider', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        plan: SubscriptionPlan.GROWTH,
        externalSubscriptionId: 'sub_ext_4',
        contactQuota: 60,
        contactsUsed: 0,
      });

      await expect(
        service.changePlan(userId, { plan: SubscriptionPlan.GROWTH }),
      ).rejects.toThrow(SamePlanException);
      expect(paymentProvider.changeSubscriptionPlan).not.toHaveBeenCalled();
    });

    it('throws NoActiveSubscriptionToChangePlanException when there is no ACTIVE/PAST_DUE subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changePlan(userId, { plan: SubscriptionPlan.SCALE }),
      ).rejects.toThrow(NoActiveSubscriptionToChangePlanException);
      expect(paymentProvider.changeSubscriptionPlan).not.toHaveBeenCalled();
    });
  });
});
