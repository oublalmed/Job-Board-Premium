import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Recruiter } from './entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionPlan,
} from './entities/subscription.entity.js';
import { isSubscriptionWithinAccess } from './subscription-access.js';
import { resolveUserLimitForPlan } from '../billing/plan-quota.js';

@Injectable()
export class SubscriptionGuardService {
  constructor(
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly configService: ConfigService,
  ) {}

  // Returns companyId so callers that also need it skip a second query.
  //
  // Per-status rules (Lot 6D — access is no longer one blanket rule):
  //  - ACTIVE: authoritative by status alone, no endsAt check. Status
  //    transitions for ACTIVE are entirely webhook-driven (Stripe is the
  //    source of truth — see payment-webhook.service.ts), so the status
  //    itself is never stale the way a locally-computed date could be.
  //    This also covers cancelAtPeriodEnd=true: the row stays ACTIVE
  //    (full access) right up until Stripe reaches periodEnd and fires
  //    customer.subscription.deleted.
  //  - TRIAL: still time-checked against endsAt — nothing flips a trial to
  //    EXPIRED on its own, so this is the one status where the guard must
  //    do that check itself.
  //  - PAST_DUE: full access within the grace window
  //    (pastDueSince + SUBSCRIPTION_GRACE_PERIOD_DAYS), restricted once
  //    past it (US-BILL-04 — controlled degradation, not an immediate
  //    cutoff on the very first failed payment).
  //  - CANCELLED / EXPIRED: never active.
  async assertActiveSubscription(
    userId: string,
  ): Promise<{ companyId: string }> {
    const recruiter = await this.recruiterRepo.findOne({
      where: { userId },
    });
    if (!recruiter) {
      throw new ForbiddenException(
        'Aucun compte recruteur associé à cet utilisateur',
      );
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { companyId: recruiter.companyId },
      order: { createdAt: 'DESC' },
    });

    if (!subscription || !this.isWithinAccess(subscription)) {
      throw new ForbiddenException(
        'Un abonnement actif est requis pour accéder à cette fonctionnalité',
      );
    }

    return { companyId: recruiter.companyId };
  }

  private isWithinAccess(subscription: Subscription): boolean {
    // Per-status access rules (Lot 6D) live in the shared pure helper so
    // EntitlementService applies the exact same definition.
    const gracePeriodDays = this.configService.get<number>(
      'business.subscriptionGracePeriodDays',
      7,
    );
    return isSubscriptionWithinAccess(subscription, gracePeriodDays);
  }

  // Company resolution only, no subscription check — used by mutations that
  // must scope to the caller's company regardless of subscription state
  // (e.g. removing a recruiter, closing an offer).
  async resolveCompanyId(userId: string): Promise<string> {
    const recruiter = await this.recruiterRepo.findOne({
      where: { userId },
    });
    if (!recruiter) {
      throw new NotFoundException('No company associated with this account');
    }
    return recruiter.companyId;
  }

  // Max number of recruiter seats for a company, from its current plan. Falls
  // back to STARTER (the trial plan every company is provisioned with) if no
  // subscription row exists yet.
  async getSeatLimit(companyId: string): Promise<number> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
    const plan = subscription?.plan ?? SubscriptionPlan.STARTER;
    return resolveUserLimitForPlan(plan, this.configService);
  }
}
