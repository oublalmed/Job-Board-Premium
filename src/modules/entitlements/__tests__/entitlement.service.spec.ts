import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
import { Feature, LimitKey } from '../feature.enum.js';
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

  it('grants a Premium (scale) company advanced analytics, not Enterprise API', async () => {
    expect(
      await service.hasFeatureForCompany(companyId, Feature.ADVANCED_ANALYTICS),
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
      { feature: Feature.JOBS, enabled: false },
    ]);
    expect(await service.hasFeatureForCompany(companyId, Feature.JOBS)).toBe(
      false,
    );
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

  it('resolves the caller company and answers hasFeatureForUser', async () => {
    expect(
      await service.hasFeatureForUser('u1', Feature.ADVANCED_ANALYTICS),
    ).toBe(true);
    expect(recruiterRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('getLimit reads the plan matrix', () => {
    expect(service.getLimit(SubscriptionPlan.SCALE, LimitKey.MAX_USERS)).toBe(
      10,
    );
    expect(
      service.getLimit(SubscriptionPlan.SCALE, LimitKey.MAX_EVALUATIONS_MONTH),
    ).toBeNull();
  });

  it('countUsers returns the recruiter count', async () => {
    expect(await service.countUsers(companyId)).toBe(2);
  });

  it('listOverrides returns the company overrides', async () => {
    overrideRepo.find.mockResolvedValue([{ id: 'o1', feature: Feature.JOBS }]);
    const rows = await service.listOverrides(companyId);
    expect(rows).toHaveLength(1);
  });

  it('clearOverride removes an existing override, else throws', async () => {
    overrideRepo.findOne.mockResolvedValue({ id: 'o1' });
    await service.clearOverride(companyId, Feature.JOBS);
    expect(overrideRepo.remove).toHaveBeenCalled();

    overrideRepo.findOne.mockResolvedValue(null);
    await expect(
      service.clearOverride(companyId, Feature.JOBS),
    ).rejects.toThrow(NotFoundException);
  });

  it('setOverride updates an existing override in place', async () => {
    overrideRepo.findOne.mockResolvedValue({
      id: 'o1',
      companyId,
      feature: Feature.JOBS,
      enabled: false,
    });
    await service.setOverride(companyId, Feature.JOBS, true, 'admin-2');
    expect(overrideRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1', enabled: true, actorId: 'admin-2' }),
    );
  });
});
