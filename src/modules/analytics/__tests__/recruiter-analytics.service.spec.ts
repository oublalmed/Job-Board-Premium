import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecruiterAnalyticsService } from '../recruiter-analytics.service.js';
import { JobOffer, JobStatus } from '../../jobs/entities/job-offer.entity.js';
import {
  JobApplication,
  ApplicationStatus,
} from '../../jobs/entities/job-application.entity.js';
import { ShortlistEntry } from '../../companies/entities/shortlist-entry.entity.js';
import { Conversation } from '../../messaging/entities/conversation.entity.js';
import { Subscription } from '../../companies/entities/subscription.entity.js';

const companyId = 'comp-1';

// A chainable query-builder whose getRawMany returns queued result sets in the
// order the service creates builders on that repo.
function qbRepo(rawQueue: unknown[][]) {
  let i = 0;
  const make = () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'select',
      'addSelect',
      'innerJoin',
      'where',
      'andWhere',
      'groupBy',
      'addGroupBy',
      'orderBy',
      'limit',
    ]) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getRawMany = jest.fn().mockResolvedValue(rawQueue[i++] ?? []);
    return qb;
  };
  return { createQueryBuilder: jest.fn(make) };
}

describe('RecruiterAnalyticsService (§4)', () => {
  let service: RecruiterAnalyticsService;
  let offerRepo: ReturnType<typeof qbRepo>;
  let appRepo: ReturnType<typeof qbRepo>;
  let shortlistRepo: { count: jest.Mock };
  let conversationRepo: { count: jest.Mock };
  let subscriptionRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    offerRepo = qbRepo([
      [
        { status: JobStatus.PUBLISHED, count: '3' },
        { status: JobStatus.DRAFT, count: '2' },
        { status: JobStatus.CLOSED, count: '1' },
      ],
    ]);
    // appRepo builders, in call order: byStatus, trend, topOffers.
    appRepo = qbRepo([
      [
        { status: ApplicationStatus.APPLIED, count: '5' },
        { status: ApplicationStatus.SHORTLISTED, count: '2' },
      ],
      [{ day: '2026-09-20', count: '4' }],
      [{ id: 'o1', title: 'Backend', count: '7' }],
    ]);
    shortlistRepo = { count: jest.fn().mockResolvedValue(4) };
    conversationRepo = { count: jest.fn().mockResolvedValue(6) };
    subscriptionRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ contactsUsed: 8, contactQuota: 50 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecruiterAnalyticsService,
        { provide: getRepositoryToken(JobOffer), useValue: offerRepo },
        { provide: getRepositoryToken(JobApplication), useValue: appRepo },
        {
          provide: getRepositoryToken(ShortlistEntry),
          useValue: shortlistRepo,
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: conversationRepo,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
      ],
    }).compile();

    service = module.get(RecruiterAnalyticsService);
  });

  it('aggregates real company-scoped counts', async () => {
    const o = await service.overview(companyId, 30);

    expect(o.jobs).toEqual({ total: 6, published: 3, draft: 2, closed: 1 });
    expect(o.applications.total).toBe(7);
    expect(o.applications.byStatus[ApplicationStatus.APPLIED]).toBe(5);
    expect(o.applications.byStatus[ApplicationStatus.SHORTLISTED]).toBe(2);
    expect(o.applications.byStatus[ApplicationStatus.REJECTED]).toBe(0);
    expect(o.shortlist.total).toBe(4);
    expect(o.conversations.total).toBe(6);
    expect(o.contacts).toEqual({ used: 8, quota: 50 });
    expect(o.topOffers).toEqual([
      { id: 'o1', title: 'Backend', applications: 7 },
    ]);
  });

  it('returns a continuous daily trend series for the range', async () => {
    const o = await service.overview(companyId, 30);
    expect(o.rangeDays).toBe(30);
    expect(o.applicationsTrend).toHaveLength(30);
    // Every entry is a { date, count } with a numeric count.
    for (const p of o.applicationsTrend) {
      expect(typeof p.date).toBe('string');
      expect(typeof p.count).toBe('number');
    }
  });

  it('defaults the range to 30 days and tolerates no subscription', async () => {
    subscriptionRepo.findOne.mockResolvedValue(null);
    const o = await service.overview(companyId, 0);
    expect(o.rangeDays).toBe(30);
    expect(o.contacts).toEqual({ used: 0, quota: null });
  });
});
