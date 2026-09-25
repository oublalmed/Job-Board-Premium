import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from './entities/subscription.entity.js';

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

// Admin-side management of recruiter subscriptions: a read overview across all
// companies plus an administrative cancel. Distinct from the recruiter-facing
// self-service flow (subscription-checkout) — this is staff tooling.
@Injectable()
export class SubscriptionAdminService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
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
