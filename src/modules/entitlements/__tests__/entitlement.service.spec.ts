import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EntitlementService } from '../entitlement.service.js';
import { Recruiter } from '../../companies/entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../companies/entities/subscription.entity.js';
import { FeatureOverride } from '../entities/feature-override.entity.js';
import { Feature } from '../feature.enum.js';
import { FeatureSource } from '../entities/feature-override.entity.js';

describe('EntitlementService (§13)', () => {
  let service: EntitlementService;
  let recruiterRepo: Record<string, jest.Mock>;
  let subscriptionRepo: Record<string, jest.Mock>;
  let overrideRepo: Record<string, jest.Mock>;

  const companyId = 'company-1';

  function sub(over: Partial<Subscription> = {}): Subscription {
    return {
      id: 's1',
      companyId,
      plan: SubscriptionPlan.SCALE,
      status: SubscriptionStatus.ACTIVE,
      endsAt: null,
      pastDueSince: null,
      createdAt: new Date(),
      ...over,
    } as unknown as Subscription;
  }

  beforeEach(async () => {
    recruiterRepo = {
      findOne: jest.fn().mockResolvedValue({ userId: 'u1', companyId }),
      count: jest.fn().mockResolvedValue(2),
    };
    subscriptionRepo = { findOne: jest.fn().mockResolvedValue(sub()) };
    overrideRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'o1', ...v })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementService,
        { provide: getRepositoryToken(Recruiter), useValue: recruiterRepo },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
        {
          provide: getRepositoryToken(FeatureOverride),
          useValue: overrideRepo,
        },
        { provide: ConfigService, useValue: { get: jest.fn(() => 7) } },
      ],
    }).compile();

    service = module.get(EntitlementService);
  });

  it('grants a Premium (scale) company Anti-cheat', async () => {
    expect(
      await service.hasFeatureForCompany(companyId, Feature.ANTI_CHEAT),
    ).toBe(true);
    expect(
      await service.hasFeatureForCompany(companyId, Feature.API_ACCESS),
    ).toBe(false);
  });

  it('a Pro (growth) company has Jobs but not Anti-cheat', async () => {
    subscriptionRepo.findOne.mockResolvedValue(
      sub({ plan: SubscriptionPlan.GROWTH }),
    );
    expect(await service.hasFeatureForCompany(companyId, Feature.JOBS)).toBe(
      true,
    );
    expect(
      await service.hasFeatureForCompany(companyId, Feature.ANTI_CHEAT),
    ).toBe(false);
  });

  it('an inactive subscription grants no plan features', async () => {
    subscriptionRepo.findOne.mockResolvedValue(
      sub({ status: SubscriptionStatus.CANCELLED }),
    );
    const e = await service.getEntitlementsForCompany(companyId);
    expect(e.active).toBe(false);
    expect(e.features[Feature.ANTI_CHEAT].enabled).toBe(false);
    expect(e.features[Feature.CV_DATABASE].enabled).toBe(false);
  });

  it('no subscription → nothing, plan null', async () => {
    subscriptionRepo.findOne.mockResolvedValue(null);
    const e = await service.getEntitlementsForCompany(companyId);
    expect(e.plan).toBeNull();
    expect(e.active).toBe(false);
    expect(e.features[Feature.JOBS].enabled).toBe(false);
  });

  it('an admin override force-enables a feature the plan lacks (source ADMIN_OVERRIDE)', async () => {
    subscriptionRepo.findOne.mockResolvedValue(
      sub({ plan: SubscriptionPlan.STARTER }),
    );
    overrideRepo.find.mockResolvedValue([
      { feature: Feature.ANTI_CHEAT, enabled: true },
    ]);
    const e = await service.getEntitlementsForCompany(companyId);
    expect(e.features[Feature.ANTI_CHEAT]).toEqual({
      enabled: true,
      source: FeatureSource.ADMIN_OVERRIDE,
    });
  });

  it('an admin override can revoke a plan feature', async () => {
    overrideRepo.find.mockResolvedValue([
      { feature: Feature.ANTI_CHEAT, enabled: false },
    ]);
    expect(
      await service.hasFeatureForCompany(companyId, Feature.ANTI_CHEAT),
    ).toBe(false);
  });

  it('setOverride upserts', async () => {
    await service.setOverride(
      companyId,
      Feature.JOBS,
      true,
      'admin-1',
      'pilot',
    );
    expect(overrideRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        feature: Feature.JOBS,
        enabled: true,
        actorId: 'admin-1',
      }),
    );
  });
});
