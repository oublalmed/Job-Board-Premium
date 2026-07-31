import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryFailedError } from 'typeorm';
import { PaymentWebhookService } from '../payment-webhook.service.js';
import { PAYMENT_PROVIDER } from '../../../ports/payment.port.js';
import { InvalidWebhookSignatureException } from '../../../ports/payment.port.js';
import { AuditService } from '../../audit/audit.service.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../../companies/entities/subscription.entity.js';
import { Company } from '../../companies/entities/company.entity.js';
import { PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT } from '../entities/processed-webhook-event.entity.js';
import { InvoiceEmissionService } from '../invoice-emission.service.js';
import { DunningNotificationService } from '../dunning-notification.service.js';
import { TrialConversionService } from '../trial-conversion.service.js';

function uniqueViolation(constraint: string): QueryFailedError {
  const driverError = Object.assign(
    new Error('duplicate key value violates unique constraint'),
    { code: '23505', constraint },
  );
  return new QueryFailedError(
    'INSERT INTO "processed_webhook_events" ...',
    [],
    driverError,
  );
}

describe('PaymentWebhookService', () => {
  let service: PaymentWebhookService;
  let dataSource: { transaction: jest.Mock };
  let paymentProvider: { verifyAndParseWebhook: jest.Mock };
  let configService: { get: jest.Mock };
  let auditService: { log: jest.Mock };

  let manager: { getRepository: jest.Mock };
  let processedEventRepo: { insert: jest.Mock };
  let subscriptionRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let companyRepo: { findOneByOrFail: jest.Mock };
  let invoiceEmissionService: { emit: jest.Mock };
  let dunningNotificationService: {
    notifyPaymentFailed: jest.Mock;
    notifySubscriptionCancelled: jest.Mock;
    notifySubscriptionReactivated: jest.Mock;
  };
  let trialConversionService: { markConvertedIfApplicable: jest.Mock };

  const companyId = 'company-1';

  beforeEach(async () => {
    processedEventRepo = { insert: jest.fn().mockResolvedValue(undefined) };
    subscriptionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) =>
        Promise.resolve({ id: 'sub-1', ...(data as object) }),
      ),
    };
    companyRepo = {
      findOneByOrFail: jest
        .fn()
        .mockResolvedValue({ id: companyId, name: 'Acme', ice: '001234567000089' }),
    };
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Subscription) return subscriptionRepo;
        if (entity === Company) return companyRepo;
        return processedEventRepo;
      }),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    paymentProvider = { verifyAndParseWebhook: jest.fn() };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'business.plans.growth.contacts') return 60;
        return undefined;
      }),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    invoiceEmissionService = { emit: jest.fn().mockResolvedValue(undefined) };
    dunningNotificationService = {
      notifyPaymentFailed: jest.fn().mockResolvedValue(undefined),
      notifySubscriptionCancelled: jest.fn().mockResolvedValue(undefined),
      notifySubscriptionReactivated: jest.fn().mockResolvedValue(undefined),
    };
    trialConversionService = {
      markConvertedIfApplicable: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentWebhookService,
        { provide: DataSource, useValue: dataSource },
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
        { provide: InvoiceEmissionService, useValue: invoiceEmissionService },
        {
          provide: DunningNotificationService,
          useValue: dunningNotificationService,
        },
        {
          provide: TrialConversionService,
          useValue: trialConversionService,
        },
      ],
    }).compile();

    service = module.get(PaymentWebhookService);
  });

  it('propagates InvalidWebhookSignatureException and never opens a transaction', async () => {
    paymentProvider.verifyAndParseWebhook.mockImplementation(() => {
      throw new InvalidWebhookSignatureException();
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'bad-sig'),
    ).rejects.toThrow(InvalidWebhookSignatureException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('activates a subscription reusing an eligible TRIAL row and provisions the plan quota', async () => {
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      companyId,
      status: SubscriptionStatus.TRIAL,
    });
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'subscription.activated',
      providerEventId: 'evt_1',
      providerSessionId: 'cs_1',
      providerSubscriptionId: 'sub_1',
      companyId,
      plan: 'growth',
    });

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result.alreadyProcessed).toBe(false);
    expect(processedEventRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ providerEventId: 'evt_1', provider: 'stripe' }),
    );
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubscriptionStatus.ACTIVE,
        contactQuota: 60,
        contactsUsed: 0,
        externalSubscriptionId: 'sub_1',
        endsAt: expect.any(Date),
      }),
    );
    // Invoice emission (Lot 6C) is grafted onto the same activation, same
    // transaction, looked up by the company the event resolved to.
    expect(companyRepo.findOneByOrFail).toHaveBeenCalledWith({
      id: companyId,
    });
    expect(invoiceEmissionService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: 'evt_1',
        company: expect.objectContaining({ id: companyId }),
        subscription: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
        }),
      }),
      manager,
    );
    // Lot 7 (EF-GROW-03) — trial-code conversion tracking is a thin,
    // always-called hook (a no-op for a company with no redemption row),
    // in the same transaction as the activation itself.
    expect(trialConversionService.markConvertedIfApplicable).toHaveBeenCalledWith(
      companyId,
      manager,
    );
  });

  it('creates a fresh row when no TRIAL/PAST_DUE row is eligible', async () => {
    subscriptionRepo.findOne.mockResolvedValue(null);
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'subscription.activated',
      providerEventId: 'evt_2',
      providerSessionId: 'cs_2',
      providerSubscriptionId: 'sub_2',
      companyId,
      plan: 'growth',
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subscriptionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        status: SubscriptionStatus.ACTIVE,
        contactQuota: 60,
        externalSubscriptionId: 'sub_2',
        endsAt: expect.any(Date),
      }),
    );
    expect(invoiceEmissionService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ stripeEventId: 'evt_2' }),
      manager,
    );
  });

  it('returns alreadyProcessed:true and performs no business effect when the dedup marker constraint is violated', async () => {
    dataSource.transaction.mockRejectedValueOnce(
      uniqueViolation(PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT),
    );
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'subscription.activated',
      providerEventId: 'evt_3',
      providerSessionId: 'cs_3',
      providerSubscriptionId: 'sub_3',
      companyId,
      plan: 'growth',
    });

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result.alreadyProcessed).toBe(true);
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
    expect(invoiceEmissionService.emit).not.toHaveBeenCalled();
  });

  it('rethrows a non-unique-violation error from the transaction', async () => {
    dataSource.transaction.mockRejectedValueOnce(new Error('boom'));
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'subscription.activated',
      providerEventId: 'evt_4',
      providerSessionId: 'cs_4',
      providerSubscriptionId: 'sub_4',
      companyId,
      plan: 'growth',
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'sig'),
    ).rejects.toThrow('boom');
  });

  it('does NOT treat a 23505 on a different constraint as "already processed" — it propagates as a real error', async () => {
    // Simulates the race this discrimination exists for: the "no eligible
    // row, insert fresh" branch hits UQ_subscriptions_company_active
    // (Lot 6A) instead of the dedup marker's constraint. Swallowing this
    // as alreadyProcessed:true would silently lose a real activation and
    // tell Stripe everything is fine.
    dataSource.transaction.mockRejectedValueOnce(
      uniqueViolation('UQ_subscriptions_company_active'),
    );
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'subscription.activated',
      providerEventId: 'evt_race',
      providerSessionId: 'cs_race',
      providerSubscriptionId: 'sub_race',
      companyId,
      plan: 'growth',
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'sig'),
    ).rejects.toThrow(QueryFailedError);
  });

  it('does NOT treat a 23505 with no constraint name as "already processed" either', async () => {
    const driverError = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      { code: '23505' }, // no .constraint field at all
    );
    dataSource.transaction.mockRejectedValueOnce(
      new QueryFailedError('INSERT ...', [], driverError),
    );
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'subscription.activated',
      providerEventId: 'evt_no_constraint',
      providerSessionId: 'cs_x',
      providerSubscriptionId: 'sub_x',
      companyId,
      plan: 'growth',
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'sig'),
    ).rejects.toThrow(QueryFailedError);
  });

  it('ignores "ignored" events with no business effect (still recorded)', async () => {
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'ignored',
      providerEventId: 'evt_5',
      reason: 'unhandled event type customer.created',
    });

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result.alreadyProcessed).toBe(false);
    expect(processedEventRepo.insert).toHaveBeenCalled();
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('demotes an ACTIVE subscription to PAST_DUE on payment.failed', async () => {
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      companyId,
      status: SubscriptionStatus.ACTIVE,
    });
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'payment.failed',
      providerEventId: 'evt_6',
      companyId,
      reason: 'checkout.session.expired',
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SubscriptionStatus.PAST_DUE }),
    );
  });

  it('is a no-op (but still recorded) on payment.failed when there is no ACTIVE row', async () => {
    subscriptionRepo.findOne.mockResolvedValue(null);
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'payment.failed',
      providerEventId: 'evt_7',
      companyId,
      reason: 'checkout.session.expired',
    });

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result.alreadyProcessed).toBe(false);
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalled();
  });

  describe('subscription.renewed', () => {
    it('extends endsAt by the billing period, resets contactsUsed, and emits a new invoice', async () => {
      const currentEndsAt = new Date('2026-06-15T00:00:00.000Z');
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: 'sub_renew_1',
        endsAt: currentEndsAt,
        contactsUsed: 42,
        contactQuota: 60,
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.renewed',
        providerEventId: 'evt_renew_1',
        providerSubscriptionId: 'sub_renew_1',
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(false);
      expect(subscriptionRepo.findOne).toHaveBeenCalledWith({
        where: {
          externalSubscriptionId: 'sub_renew_1',
          status: expect.objectContaining({
            _type: 'in',
            _value: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
          }),
        },
      });
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          contactsUsed: 0,
          endsAt: new Date('2026-07-15T00:00:00.000Z'),
        }),
      );
      expect(invoiceEmissionService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeEventId: 'evt_renew_1',
          company: expect.objectContaining({ id: companyId }),
        }),
        manager,
      );
    });

    it('does not call assertValidSubscriptionTransition — a renewal stays ACTIVE, it is not a status transition', async () => {
      // If the guard were (incorrectly) invoked with ACTIVE -> ACTIVE, it
      // would throw (same-status "transitions" are rejected by design —
      // see subscription-lifecycle.ts). This test's mere success proves the
      // guard was not called with a rejecting pair.
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: 'sub_renew_2',
        endsAt: new Date('2026-06-15T00:00:00.000Z'),
        contactsUsed: 10,
        contactQuota: 60,
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.renewed',
        providerEventId: 'evt_renew_2',
        providerSubscriptionId: 'sub_renew_2',
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ alreadyProcessed: false });
    });

    it('throws when no ACTIVE subscription matches the Stripe subscription id (anomaly, not a silent no-op)', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.renewed',
        providerEventId: 'evt_renew_3',
        providerSubscriptionId: 'sub_unknown',
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow(/sub_unknown/);
      expect(invoiceEmissionService.emit).not.toHaveBeenCalled();
    });

    it('is idempotent on replay via the dedup marker — no second save/invoice', async () => {
      dataSource.transaction.mockRejectedValueOnce(
        uniqueViolation(PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT),
      );
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.renewed',
        providerEventId: 'evt_renew_4',
        providerSubscriptionId: 'sub_renew_4',
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(true);
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
      expect(invoiceEmissionService.emit).not.toHaveBeenCalled();
    });

    it('resumes a PAST_DUE subscription to ACTIVE, clears pastDueSince, and notifies reactivation', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.PAST_DUE,
        externalSubscriptionId: 'sub_resume_1',
        endsAt: new Date('2026-06-15T00:00:00.000Z'),
        pastDueSince: new Date('2026-06-20T00:00:00.000Z'),
        contactsUsed: 30,
        contactQuota: 60,
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.renewed',
        providerEventId: 'evt_resume_1',
        providerSubscriptionId: 'sub_resume_1',
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(false);
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          pastDueSince: null,
          contactsUsed: 0,
        }),
      );
      expect(
        dunningNotificationService.notifySubscriptionReactivated,
      ).toHaveBeenCalledWith(companyId, manager);
    });
  });

  describe('subscription.plan_changed', () => {
    it('emits an invoice for the exact amount Stripe charged, without touching plan/quota', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        plan: 'scale', // already updated synchronously by changePlan before this event arrives
        externalSubscriptionId: 'sub_plan_1',
        contactQuota: 200,
        contactsUsed: 45,
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.plan_changed',
        providerEventId: 'evt_plan_1',
        providerSubscriptionId: 'sub_plan_1',
        amountTTC: 42000,
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(false);
      // No status/plan/quota mutation here — save() is never called for
      // this event, only invoice emission and audit logging.
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
      expect(invoiceEmissionService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeEventId: 'evt_plan_1',
          amountTTCOverride: 42000,
          company: expect.objectContaining({ id: companyId }),
          subscription: expect.objectContaining({
            id: 'sub-1',
            plan: 'scale',
          }),
        }),
        manager,
      );
    });

    it('throws when no subscription matches the Stripe subscription id', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.plan_changed',
        providerEventId: 'evt_plan_2',
        providerSubscriptionId: 'sub_unknown',
        amountTTC: 10000,
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow(/sub_unknown/);
      expect(invoiceEmissionService.emit).not.toHaveBeenCalled();
    });

    it('is idempotent on replay via the dedup marker — no second invoice', async () => {
      dataSource.transaction.mockRejectedValueOnce(
        uniqueViolation(PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT),
      );
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.plan_changed',
        providerEventId: 'evt_plan_3',
        providerSubscriptionId: 'sub_plan_3',
        amountTTC: 15000,
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(true);
      expect(invoiceEmissionService.emit).not.toHaveBeenCalled();
    });
  });

  describe('subscription.past_due', () => {
    it('demotes an ACTIVE subscription to PAST_DUE, sets pastDueSince, and notifies', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: 'sub_pd_1',
        pastDueSince: null,
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.past_due',
        providerEventId: 'evt_pd_1',
        providerSubscriptionId: 'sub_pd_1',
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(false);
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SubscriptionStatus.PAST_DUE,
          pastDueSince: expect.any(Date),
        }),
      );
      expect(
        dunningNotificationService.notifyPaymentFailed,
      ).toHaveBeenCalledWith(companyId, manager);
    });

    it('a second failure on an already-PAST_DUE subscription does not re-attempt the transition or overwrite pastDueSince', async () => {
      const firstFailure = new Date('2026-06-20T00:00:00.000Z');
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.PAST_DUE,
        externalSubscriptionId: 'sub_pd_2',
        pastDueSince: firstFailure,
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.past_due',
        providerEventId: 'evt_pd_2',
        providerSubscriptionId: 'sub_pd_2',
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(false);
      // No transition attempted (status already PAST_DUE) -> no save call.
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
      // Still notified — the customer should hear about every failed retry.
      expect(
        dunningNotificationService.notifyPaymentFailed,
      ).toHaveBeenCalledWith(companyId, manager);
    });

    it('throws when no subscription matches the Stripe subscription id', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.past_due',
        providerEventId: 'evt_pd_3',
        providerSubscriptionId: 'sub_unknown',
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow(/sub_unknown/);
    });
  });

  describe('subscription.cancelled', () => {
    it('transitions an ACTIVE subscription to CANCELLED, clears pastDueSince, and notifies', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.ACTIVE,
        externalSubscriptionId: 'sub_cancel_1',
        pastDueSince: null,
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.cancelled',
        providerEventId: 'evt_cancel_1',
        providerSubscriptionId: 'sub_cancel_1',
        reason: 'subscription_deleted',
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(false);
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SubscriptionStatus.CANCELLED,
          pastDueSince: null,
        }),
      );
      expect(
        dunningNotificationService.notifySubscriptionCancelled,
      ).toHaveBeenCalledWith(companyId, manager);
    });

    it('transitions a PAST_DUE subscription to CANCELLED (retries exhausted)', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.PAST_DUE,
        externalSubscriptionId: 'sub_cancel_2',
        pastDueSince: new Date('2026-06-20T00:00:00.000Z'),
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.cancelled',
        providerEventId: 'evt_cancel_2',
        providerSubscriptionId: 'sub_cancel_2',
        reason: 'retries_exhausted',
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(false);
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SubscriptionStatus.CANCELLED }),
      );
    });

    it('is idempotent (no-op, no re-thrown guard rejection) when already CANCELLED — Stripe sends both updated(unpaid) and deleted', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        companyId,
        status: SubscriptionStatus.CANCELLED,
        externalSubscriptionId: 'sub_cancel_3',
      });
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.cancelled',
        providerEventId: 'evt_cancel_3',
        providerSubscriptionId: 'sub_cancel_3',
        reason: 'subscription_deleted',
      });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result.alreadyProcessed).toBe(false);
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
      expect(
        dunningNotificationService.notifySubscriptionCancelled,
      ).not.toHaveBeenCalled();
    });

    it('throws when no subscription matches the Stripe subscription id', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      paymentProvider.verifyAndParseWebhook.mockReturnValue({
        type: 'subscription.cancelled',
        providerEventId: 'evt_cancel_4',
        providerSubscriptionId: 'sub_unknown',
        reason: 'subscription_deleted',
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow(/sub_unknown/);
    });
  });
});
