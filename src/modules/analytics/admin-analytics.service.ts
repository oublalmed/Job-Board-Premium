import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../companies/entities/subscription.entity.js';
import { JobOffer, JobStatus } from '../jobs/entities/job-offer.entity.js';
import { JobApplication } from '../jobs/entities/job-application.entity.js';
import {
  Assessment,
  AssessmentStatus,
} from '../assessments/entities/assessment.entity.js';
import { Role } from '../../common/enums/role.enum.js';

// §5 — platform-wide admin analytics, computed from real data only (program
// rule #3). Plain COUNT / GROUP BY over users, companies, subscriptions, jobs,
// applications and assessments.
export interface AdminAnalyticsOverview {
  users: { total: number; candidates: number; recruiters: number };
  companies: { total: number };
  subscriptions: { active: number; byPlan: Record<SubscriptionPlan, number> };
  jobs: { total: number; published: number };
  applications: { total: number };
  assessments: { total: number; completed: number };
}

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(JobOffer)
    private readonly offerRepo: Repository<JobOffer>,
    @InjectRepository(JobApplication)
    private readonly appRepo: Repository<JobApplication>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
  ) {}

  async overview(): Promise<AdminAnalyticsOverview> {
    const [
      usersTotal,
      candidates,
      recruiters,
      companiesTotal,
      activeSubs,
      subsByPlan,
      jobsTotal,
      jobsPublished,
      applicationsTotal,
      assessmentsTotal,
      assessmentsCompleted,
    ] = await Promise.all([
      this.userRepo.count(),
      this.countByRole(Role.CANDIDATE),
      this.countByRoles([Role.RECRUITER, Role.COMPANY_ADMIN]),
      this.companyRepo.count(),
      this.subscriptionRepo.count({
        where: {
          status: In([SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE]),
        },
      }),
      this.subscriptionsByPlan(),
      this.offerRepo.count(),
      this.offerRepo.count({ where: { status: JobStatus.PUBLISHED } }),
      this.appRepo.count(),
      this.assessmentRepo.count(),
      this.assessmentRepo.count({
        where: { status: AssessmentStatus.COMPLETED },
      }),
    ]);

    return {
      users: { total: usersTotal, candidates, recruiters },
      companies: { total: companiesTotal },
      subscriptions: { active: activeSubs, byPlan: subsByPlan },
      jobs: { total: jobsTotal, published: jobsPublished },
      applications: { total: applicationsTotal },
      assessments: { total: assessmentsTotal, completed: assessmentsCompleted },
    };
  }

  // roles is a Postgres enum array — count rows where the role is present.
  private countByRole(role: Role): Promise<number> {
    return this.userRepo
      .createQueryBuilder('u')
      .where(':role = ANY(u.roles)', { role })
      .getCount();
  }

  private countByRoles(roles: Role[]): Promise<number> {
    return this.userRepo
      .createQueryBuilder('u')
      .where('u.roles && :roles', { roles })
      .getCount();
  }

  private async subscriptionsByPlan(): Promise<
    Record<SubscriptionPlan, number>
  > {
    const rows = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('s.plan', 'plan')
      .addSelect('COUNT(*)', 'count')
      .where('s.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE],
      })
      .groupBy('s.plan')
      .getRawMany<{ plan: SubscriptionPlan; count: string }>();
    const by = new Map(rows.map((r) => [r.plan, Number(r.count)]));
    return {
      [SubscriptionPlan.STARTER]: by.get(SubscriptionPlan.STARTER) ?? 0,
      [SubscriptionPlan.GROWTH]: by.get(SubscriptionPlan.GROWTH) ?? 0,
      [SubscriptionPlan.SCALE]: by.get(SubscriptionPlan.SCALE) ?? 0,
      [SubscriptionPlan.ENTERPRISE]: by.get(SubscriptionPlan.ENTERPRISE) ?? 0,
    };
  }
}
