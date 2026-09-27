import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionAdminService } from '../subscription-admin.service.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../entities/subscription.entity.js';
import { Company } from '../entities/company.entity.js';
import { Recruiter } from '../entities/recruiter.entity.js';

function makeSub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    companyId: 'comp-1',
    plan: SubscriptionPlan.STARTER,
    status: SubscriptionStatus.ACTIVE,
    startsAt: new Date('2026-01-01'),
    endsAt: null,
    contactQuota: 15,
    contactsUsed: 2,
    cancelAtPeriodEnd: false,
    pastDueSince: null,
    company: { id: 'comp-1', name: 'Atlas' },
    ...over,
  } as unknown as Subscription;
}

describe('SubscriptionAdminService', () => {
  let service: SubscriptionAdminService;
  let subscriptionRepo: Record<string, jest.Mock>;
  let companyRepo: { findOne: jest.Mock };
  let recruiterRepo: { find: jest.Mock };
  let configService: { get: jest.Mock };
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    subscriptionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };
    companyRepo = { findOne: jest.fn() };
    recruiterRepo = { find: jest.fn().mockResolvedValue([]) };
    configService = { get: jest.fn().mockReturnValue(60) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionAdminService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
        { provide: getRepositoryToken(Company), useValue: companyRepo },
        { provide: getRepositoryToken(Recruiter), useValue: recruiterRepo },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SubscriptionAdminService);
  });

  describe('list', () => {
    it('maps rows and counts every status', async () => {
      qb.getMany.mockResolvedValue([
        makeSub({ id: 's1', status: SubscriptionStatus.ACTIVE }),
        makeSub({ id: 's2', status: SubscriptionStatus.SUSPENDED }),
      ]);
      const result = await service.list();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].companyName).toBe('Atlas');
      expect(result.counts[SubscriptionStatus.ACTIVE]).toBe(1);
      expect(result.counts[SubscriptionStatus.SUSPENDED]).toBe(1);
      expect(result.counts[SubscriptionStatus.CANCELLED]).toBe(0);
    });

    it('filters by status but counts across all subscriptions', async () => {
      qb.getMany.mockResolvedValue([
        makeSub({ status: SubscriptionStatus.ACTIVE }),
      ]);
      subscriptionRepo.find.mockResolvedValue([
        makeSub({ status: SubscriptionStatus.ACTIVE }),
        makeSub({ status: SubscriptionStatus.CANCELLED }),
      ]);
      const result = await service.list(SubscriptionStatus.ACTIVE);
      expect(qb.where).toHaveBeenCalledWith('sub.status = :status', {
        status: SubscriptionStatus.ACTIVE,
      });
      expect(result.items).toHaveLength(1);
      expect(result.counts[SubscriptionStatus.ACTIVE]).toBe(1);
      expect(result.counts[SubscriptionStatus.CANCELLED]).toBe(1);
    });
  });

  describe('cancel', () => {
    it('terminates the subscription now', async () => {
      subscriptionRepo.findOne.mockResolvedValue(makeSub());
      const row = await service.cancel('sub-1');
      expect(row.status).toBe(SubscriptionStatus.CANCELLED);
      expect(row.endsAt).toBeInstanceOf(Date);
    });

    it('throws NotFound when absent', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suspend', () => {
    it('holds an active subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSub({ status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: true }),
      );
      const row = await service.suspend('sub-1');
      expect(row.status).toBe(SubscriptionStatus.SUSPENDED);
      expect(row.cancelAtPeriodEnd).toBe(false);
    });

    it('refuses to suspend a cancelled/expired subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSub({ status: SubscriptionStatus.CANCELLED }),
      );
      await expect(service.suspend('sub-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses to suspend an already-suspended subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSub({ status: SubscriptionStatus.SUSPENDED }),
      );
      await expect(service.suspend('sub-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reactivate', () => {
    it('lifts a hold when no other live subscription exists', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSub({ status: SubscriptionStatus.SUSPENDED }),
      );
      subscriptionRepo.count.mockResolvedValue(0);
      const row = await service.reactivate('sub-1');
      expect(row.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('refuses to reactivate a non-suspended subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSub({ status: SubscriptionStatus.ACTIVE }),
      );
      await expect(service.reactivate('sub-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('conflicts when the company already has a live subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSub({ status: SubscriptionStatus.SUSPENDED }),
      );
      subscriptionRepo.count.mockResolvedValue(1);
      await expect(service.reactivate('sub-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('listAssignableCompanies', () => {
    it('groups recruiters by company with emails and current plan', async () => {
      recruiterRepo.find.mockResolvedValue([
        {
          companyId: 'comp-1',
          company: { id: 'comp-1', name: 'Zellige' },
          user: { email: 'a@z.ma' },
        },
        {
          companyId: 'comp-1',
          company: { id: 'comp-1', name: 'Zellige' },
          user: { email: 'b@z.ma' },
        },
        { companyId: 'comp-2', company: null, user: { email: 'x@y.ma' } },
      ]);
      subscriptionRepo.find.mockResolvedValue([
        makeSub({ companyId: 'comp-1', plan: SubscriptionPlan.GROWTH }),
      ]);
      const rows = await service.listAssignableCompanies();
      expect(rows).toHaveLength(1); // comp-2 has no company relation → skipped
      expect(rows[0].companyName).toBe('Zellige');
      expect(rows[0].recruiterEmails).toEqual(['a@z.ma', 'b@z.ma']);
      expect(rows[0].currentPlan).toBe(SubscriptionPlan.GROWTH);
    });

    it('returns empty when no company has recruiters', async () => {
      recruiterRepo.find.mockResolvedValue([]);
      expect(await service.listAssignableCompanies()).toEqual([]);
    });
  });

  describe('assignPlan', () => {
    it('reuses the existing live slot, updating plan + quota', async () => {
      companyRepo.findOne.mockResolvedValue({ id: 'comp-1', name: 'Atlas' });
      subscriptionRepo.findOne.mockResolvedValue(
        makeSub({ status: SubscriptionStatus.PAST_DUE }),
      );
      const row = await service.assignPlan(
        'comp-1',
        SubscriptionPlan.SCALE,
        250,
      );
      expect(row.plan).toBe(SubscriptionPlan.SCALE);
      expect(row.contactQuota).toBe(250);
      expect(row.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscriptionRepo.create).not.toHaveBeenCalled();
    });

    it('creates a new subscription when none is live', async () => {
      companyRepo.findOne.mockResolvedValue({ id: 'comp-1', name: 'Atlas' });
      subscriptionRepo.findOne.mockResolvedValue(null);
      const row = await service.assignPlan('comp-1', SubscriptionPlan.GROWTH);
      // quota resolved from config (mocked to 60)
      expect(row.contactQuota).toBe(60);
      expect(row.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscriptionRepo.create).toHaveBeenCalled();
    });

    it('throws NotFound for an unknown company', async () => {
      companyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assignPlan('nope', SubscriptionPlan.STARTER, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('requires an explicit quota for the Enterprise plan', async () => {
      companyRepo.findOne.mockResolvedValue({ id: 'comp-1', name: 'Atlas' });
      await expect(
        service.assignPlan('comp-1', SubscriptionPlan.ENTERPRISE),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
