import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminAnalyticsService } from '../admin-analytics.service.js';
import { User } from '../../users/entities/user.entity.js';
import { Company } from '../../companies/entities/company.entity.js';
import {
  Subscription,
  SubscriptionPlan,
} from '../../companies/entities/subscription.entity.js';
import { JobOffer } from '../../jobs/entities/job-offer.entity.js';
import { JobApplication } from '../../jobs/entities/job-application.entity.js';
import { Assessment } from '../../assessments/entities/assessment.entity.js';

describe('AdminAnalyticsService (§5)', () => {
  let service: AdminAnalyticsService;

  // userRepo: count() for total; createQueryBuilder().where().getCount() for roles.
  const userGetCount = jest.fn();
  const userRepo = {
    count: jest.fn().mockResolvedValue(100),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      qb.where = jest.fn().mockReturnValue(qb);
      qb.getCount = userGetCount;
      return qb;
    }),
  };
  const subQb: Record<string, jest.Mock> = {};
  const subscriptionRepo = {
    count: jest.fn().mockResolvedValue(12),
    createQueryBuilder: jest.fn(() => {
      for (const m of ['select', 'addSelect', 'where', 'groupBy']) {
        subQb[m] = jest.fn().mockReturnValue(subQb);
      }
      subQb.getRawMany = jest.fn().mockResolvedValue([
        { plan: SubscriptionPlan.STARTER, count: '5' },
        { plan: SubscriptionPlan.SCALE, count: '2' },
      ]);
      return subQb;
    }),
  };
  const companyRepo = { count: jest.fn().mockResolvedValue(20) };
  const offerRepo = {
    count: jest
      .fn()
      .mockResolvedValueOnce(30) // total
      .mockResolvedValueOnce(18), // published
  };
  const appRepo = { count: jest.fn().mockResolvedValue(210) };
  const assessmentRepo = {
    count: jest
      .fn()
      .mockResolvedValueOnce(80) // total
      .mockResolvedValueOnce(55), // completed
  };

  beforeEach(async () => {
    // candidates then recruiters (call order in Promise.all).
    userGetCount.mockReset();
    userGetCount.mockResolvedValueOnce(70).mockResolvedValueOnce(25);
    offerRepo.count.mockReset();
    offerRepo.count.mockResolvedValueOnce(30).mockResolvedValueOnce(18);
    assessmentRepo.count.mockReset();
    assessmentRepo.count.mockResolvedValueOnce(80).mockResolvedValueOnce(55);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Company), useValue: companyRepo },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
        { provide: getRepositoryToken(JobOffer), useValue: offerRepo },
        { provide: getRepositoryToken(JobApplication), useValue: appRepo },
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
      ],
    }).compile();

    service = module.get(AdminAnalyticsService);
  });

  it('assembles platform KPIs from real counts', async () => {
    const o = await service.overview();
    expect(o.users).toEqual({ total: 100, candidates: 70, recruiters: 25 });
    expect(o.companies.total).toBe(20);
    expect(o.subscriptions.active).toBe(12);
    expect(o.subscriptions.byPlan[SubscriptionPlan.STARTER]).toBe(5);
    expect(o.subscriptions.byPlan[SubscriptionPlan.SCALE]).toBe(2);
    expect(o.subscriptions.byPlan[SubscriptionPlan.GROWTH]).toBe(0);
    expect(o.jobs).toEqual({ total: 30, published: 18 });
    expect(o.applications.total).toBe(210);
    expect(o.assessments).toEqual({ total: 80, completed: 55 });
  });
});
