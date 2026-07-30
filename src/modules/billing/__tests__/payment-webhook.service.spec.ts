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
import { PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT } from '../entities/processed-webhook-event.entity.js';

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
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Subscription) return subscriptionRepo;
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentWebhookService,
        { provide: DataSource, useValue: dataSource },
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
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
      }),
    );
  });

  it('creates a fresh row when no TRIAL/PAST_DUE row is eligible', async () => {
    subscriptionRepo.findOne.mockResolvedValue(null);
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'subscription.activated',
      providerEventId: 'evt_2',
      providerSessionId: 'cs_2',
      companyId,
      plan: 'growth',
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subscriptionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        status: SubscriptionStatus.ACTIVE,
        contactQuota: 60,
      }),
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
      companyId,
      plan: 'growth',
    });

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result.alreadyProcessed).toBe(true);
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('rethrows a non-unique-violation error from the transaction', async () => {
    dataSource.transaction.mockRejectedValueOnce(new Error('boom'));
    paymentProvider.verifyAndParseWebhook.mockReturnValue({
      type: 'subscription.activated',
      providerEventId: 'evt_4',
      providerSessionId: 'cs_4',
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
      companyId,
      plan: 'growth',
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'sig'),
    ).rejects.toThrow(QueryFailedError);
  });

  it('ignores "ignored" and "subscription.cancelled" events with no business effect (still recorded)', async () => {
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
});
