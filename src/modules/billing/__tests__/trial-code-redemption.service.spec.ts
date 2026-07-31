import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryFailedError } from 'typeorm';
import { TrialCodeRedemptionService } from '../trial-code-redemption.service.js';
import { SubscriptionGuardService } from '../../companies/subscription-guard.service.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../companies/entities/subscription.entity.js';
import { TrialCode, TrialCodeStatus } from '../entities/trial-code.entity.js';
import { TrialCodeRedemption } from '../entities/trial-code-redemption.entity.js';
import {
  InvalidTrialCodeException,
  TrialCodeAlreadyRedeemedException,
  TrialCodeNotEligibleException,
} from '../billing.exceptions.js';

function uniqueViolation(): QueryFailedError {
  const driverError = Object.assign(
    new Error('duplicate key value violates unique constraint'),
    { code: '23505', constraint: 'UQ_trial_code_redemptions_company_id' },
  );
  return new QueryFailedError(
    'INSERT INTO "trial_code_redemptions" ...',
    [],
    driverError,
  );
}

describe('TrialCodeRedemptionService', () => {
  let service: TrialCodeRedemptionService;
  let subscriptionGuard: { resolveCompanyId: jest.Mock };
  let configService: { get: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let manager: { getRepository: jest.Mock };
  let subscriptionRepo: { findOne: jest.Mock; save: jest.Mock };
  let trialCodeRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let redemptionRepo: { insert: jest.Mock };
  let updateQb: Record<string, jest.Mock>;

  const userId = 'user-1';
  const companyId = 'company-1';

  function activeTrialSubscription(): Partial<Subscription> {
    return {
      id: 'sub-1',
      companyId,
      status: SubscriptionStatus.TRIAL,
      plan: SubscriptionPlan.STARTER,
      contactQuota: 15,
      endsAt: new Date(),
    };
  }

  function validTrialCode(overrides: Partial<TrialCode> = {}): TrialCode {
    return {
      id: 'trial-code-1',
      code: 'WELCOME2026',
      plan: SubscriptionPlan.GROWTH,
      trialDurationDays: 30,
      maxUses: 10,
      usedCount: 0,
      status: TrialCodeStatus.ACTIVE,
      expiresAt: null,
      createdAt: new Date(),
      ...overrides,
    } as TrialCode;
  }

  function createMockUpdateQueryBuilder(
    affected: number,
  ): Record<string, jest.Mock> {
    const qb: Record<string, jest.Mock> = {};
    for (const method of ['update', 'set', 'where', 'andWhere']) {
      qb[method] = jest.fn().mockReturnValue(qb);
    }
    qb.execute = jest.fn().mockResolvedValue({ affected });
    return qb;
  }

  beforeEach(async () => {
    updateQb = createMockUpdateQueryBuilder(1);
    subscriptionGuard = {
      resolveCompanyId: jest.fn().mockResolvedValue(companyId),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'business.plans.growth.contacts') return 60;
        if (key === 'business.plans.starter.contacts') return 15;
        return undefined;
      }),
    };
    subscriptionRepo = {
      findOne: jest.fn().mockResolvedValue(activeTrialSubscription()),
      save: jest.fn((data: unknown) => Promise.resolve(data)),
    };
    trialCodeRepo = {
      findOne: jest.fn().mockResolvedValue(validTrialCode()),
      createQueryBuilder: jest.fn().mockReturnValue(updateQb),
    };
    redemptionRepo = {
      insert: jest.fn().mockResolvedValue(undefined),
    };
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Subscription) return subscriptionRepo;
        if (entity === TrialCode) return trialCodeRepo;
        if (entity === TrialCodeRedemption) return redemptionRepo;
        throw new Error('unexpected repo requested');
      }),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
        cb(manager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrialCodeRedemptionService,
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(TrialCodeRedemptionService);
  });

  it('redeems a valid code: extends the trial, upgrades the plan, tracks the redemption', async () => {
    const result = await service.redeem(userId, 'WELCOME2026');

    expect(redemptionRepo.insert).toHaveBeenCalledWith({
      trialCodeId: 'trial-code-1',
      companyId,
    });
    expect(updateQb.where).toHaveBeenCalledWith('id = :id', {
      id: 'trial-code-1',
    });
    expect(updateQb.andWhere).toHaveBeenCalledWith('used_count < max_uses');
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ plan: SubscriptionPlan.GROWTH, contactQuota: 60 }),
    );
    expect(result.plan).toBe(SubscriptionPlan.GROWTH);
    expect(result.contactQuota).toBe(60);
  });

  it('rejects when the company has no TRIAL subscription (already active/past_due/cancelled)', async () => {
    subscriptionRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.redeem(userId, 'WELCOME2026')).rejects.toThrow(
      TrialCodeNotEligibleException,
    );
    expect(redemptionRepo.insert).not.toHaveBeenCalled();
  });

  it('rejects an unknown code', async () => {
    trialCodeRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.redeem(userId, 'NOPE')).rejects.toThrow(
      InvalidTrialCodeException,
    );
  });

  it('rejects a revoked code', async () => {
    trialCodeRepo.findOne.mockResolvedValueOnce(
      validTrialCode({ status: TrialCodeStatus.REVOKED }),
    );

    await expect(service.redeem(userId, 'WELCOME2026')).rejects.toThrow(
      InvalidTrialCodeException,
    );
  });

  it('rejects an expired code', async () => {
    trialCodeRepo.findOne.mockResolvedValueOnce(
      validTrialCode({ expiresAt: new Date('2020-01-01') }),
    );

    await expect(service.redeem(userId, 'WELCOME2026')).rejects.toThrow(
      InvalidTrialCodeException,
    );
  });

  it('rejects a code whose quota is already exhausted (read-level check)', async () => {
    trialCodeRepo.findOne.mockResolvedValueOnce(
      validTrialCode({ usedCount: 10, maxUses: 10 }),
    );

    await expect(service.redeem(userId, 'WELCOME2026')).rejects.toThrow(
      InvalidTrialCodeException,
    );
  });

  it('rejects when the atomic quota claim loses a race (usedCount hit the limit between the read and the UPDATE)', async () => {
    updateQb.execute.mockResolvedValueOnce({ affected: 0 });

    await expect(service.redeem(userId, 'WELCOME2026')).rejects.toThrow(
      InvalidTrialCodeException,
    );
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects double activation by the same company — discriminated via the redemption unique constraint', async () => {
    redemptionRepo.insert.mockRejectedValueOnce(uniqueViolation());

    await expect(service.redeem(userId, 'WELCOME2026')).rejects.toThrow(
      TrialCodeAlreadyRedeemedException,
    );
    expect(updateQb.execute).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
  });
});
