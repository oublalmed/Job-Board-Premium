import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { In, Not, Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from './entities/subscription.entity.js';
import { Company } from './entities/company.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import { resolveContactQuotaForPlan } from '../billing/plan-quota.js';

export interface AdminSubscriptionRow {
  id: string;
  companyId: string;
  companyName: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startsAt: Date;
  endsAt: Date | null;
  contactQuota: number;
  contactsUsed: number;
  cancelAtPeriodEnd: boolean;
  pastDueSince: Date | null;
}

export interface AdminSubscriptionList {
  items: AdminSubscriptionRow[];
  counts: Record<string, number>;
}

// A company an admin can assign a pack to — i.e. one that has at least one
// recruiter. Carries the recruiter contacts and the current live plan (if any)
// so the admin sees what each company is on before changing it.
export interface AssignableCompanyRow {
  companyId: string;
  companyName: string;
  recruiterEmails: string[];
  currentPlan: SubscriptionPlan | null;
  currentStatus: SubscriptionStatus | null;
}

// Statuses that still hold a company's single "live" subscription slot. Terminal
// rows (CANCELLED/EXPIRED) accumulate and are ignored when assigning.
const LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.SUSPENDED,
];

// Admin-side management of recruiter subscriptions: a read overview across all
// companies plus an administrative cancel. Distinct from the recruiter-facing
// self-service flow (subscription-checkout) — this is staff tooling.
@Injectable()
export class SubscriptionAdminService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    private readonly configService: ConfigService,
  ) {}

  async list(status?: SubscriptionStatus): Promise<AdminSubscriptionList> {
    const qb = this.subscriptionRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.company', 'company')
      .orderBy('sub.createdAt', 'DESC');
    if (status) {
      qb.where('sub.status = :status', { status });
    }
    const subs = await qb.getMany();

    // A count per status across ALL subscriptions (ignoring the filter), so the
    // overview tiles stay stable while the list is filtered.
    const all = status ? await this.subscriptionRepo.find() : subs;
    const counts: Record<string, number> = {};
    for (const s of Object.values(SubscriptionStatus)) counts[s] = 0;
    for (const s of all) counts[s.status] = (counts[s.status] ?? 0) + 1;

    return {
      items: subs.map((s) => this.toRow(s)),
      counts,
    };
  }

  // Administrative override: terminate a subscription now. Kept deliberately
  // simple (no external billing call) — it is staff tooling for a local/managed
  // context, not the Stripe-driven self-service cancel.
  async cancel(id: string): Promise<AdminSubscriptionRow> {
    const sub = await this.load(id);

    sub.status = SubscriptionStatus.CANCELLED;
    sub.endsAt = new Date();
    sub.cancelAtPeriodEnd = false;
    return this.toRow(await this.subscriptionRepo.save(sub), sub.company);
  }

  // Administrative hold — typically applied to an unpaid (PAST_DUE) company.
  // Suspension revokes CVthèque access (SubscriptionGuardService denies the
  // SUSPENDED status) but, unlike cancel, is reversible via reactivate: the
  // billing period (endsAt) and quota are left untouched. Terminal statuses
  // (CANCELLED/EXPIRED) cannot be suspended — there is nothing to hold.
  async suspend(id: string): Promise<AdminSubscriptionRow> {
    const sub = await this.load(id);

    if (
      sub.status === SubscriptionStatus.CANCELLED ||
      sub.status === SubscriptionStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'A cancelled or expired subscription cannot be suspended',
      );
    }
    if (sub.status === SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Subscription is already suspended');
    }

    sub.status = SubscriptionStatus.SUSPENDED;
    // A suspended subscription must never keep a pending "cancel at period end"
    // intent — the hold supersedes it; reactivation returns a clean ACTIVE row.
    sub.cancelAtPeriodEnd = false;
    return this.toRow(await this.subscriptionRepo.save(sub), sub.company);
  }

  // Lift an admin hold: SUSPENDED -> ACTIVE. Guarded by the same
  // "one live subscription per company" invariant as the partial unique index
  // (UQ_subscriptions_company_active) so reactivation can't create a second
  // ACTIVE/TRIAL row for a company that has meanwhile started a new one.
  async reactivate(id: string): Promise<AdminSubscriptionRow> {
    const sub = await this.load(id);

    if (sub.status !== SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException(
        'Only a suspended subscription can be reactivated',
      );
    }

    const liveElsewhere = await this.subscriptionRepo.count({
      where: [
        {
          companyId: sub.companyId,
          id: Not(sub.id),
          status: SubscriptionStatus.ACTIVE,
        },
        {
          companyId: sub.companyId,
          id: Not(sub.id),
          status: SubscriptionStatus.TRIAL,
        },
      ],
    });
    if (liveElsewhere > 0) {
      throw new ConflictException(
        'The company already has an active or trial subscription',
      );
    }

    sub.status = SubscriptionStatus.ACTIVE;
    return this.toRow(await this.subscriptionRepo.save(sub), sub.company);
  }

  // Companies an admin can assign a pack to: those with at least one recruiter
  // (the real recruiter accounts, not orphan/test companies). Each row carries
  // the recruiter emails and the current live plan so the admin can decide.
  async listAssignableCompanies(): Promise<AssignableCompanyRow[]> {
    const recruiters = await this.recruiterRepo.find({
      relations: { company: true, user: true },
    });

    // Group recruiters by company, collecting contact emails.
    const byCompany = new Map<
      string,
      { name: string; emails: Set<string> }
    >();
    for (const r of recruiters) {
      if (!r.company) continue;
      const entry = byCompany.get(r.companyId) ?? {
        name: r.company.name,
        emails: new Set<string>(),
      };
      if (r.user?.email) entry.emails.add(r.user.email);
      byCompany.set(r.companyId, entry);
    }

    const companyIds = [...byCompany.keys()];
    if (companyIds.length === 0) return [];

    // The current live subscription per company (most recent wins if several).
    const liveSubs = await this.subscriptionRepo.find({
      where: { companyId: In(companyIds), status: In(LIVE_STATUSES) },
      order: { createdAt: 'DESC' },
    });
    const liveByCompany = new Map<string, Subscription>();
    for (const s of liveSubs) {
      if (!liveByCompany.has(s.companyId)) liveByCompany.set(s.companyId, s);
    }

    return [...byCompany.entries()]
      .map(([companyId, info]) => {
        const live = liveByCompany.get(companyId);
        return {
          companyId,
          companyName: info.name,
          recruiterEmails: [...info.emails].sort(),
          currentPlan: live?.plan ?? null,
          currentStatus: live?.status ?? null,
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }

  // Assign (or change) a company's pack, per its contract. Reuses the company's
  // existing live subscription slot when there is one — updating its plan and
  // quota and (re)activating it — rather than creating a second live row, which
  // the partial unique index (UQ_subscriptions_company_active) forbids. The
  // quota defaults to the plan's configured allowance; ENTERPRISE has no
  // automated quota, so an explicit contactQuota is required for it.
  async assignPlan(
    companyId: string,
    plan: SubscriptionPlan,
    contactQuota?: number,
  ): Promise<AdminSubscriptionRow> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const quota = this.resolveQuota(plan, contactQuota);

    const existing = await this.subscriptionRepo.findOne({
      where: { companyId, status: In(LIVE_STATUSES) },
      order: { createdAt: 'DESC' },
      relations: { company: true },
    });

    const now = new Date();
    if (existing) {
      existing.plan = plan;
      existing.contactQuota = quota;
      existing.status = SubscriptionStatus.ACTIVE;
      existing.cancelAtPeriodEnd = false;
      existing.pastDueSince = null;
      // Admin-managed assignment is open-ended (no vendor billing cycle here).
      existing.endsAt = null;
      const saved = await this.subscriptionRepo.save(existing);
      return this.toRow(saved, existing.company ?? company);
    }

    const created = this.subscriptionRepo.create({
      companyId,
      plan,
      status: SubscriptionStatus.ACTIVE,
      startsAt: now,
      endsAt: null,
      contactQuota: quota,
      contactsUsed: 0,
      cancelAtPeriodEnd: false,
    });
    const saved = await this.subscriptionRepo.save(created);
    return this.toRow(saved, company);
  }

  // A plan's contact allowance: an explicit override wins (and is the only way
  // to provision ENTERPRISE, whose quota is negotiated per contract); otherwise
  // the configured per-plan default is used.
  private resolveQuota(plan: SubscriptionPlan, override?: number): number {
    if (override !== undefined) return override;
    if (plan === SubscriptionPlan.ENTERPRISE) {
      throw new BadRequestException(
        'A contact quota is required for the Enterprise plan (negotiated per contract)',
      );
    }
    return resolveContactQuotaForPlan(plan, this.configService);
  }

  private async load(id: string): Promise<Subscription> {
    const sub = await this.subscriptionRepo.findOne({
      where: { id },
      relations: { company: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  private toRow(
    s: Subscription,
    company = s.company,
  ): AdminSubscriptionRow {
    return {
      id: s.id,
      companyId: s.companyId,
      companyName: company?.name ?? '—',
      plan: s.plan,
      status: s.status,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      contactQuota: s.contactQuota,
      contactsUsed: s.contactsUsed,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      pastDueSince: s.pastDueSince,
    };
  }
}
