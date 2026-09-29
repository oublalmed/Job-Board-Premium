import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JobOffer, JobStatus } from '../jobs/entities/job-offer.entity.js';
import {
  JobApplication,
  ApplicationStatus,
} from '../jobs/entities/job-application.entity.js';
import { ShortlistEntry } from '../companies/entities/shortlist-entry.entity.js';
import { Conversation } from '../messaging/entities/conversation.entity.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../companies/entities/subscription.entity.js';

// §4 — recruiter analytics, computed from real, company-scoped data only
// (program rule #3: never fabricate figures). Everything here is a COUNT /
// GROUP BY over the company's own jobs, applications, shortlist and messages.
export interface RecruiterAnalyticsOverview {
  rangeDays: number;
  jobs: { total: number; published: number; draft: number; closed: number };
  applications: {
    total: number;
    byStatus: Record<ApplicationStatus, number>;
  };
  shortlist: { total: number };
  conversations: { total: number };
  contacts: { used: number; quota: number | null };
  applicationsTrend: { date: string; count: number }[];
  topOffers: { id: string; title: string; applications: number }[];
}

function emptyStatusMap(): Record<ApplicationStatus, number> {
  return {
    [ApplicationStatus.APPLIED]: 0,
    [ApplicationStatus.UNDER_REVIEW]: 0,
    [ApplicationStatus.SHORTLISTED]: 0,
    [ApplicationStatus.INTERVIEW]: 0,
    [ApplicationStatus.REJECTED]: 0,
    [ApplicationStatus.ACCEPTED]: 0,
  };
}

@Injectable()
export class RecruiterAnalyticsService {
  constructor(
    @InjectRepository(JobOffer)
    private readonly offerRepo: Repository<JobOffer>,
    @InjectRepository(JobApplication)
    private readonly appRepo: Repository<JobApplication>,
    @InjectRepository(ShortlistEntry)
    private readonly shortlistRepo: Repository<ShortlistEntry>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async overview(
    companyId: string,
    days = 30,
  ): Promise<RecruiterAnalyticsOverview> {
    const rangeDays = Number.isFinite(days) && days > 0 ? Math.trunc(days) : 30;
    const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const [
      jobs,
      applications,
      shortlistTotal,
      conversationsTotal,
      subscription,
      trendRows,
      topOffers,
    ] = await Promise.all([
      this.jobsByStatus(companyId),
      this.applicationsByStatus(companyId),
      this.shortlistRepo.count({ where: { companyId } }),
      this.conversationRepo.count({ where: { companyId } }),
      this.subscriptionRepo.findOne({
        where: {
          companyId,
          status: In([SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE]),
        },
      }),
      this.applicationsTrend(companyId, from),
      this.topOffers(companyId),
    ]);

    return {
      rangeDays,
      jobs,
      applications,
      shortlist: { total: shortlistTotal },
      conversations: { total: conversationsTotal },
      contacts: {
        used: subscription?.contactsUsed ?? 0,
        quota: subscription?.contactQuota ?? null,
      },
      applicationsTrend: this.fillDays(trendRows, from, rangeDays),
      topOffers,
    };
  }

  private async jobsByStatus(
    companyId: string,
  ): Promise<RecruiterAnalyticsOverview['jobs']> {
    const rows = await this.offerRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.company_id = :companyId', { companyId })
      .groupBy('o.status')
      .getRawMany<{ status: JobStatus; count: string }>();
    const by = new Map(rows.map((r) => [r.status, Number(r.count)]));
    return {
      total: [...by.values()].reduce((a, b) => a + b, 0),
      published: by.get(JobStatus.PUBLISHED) ?? 0,
      draft: by.get(JobStatus.DRAFT) ?? 0,
      closed: by.get(JobStatus.CLOSED) ?? 0,
    };
  }

  private async applicationsByStatus(
    companyId: string,
  ): Promise<RecruiterAnalyticsOverview['applications']> {
    const rows = await this.appRepo
      .createQueryBuilder('a')
      .innerJoin('a.jobOffer', 'o')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.company_id = :companyId', { companyId })
      .groupBy('a.status')
      .getRawMany<{ status: ApplicationStatus; count: string }>();
    const byStatus = emptyStatusMap();
    let total = 0;
    for (const r of rows) {
      const n = Number(r.count);
      byStatus[r.status] = n;
      total += n;
    }
    return { total, byStatus };
  }

  private async applicationsTrend(
    companyId: string,
    from: Date,
  ): Promise<{ day: string; count: number }[]> {
    const rows = await this.appRepo
      .createQueryBuilder('a')
      .innerJoin('a.jobOffer', 'o')
      .select("TO_CHAR(a.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('o.company_id = :companyId', { companyId })
      .andWhere('a.created_at >= :from', { from })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  }

  // Turn the sparse per-day rows into a continuous daily series so the chart
  // has a point for every day in the range (missing days = 0).
  private fillDays(
    rows: { day: string; count: number }[],
    from: Date,
    rangeDays: number,
  ): { date: string; count: number }[] {
    const counts = new Map(rows.map((r) => [r.day, r.count]));
    const series: { date: string; count: number }[] = [];
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: counts.get(key) ?? 0 });
    }
    return series;
  }

  private async topOffers(
    companyId: string,
  ): Promise<{ id: string; title: string; applications: number }[]> {
    const rows = await this.appRepo
      .createQueryBuilder('a')
      .innerJoin('a.jobOffer', 'o')
      .select('o.id', 'id')
      .addSelect('o.title', 'title')
      .addSelect('COUNT(*)', 'count')
      .where('o.company_id = :companyId', { companyId })
      .groupBy('o.id')
      .addGroupBy('o.title')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany<{ id: string; title: string; count: string }>();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      applications: Number(r.count),
    }));
  }
}
